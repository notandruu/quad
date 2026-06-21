import { createHash } from "crypto";
import type { BrainMemory } from "@/lib/types";
import { retrieveMemories, findMemoryBySourceId } from "@/lib/brain/retrieve";
import { ingestMemory, type IngestInput } from "@/lib/brain/ingest";
import { listConnectorDocuments, type ConnectorDocument } from "@/lib/connectors/documents";
import { complete, auditModel, extractJsonObject } from "@/lib/llm/anthropic";
import { publishAuditEvent } from "@/lib/redis/publisher";
import { createQuadChainPacket, summarizeQuadChainPacket } from "@/lib/quad-chain";
import type { QuadChainPacketSummary } from "@/lib/quad-chain";

export type TrustQuestionSource = {
  id: string;
  kind: "brain" | "connector";
  title: string;
  quote?: string;
};

export type JudgeResult = {
  /** True only when the answer is fully grounded in the provided sources. */
  passed: boolean;
  /**
   * True when the answer substantively answers the question. A grounded but
   * declining answer ("the sources do not establish X") is passed=true,
   * answersQuestion=false, and must escalate to a human rather than be learned.
   */
  answersQuestion: boolean;
  confidence: number;
  reason: string;
  risks: string[];
};

export type TrustQuestionResult = {
  questionId: string;
  question: string;
  status: "answered" | "needs_human";
  answer?: string;
  confidence?: number;
  sources: TrustQuestionSource[];
  evaluation?: JudgeResult;
  memory?: BrainMemory;
  wasReused?: boolean;
  quadChain: QuadChainPacketSummary;
};

export type TrustQuestionInput = {
  orgId: string;
  question: string;
  runId: string;
  /** Injected for tests — skips the LLM judge call. */
  _judgeOverride?: (opts: { question: string; answer: string; sources: string[] }) => Promise<JudgeResult | null>;
  /** Injected for tests — intercepts brain writeback. */
  _ingestOverride?: (input: IngestInput) => Promise<BrainMemory>;
};

/**
 * Deterministic source ID for an enterprise proof answer. Same question in
 * the same org always maps to the same sourceId, so brain writeback is
 * idempotent: re-answering a question updates the existing memory rather than
 * creating a duplicate.
 */
export function computeQuestionSourceId(orgId: string, question: string): string {
  const hash = createHash("sha256")
    .update(`${orgId}:${question.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 16);
  return `ep:${orgId}:${hash}`;
}

/**
 * Enterprise proof learn loop: retrieve -> collect -> ground -> evaluate ->
 * writeback. Only judge-passing answers are persisted to the brain. Failed or
 * unsupported answers return status "needs_human" with no write side effect.
 *
 * Every step emits a Redis event so the dashboard can stream progress.
 */
export async function answerTrustQuestion(input: TrustQuestionInput): Promise<TrustQuestionResult> {
  const { orgId, question, runId } = input;
  const judgeImpl = input._judgeOverride ?? defaultJudge;
  const ingestImpl = input._ingestOverride ?? ingestMemory;

  const questionId = computeQuestionSourceId(orgId, question);

  // Step 1: retrieve
  await publishAuditEvent(runId, "question.started", { questionId, question, orgId });

  const memories = await retrieveMemories({ orgId, query: question, scope: "internal", limit: 6 });
  await publishAuditEvent(runId, "brain.retrieved", { questionId, count: memories.length, titles: memories.map((m) => m.title) });

  // Step 2: collect from connectors
  const connectorDocs = await listConnectorDocuments({ orgId, query: question, limit: 6 });
  await publishAuditEvent(runId, "context.collected", {
    questionId,
    brainCount: memories.length,
    connectorCount: connectorDocs.length,
    connectors: connectorDocs.map((d) => d.connectorId),
  });

  const sources: TrustQuestionSource[] = [
    ...memories.map((m) => ({
      id: m.id,
      kind: "brain" as const,
      title: m.title,
      quote: m.evidence?.[0]?.quote,
    })),
    ...connectorDocs.map((d) => ({
      id: d.id,
      kind: "connector" as const,
      title: d.title,
      quote: d.content.slice(0, 120),
    })),
  ];

  // Step 3: no context => needs_human immediately
  if (sources.length === 0) {
    await publishAuditEvent(runId, "answer.needs_human", {
      questionId,
      reason: "no_evidence",
      question,
    });

    const packet = createNeedsHumanPacket({ orgId, runId, questionId, question, reason: "no_evidence" });
    return {
      questionId,
      question,
      status: "needs_human",
      sources: [],
      quadChain: summarizeQuadChainPacket(packet),
    };
  }

  // Step 4: draft answer
  const contextBlock = buildContextBlock(memories, connectorDocs);
  const answer = await draftAnswer({ question, contextBlock }) ?? buildHeuristicAnswer(memories, connectorDocs);
  await publishAuditEvent(runId, "answer.drafted", { questionId, answerLength: answer.length });

  // Step 5: evaluate. The judge must see the SAME evidence the drafter saw —
  // truncated snippets starve it and make it reject claims that are actually
  // supported deeper in a source. Pass full content.
  const judgeSources = [
    ...memories.map((m) => `${m.title}: ${m.content}`),
    ...connectorDocs.map((d) => `${d.title}: ${d.content}`),
  ];
  const evaluation = await judgeImpl({ question, answer, sources: judgeSources });

  // Two ways to land in needs_human:
  //  1. the answer is not grounded in the sources (judge failed / unavailable)
  //  2. the answer IS grounded but declines to answer the question — a real
  //     gap in the evidence that a human must close, not fabricate.
  const grounded = Boolean(evaluation?.passed);
  const substantive = Boolean(evaluation?.answersQuestion);
  if (!evaluation || !grounded || !substantive) {
    const reason = !evaluation
      ? "judge_unavailable"
      : !grounded
        ? evaluation.reason || "not_grounded"
        : "insufficient_evidence";
    await publishAuditEvent(runId, "answer.evaluated", {
      questionId,
      passed: grounded,
      answersQuestion: substantive,
      reason,
      risks: evaluation?.risks ?? [],
    });
    await publishAuditEvent(runId, "answer.needs_human", { questionId, reason });

    const packet = createNeedsHumanPacket({ orgId, runId, questionId, question, reason });
    return {
      questionId,
      question,
      status: "needs_human",
      answer,
      sources,
      evaluation: evaluation ?? undefined,
      quadChain: summarizeQuadChainPacket(packet),
    };
  }

  await publishAuditEvent(runId, "answer.evaluated", {
    questionId,
    passed: true,
    confidence: evaluation.confidence,
    reason: evaluation.reason,
  });

  // Step 6: writeback — idempotent by sourceId. Look up across whichever store
  // the write would land in (Supabase when configured, else in-memory) so reuse
  // detection works in both modes.
  const sourceId = questionId; // computeQuestionSourceId output IS the sourceId
  const existing = await findMemoryBySourceId(orgId, sourceId);
  let memory: BrainMemory;
  let wasReused = false;

  if (existing) {
    memory = existing;
    wasReused = true;
  } else {
    const validationTag = `[Validated ${new Date().toISOString().slice(0, 10)} | confidence ${evaluation.confidence.toFixed(2)}]`;
    const ingestInput: IngestInput = {
      orgId,
      sourceId,
      sourceType: "doc",
      title: `EP: ${question.slice(0, 80)}`,
      content: `${validationTag} ${answer}`,
      summary: answer.slice(0, 200),
      entities: [],
      confidence: evaluation.confidence,
      permissions: ["read"],
      evidence: memories
        .flatMap((m) => m.evidence)
        .filter((e) => Boolean(e.quote))
        .slice(0, 4)
        .concat(
          connectorDocs.slice(0, 2).map((d) => ({
            documentId: d.id,
            pageTitle: d.title,
            url: d.url,
            quote: d.content.slice(0, 120),
          }))
        ),
    };
    memory = await ingestImpl(ingestInput);
  }

  await publishAuditEvent(runId, "brain.learned", {
    questionId,
    memoryId: memory.id,
    sourceId,
    wasReused,
    confidence: evaluation.confidence,
  });

  // Build quadchain packet
  const packet = createQuadChainPacket({
    type: "brain_memory_write",
    orgId,
    runId,
    producer: "quad.enterprise_proof",
    consumer: "quad.brain",
    sources: [
      ...memories.map((m) => ({ id: m.id, kind: "memory" as const, content: { title: m.title, summary: m.summary } })),
      ...connectorDocs.map((d) => ({ id: d.id, kind: "artifact" as const, content: { title: d.title, kind: d.kind } })),
    ],
    evidence: memories
      .flatMap((m) => m.evidence)
      .filter((e) => Boolean(e.quote))
      .slice(0, 4)
      .map((e, i) => ({ id: `ev_${i}`, sourceId: memories[0]?.id ?? questionId, quote: e.quote, required: true })),
    output: answer,
    answerConcepts: ["enterprise_proof", "trust_question", question.slice(0, 40)],
    openObligations: wasReused
      ? []
      : [{ kind: "approval_required" as const, id: `approval_${questionId}`, reason: "New learned fact requires operator review before use in customer-facing trust packets." }],
    visibility: "restricted",
  });

  return {
    questionId,
    question,
    status: "answered",
    answer,
    confidence: evaluation.confidence,
    sources,
    evaluation,
    memory,
    wasReused,
    quadChain: summarizeQuadChainPacket(packet),
  };
}

// ---- internal helpers ----

function buildContextBlock(memories: BrainMemory[], docs: ConnectorDocument[]): string {
  const parts: string[] = [];
  for (const m of memories) {
    parts.push(`[Brain memory: ${m.title}]\n${m.content}`);
  }
  for (const d of docs) {
    parts.push(`[${d.connectorId} ${d.kind}: ${d.title}]\n${d.content}`);
  }
  return parts.join("\n\n---\n\n");
}

async function draftAnswer(opts: { question: string; contextBlock: string }): Promise<string | null> {
  const system =
    "You are a compliance analyst drafting answers to enterprise security questionnaires. " +
    "Answer ONLY from the provided context. If the context does not fully support the answer, say so explicitly. " +
    "Be concise and precise. Cite your sources by title. Do not fabricate facts.";
  const prompt = `Context:\n${opts.contextBlock}\n\nQuestion: ${opts.question}\n\nAnswer:`;
  return complete({ model: auditModel(), system, prompt, maxTokens: 512, purpose: "trust_packet" });
}

function buildHeuristicAnswer(memories: BrainMemory[], docs: ConnectorDocument[]): string {
  const lines: string[] = [];
  for (const m of memories) {
    lines.push(`Based on ${m.title}: ${m.summary ?? m.content.slice(0, 200)}`);
  }
  for (const d of docs) {
    lines.push(`Based on ${d.title}: ${d.content.slice(0, 200)}`);
  }
  return lines.join("\n\n") || "Insufficient evidence to answer this question.";
}

async function defaultJudge(opts: {
  question: string;
  answer: string;
  sources: string[];
}): Promise<JudgeResult | null> {
  const system =
    "You are a strict compliance verifier for security questionnaire answers. " +
    "Return ONLY a JSON object: " +
    "{ passed: boolean, answersQuestion: boolean, confidence: number (0-1), reason: string, risks: string[] }. " +
    "passed=true only if every claim in the answer is traceable to the sources; if any claim lacks source support, passed=false. " +
    "answersQuestion=true only if the answer substantively answers what was asked. " +
    "If the answer declines, says the sources do not establish the fact, or says it cannot determine the answer, set answersQuestion=false. " +
    "Default both to false when uncertain.";
  const prompt =
    `Question: ${opts.question}\n\n` +
    `Sources:\n${opts.sources.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\n` +
    `Answer to evaluate: ${opts.answer}\n\n` +
    `Evaluation (JSON only):`;

  // 256 tokens truncates the JSON mid-object when the reason is verbose, which
  // makes the parse fail and silently escalates a perfectly good answer. Give
  // the verdict enough room to close its braces.
  const raw = await complete({ model: auditModel(), system, prompt, maxTokens: 600, purpose: "evaluation" });
  if (!raw) return null;

  const obj = extractJsonObject(raw);
  if (!obj) return null;

  const passed = Boolean(obj.passed);
  const answersQuestion = "answersQuestion" in obj ? Boolean(obj.answersQuestion) : true;
  const confidence = typeof obj.confidence === "number" ? Math.min(1, Math.max(0, obj.confidence)) : 0.5;
  const reason = typeof obj.reason === "string" ? obj.reason : "no reason provided";
  const risks = Array.isArray(obj.risks) ? (obj.risks as string[]).filter((r) => typeof r === "string") : [];

  return { passed, answersQuestion, confidence, reason, risks };
}

function createNeedsHumanPacket(opts: {
  orgId: string;
  runId: string;
  questionId: string;
  question: string;
  reason: string;
}) {
  return createQuadChainPacket({
    type: "brain_memory_write",
    orgId: opts.orgId,
    runId: opts.runId,
    producer: "quad.enterprise_proof",
    consumer: "quad.human_review",
    sources: [],
    evidence: [],
    output: `Question escalated for human review: ${opts.question}`,
    answerConcepts: ["needs_human", "escalation"],
    openObligations: [
      {
        kind: "needs_human" as const,
        id: opts.questionId,
        reason: `Human review required: ${opts.reason}`,
      },
    ],
    visibility: "restricted",
  });
}
