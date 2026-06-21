import { createHash } from "crypto";
import type { BrainMemory } from "@/lib/types";
import { ingestMemory, type IngestInput } from "@/lib/brain/ingest";
import { findMemoryBySourceId } from "@/lib/brain/retrieve";
import { complete, auditModel, extractJsonArray, extractJsonObject } from "@/lib/llm/anthropic";
import { publishAuditEvent, type PublishedEvent } from "@/lib/redis/publisher";
import type { MeetingUtterance } from "@/data/demo/meeting";

export type ExtractedFact = {
  claim: string;
  category: string;
  sourceQuote: string;
};

export type MeetingFactVerdict = {
  passed: boolean;
  durable: boolean;
  confidence: number;
  reason: string;
};

export type MeetingFactResult = {
  fact: ExtractedFact;
  status: "learned" | "proposed" | "rejected" | "reused";
  confidence?: number;
  reason?: string;
  memoryId?: string;
  sourceId: string;
};

export type LearnFromMeetingResult = {
  runId: string;
  orgId: string;
  title: string;
  transcript: string;
  facts: MeetingFactResult[];
  learnedCount: number;
  proposedCount: number;
  rejectedCount: number;
  summary: string;
};

export type LearnFromMeetingInput = {
  orgId: string;
  runId: string;
  title?: string;
  context?: string;
  utterances: MeetingUtterance[];
  onEvent?: (event: PublishedEvent) => void;
  writePolicy?: "direct" | "approval";
  /** Test/seam overrides. */
  _extractOverride?: (segment: string, context: string) => Promise<ExtractedFact[]>;
  _judgeOverride?: (fact: ExtractedFact, transcript: string) => Promise<MeetingFactVerdict | null>;
  _ingestOverride?: (input: IngestInput) => Promise<BrainMemory>;
};

/** Stable, idempotent source id for a learned meeting fact. */
export function meetingFactSourceId(orgId: string, claim: string): string {
  const hash = createHash("sha256")
    .update(`${orgId}:${claim.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 16);
  return `meeting_fact:${orgId}:${hash}`;
}

/**
 * Live-meeting context capture. Walk the transcript utterance by utterance,
 * extract candidate company facts, ground+judge each, and write only the
 * verified, durable ones into the brain. Every step emits a Redis event so the
 * dashboard can stream the agent's thinking and the brain's growth live.
 *
 * Hard rule (same as the rest of Quad): an unverified or non-durable fact is
 * never written to the brain.
 */
export async function learnFromMeeting(input: LearnFromMeetingInput): Promise<LearnFromMeetingResult> {
  const { orgId, runId, utterances } = input;
  const title = input.title ?? "Team meeting";
  const context = input.context ?? "";
  const extract = input._extractOverride ?? defaultExtract;
  const judge = input._judgeOverride ?? defaultJudge;
  const ingestImpl = input._ingestOverride ?? ingestMemory;
  const writePolicy = input.writePolicy ?? "direct";

  const emit = async (type: string, payload: Record<string, unknown>) => {
    const event = await publishAuditEvent(runId, type, payload);
    if (event && input.onEvent) input.onEvent(event);
  };

  await emit("meeting.started", { runId, orgId, title, context, lines: utterances.length });

  const transcriptLines: string[] = [];
  const facts: MeetingFactResult[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < utterances.length; i += 1) {
    const utterance = utterances[i];
    const line = `${utterance.speaker}: ${utterance.text}`;
    transcriptLines.push(line);
    await emit("meeting.transcript", { index: i, speaker: utterance.speaker, text: utterance.text });

    // Skip obvious non-content (very short lines) to save model calls.
    if (utterance.text.trim().length < 24) continue;

    await emit("meeting.thinking", { index: i, step: "scan", detail: `Scanning ${utterance.speaker}'s statement for durable company facts.` });

    const candidates = await extract(line, context).catch(() => []);
    for (const fact of candidates) {
      const key = normalizeClaim(fact.claim);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const sourceId = meetingFactSourceId(orgId, fact.claim);

      await emit("fact.extracted", { claim: fact.claim, category: fact.category, sourceQuote: fact.sourceQuote });

      // Idempotent: if this fact is already in the brain, reuse it.
      const existing = await findMemoryBySourceId(orgId, sourceId).catch(() => null);
      if (existing) {
        facts.push({ fact, status: "reused", memoryId: existing.id, sourceId });
        await emit("fact.learned", { claim: fact.claim, memoryId: existing.id, sourceId, reused: true });
        continue;
      }

      await emit("meeting.thinking", { step: "verify", detail: `Grounding "${truncate(fact.claim, 60)}" against the transcript.` });
      const verdict = await judge(fact, transcriptLines.join("\n"));

      if (!verdict || !verdict.passed || !verdict.durable) {
        const reason = !verdict
          ? "judge_unavailable"
          : !verdict.passed
            ? verdict.reason || "not_grounded"
            : "not_durable";
        facts.push({ fact, status: "rejected", reason, confidence: verdict?.confidence, sourceId });
        await emit("fact.rejected", { claim: fact.claim, reason });
        continue;
      }

      await emit("fact.evaluated", { claim: fact.claim, passed: true, confidence: verdict.confidence });

      if (writePolicy === "approval") {
        facts.push({ fact, status: "proposed", confidence: verdict.confidence, sourceId });
        await emit("fact.proposed", {
          claim: fact.claim,
          category: fact.category,
          sourceId,
          confidence: verdict.confidence,
          approvalRequired: true,
        });
        continue;
      }

      const memory = await ingestImpl({
        orgId,
        sourceId,
        sourceType: "meeting",
        title: `Meeting fact: ${truncate(fact.claim, 70)}`,
        content: fact.claim,
        summary: fact.claim,
        entities: [fact.category],
        confidence: verdict.confidence,
        permissions: ["read"],
        evidence: [{ quote: fact.sourceQuote, documentId: runId }],
      });

      facts.push({ fact, status: "learned", memoryId: memory.id, confidence: verdict.confidence, sourceId });
      await emit("fact.learned", { claim: fact.claim, category: fact.category, memoryId: memory.id, sourceId, confidence: verdict.confidence });
    }
  }

  const learned = facts.filter((f) => f.status === "learned" || f.status === "reused");
  const proposed = facts.filter((f) => f.status === "proposed");
  const rejected = facts.filter((f) => f.status === "rejected");
  const retainedFacts = learned.length > 0 ? learned : proposed;
  const summary = await summarizeMeeting(title, retainedFacts.map((f) => f.fact.claim)).catch(() => buildHeuristicSummary(retainedFacts));

  await emit("meeting.summarized", { summary, learnedCount: learned.length, proposedCount: proposed.length, rejectedCount: rejected.length });
  await emit("meeting.ended", { runId, learnedCount: learned.length, proposedCount: proposed.length, rejectedCount: rejected.length });

  return {
    runId,
    orgId,
    title,
    transcript: transcriptLines.join("\n"),
    facts,
    learnedCount: learned.length,
    proposedCount: proposed.length,
    rejectedCount: rejected.length,
    summary,
  };
}

// ---- model-backed steps (with graceful no-key fallbacks) ----

async function defaultExtract(segment: string, context: string): Promise<ExtractedFact[]> {
  const system =
    "You extract durable company facts from a meeting transcript line. " +
    "A durable fact is a metric, decision, deadline, policy, or operational detail worth remembering about the organization. " +
    "Ignore greetings, opinions, questions, and chit-chat. " +
    "Return ONLY a JSON array (possibly empty) of objects: " +
    '{ "claim": string, "category": string, "sourceQuote": string }. ' +
    "claim is a single self-contained sentence. category is one of: metric, decision, deadline, policy, program, expansion, other. " +
    "sourceQuote is the exact span from the line that supports the claim.";
  const prompt = `${context ? `Meeting context: ${context}\n\n` : ""}Transcript line: ${segment}\n\nFacts (JSON array only):`;
  const raw = await complete({ model: auditModel(), system, prompt, maxTokens: 500, purpose: "audit" });
  if (!raw) return heuristicExtract(segment);

  const arr = extractJsonArray(raw);
  const facts: ExtractedFact[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const claim = typeof obj.claim === "string" ? obj.claim.trim() : "";
    if (!claim) continue;
    facts.push({
      claim,
      category: typeof obj.category === "string" ? obj.category : "other",
      sourceQuote: typeof obj.sourceQuote === "string" && obj.sourceQuote ? obj.sourceQuote : segment,
    });
  }
  return facts;
}

async function defaultJudge(fact: ExtractedFact, transcript: string): Promise<MeetingFactVerdict | null> {
  const system =
    "You verify a candidate company fact against a meeting transcript. " +
    "Return ONLY JSON: { passed: boolean, durable: boolean, confidence: number (0-1), reason: string }. " +
    "passed=true only if the transcript clearly supports the claim. " +
    "durable=true only if the claim is a lasting company fact (metric, decision, deadline, policy, program detail), not chit-chat or a question. " +
    "Default both to false when uncertain.";
  const prompt = `Transcript:\n${transcript}\n\nCandidate fact: ${fact.claim}\nSource quote: ${fact.sourceQuote}\n\nVerdict (JSON only):`;
  const raw = await complete({ model: auditModel(), system, prompt, maxTokens: 400, purpose: "evaluation" });
  if (!raw) return null;
  const obj = extractJsonObject(raw);
  if (!obj) return null;
  return {
    passed: Boolean(obj.passed),
    durable: "durable" in obj ? Boolean(obj.durable) : true,
    confidence: typeof obj.confidence === "number" ? Math.min(1, Math.max(0, obj.confidence)) : 0.6,
    reason: typeof obj.reason === "string" ? obj.reason : "no reason provided",
  };
}

async function summarizeMeeting(title: string, claims: string[]): Promise<string> {
  if (claims.length === 0) return `No durable company facts were captured from ${title}.`;
  const system = "You write a one-paragraph summary of what an AI employee learned from a meeting. Be concise and concrete.";
  const prompt = `Meeting: ${title}\nLearned facts:\n${claims.map((c) => `- ${c}`).join("\n")}\n\nSummary:`;
  const raw = await complete({ model: auditModel(), system, prompt, maxTokens: 300, purpose: "trust_packet" });
  return raw && raw.trim() ? raw.trim() : buildHeuristicSummary(claims.map((claim) => ({ fact: { claim } }) as MeetingFactResult));
}

// ---- heuristic fallbacks (no API key) ----

function heuristicExtract(segment: string): ExtractedFact[] {
  // Pull the spoken text after "Speaker: ". Treat a content-bearing line with a
  // number, date, or decision keyword as a single candidate fact.
  const text = segment.includes(":") ? segment.slice(segment.indexOf(":") + 1).trim() : segment;
  const signalful = /\d|percent|deadline|sold out|waitlist|lease|hotline|rate|launch|open|approved|signed/i.test(text);
  if (!signalful || text.length < 24) return [];
  return [{ claim: text, category: guessCategory(text), sourceQuote: text }];
}

function buildHeuristicSummary(learned: MeetingFactResult[]): string {
  if (learned.length === 0) return "No durable company facts were captured.";
  return `Captured ${learned.length} verified facts: ${learned.map((f) => f.fact.claim).slice(0, 5).join("; ")}.`;
}

function guessCategory(text: string): string {
  if (/deadline|october|date|by /i.test(text)) return "deadline";
  if (/percent|rate|%|students|waitlist/i.test(text)) return "metric";
  if (/lease|expansion|location|open|launch/i.test(text)) return "expansion";
  if (/hotline|policy|must|guideline/i.test(text)) return "policy";
  return "other";
}

function normalizeClaim(claim: string): string {
  return claim.trim().toLowerCase().replace(/\s+/g, " ");
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
