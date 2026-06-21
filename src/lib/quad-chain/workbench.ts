import {
  buildQuadChainCertificate,
  estimateTokens,
  verifyQuadChainCertificate,
  type QuadChainEvidenceObligation,
  type QuadChainOmittedRange,
  type QuadChainSource,
} from "@/lib/quad-chain";

export type QuadChainComparison = {
  prompt: string;
  mode: "anthropic" | "deterministic";
  rawTrace: string;
  quadChainTrace: string;
  withoutQuadChain: {
    tokens: number;
    evidence: string;
    risk: string;
  };
  withQuadChain: {
    tokens: number;
    savedTokens: number;
    reduction: number;
    evidence: string;
    accepted: boolean;
    certificateId: string;
    merkleRoot: string;
    failures: string[];
  };
  omittedRanges: Array<{ id: string; reason: string; preview: string }>;
};

export type QuadChainModelPlan = {
  compressedContext?: string;
  evidence?: string[];
  concepts?: string[];
  omitted?: Array<{ preview: string; reason?: string }>;
};

const DEFAULT_TRACE = [
  "user prompt: audit the oauth signup flow and find the smallest safe fix.",
  "tool: browser opened /pricing and clicked continue with google.",
  "debug: request id req_82f1f started oauth callback",
  "debug: provider=google state=st_7281 has_code=true",
  "critical evidence: affected endpoint `/api/auth/oauth/callback` returned `401` instead of `302`.",
  "critical evidence: exact error `MissingStateCookieError` appeared in `src/auth/oauth/callback.ts:63`.",
  "critical evidence: deploy changed `src/auth/sessionCookie.ts:41` from `SameSite=Lax` to `SameSite=Strict`.",
  "noise: button color changed in the same deploy but does not affect auth.",
  "noise: healthcheck ok 200",
  "noise: cache hit public-pricing-v3",
  "policy: do not change `SESSION_SECRET`.",
  "policy: do not disable csrf checks.",
  "answer concept: restore `SameSite=Lax` for oauth callback compatibility.",
].join("\n");

export function buildQuadChainComparison(input: {
  prompt: string;
  rawTrace?: string;
  modelPlan?: QuadChainModelPlan | null;
  createdAt?: string;
}): QuadChainComparison {
  const prompt = input.prompt.trim() || "Audit this trace and produce the smallest safe fix.";
  const rawTrace = normalizeTrace(input.rawTrace, prompt);
  const deterministicEvidence = selectEvidenceLines(rawTrace, prompt);
  const evidenceLines = selectModelEvidence(input.modelPlan, rawTrace) ?? deterministicEvidence;
  const conceptLines = selectModelConcepts(input.modelPlan) ?? selectConcepts(rawTrace, prompt);
  const omitted = selectModelOmissions(input.modelPlan) ?? selectOmittedRanges(rawTrace, evidenceLines);
  const fallbackTrace = [
    `task: ${prompt}`,
    "verified evidence:",
    ...evidenceLines.map((line) => `- ${line}`),
    "answer concepts:",
    ...conceptLines.map((line) => `- ${line}`),
    "receiver instruction: answer only from preserved evidence and reject if the certificate fails.",
  ].join("\n");
  const quadChainTrace = normalizeModelCompressedContext(input.modelPlan, evidenceLines, conceptLines) ?? fallbackTrace;
  const sources: QuadChainSource[] = [
    {
      id: "raw_trace",
      kind: "tool_result",
      content: rawTrace,
    },
  ];
  const requiredEvidence: QuadChainEvidenceObligation[] = evidenceLines.map((line, index) => ({
    id: `evidence_${index + 1}`,
    sourceId: "raw_trace",
    quote: line,
    required: true,
  }));
  const omittedRanges: QuadChainOmittedRange[] = omitted.map((range) => ({
    sourceId: "raw_trace",
    rangeId: range.id,
    reason: range.reason,
    content: range.preview,
  }));
  const certificate = buildQuadChainCertificate({
    runId: "quadchain_workbench",
    producer: "quad.chat_trace",
    consumer: "quad.verified_receiver",
    compressedContext: quadChainTrace,
    sources,
    requiredEvidence,
    answerConcepts: conceptLines,
    omittedRanges,
    createdAt: input.createdAt,
  });
  const verification = verifyQuadChainCertificate(certificate, {
    compressedContext: quadChainTrace,
    sources,
    requiredEvidence,
  });
  const rawTokens = estimateTokens(rawTrace);
  const quadChainTokens = estimateTokens(quadChainTrace);
  const savedTokens = Math.max(0, rawTokens - quadChainTokens);
  const reduction = rawTokens === 0 ? 0 : Math.round((savedTokens / rawTokens) * 10000) / 100;

  return {
    prompt,
    mode: input.modelPlan ? "anthropic" : "deterministic",
    rawTrace,
    quadChainTrace,
    withoutQuadChain: {
      tokens: rawTokens,
      evidence: `${evidenceLines.length}/${evidenceLines.length}`,
      risk: "Receiver has to trust the whole trace, including noise and unverified omissions.",
    },
    withQuadChain: {
      tokens: quadChainTokens,
      savedTokens,
      reduction,
      evidence: `${evidenceLines.length}/${evidenceLines.length}`,
      accepted: verification.accepted,
      certificateId: certificate.certificateId,
      merkleRoot: certificate.anchorChain.merkleRoot,
      failures: verification.accepted ? [] : verification.failures,
    },
    omittedRanges: omitted,
  };
}

export function parseQuadChainModelPlan(text: string | null): QuadChainModelPlan | null {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    return {
      compressedContext:
        typeof parsed.compressedContext === "string" ? parsed.compressedContext.slice(0, 8000) : undefined,
      evidence: stringArray(parsed.evidence, 12),
      concepts: stringArray(parsed.concepts, 8),
      omitted: Array.isArray(parsed.omitted)
        ? parsed.omitted.slice(0, 8).flatMap((item) => {
            if (!item || typeof item !== "object") return [];
            const record = item as Record<string, unknown>;
            if (typeof record.preview !== "string") return [];
            return [
              {
                preview: record.preview.slice(0, 400),
                reason:
                  typeof record.reason === "string"
                    ? record.reason.slice(0, 240)
                    : "Low-signal trace noise was removed from the receiver packet.",
              },
            ];
          })
        : undefined,
    };
  } catch {
    return null;
  }
}

export function buildQuadChainModelPrompt(input: { prompt: string; rawTrace: string }): string {
  return [
    "Build a proof-carrying compression packet for this agent trace.",
    "Return only JSON with this shape:",
    '{"compressedContext":"string","evidence":["exact quotes copied from the trace"],"concepts":["short concepts"],"omitted":[{"preview":"exact omitted quote","reason":"why safe to omit"}]}',
    "Rules:",
    "- evidence must be copied exactly from the trace.",
    "- compressedContext must include every evidence quote exactly.",
    "- concepts must be present in compressedContext.",
    "- omit debug/noise/chatter only.",
    "- do not include private secrets.",
    "",
    `Prompt: ${input.prompt}`,
    "",
    "Trace:",
    input.rawTrace,
  ].join("\n");
}

function normalizeTrace(rawTrace: string | undefined, prompt: string): string {
  const trace = rawTrace?.trim();
  if (trace) return trace;
  return DEFAULT_TRACE.replace(/^user prompt: .+$/m, `user prompt: ${prompt}`);
}

function selectEvidenceLines(rawTrace: string, prompt: string): string[] {
  const lines = rawTrace
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const evidence = lines.filter((line) =>
    /critical evidence|policy:|must|should|do not|error|exception|failed|returned|`[^`]+`|https?:\/\/|src\/|app\/|api\/|\b\d{3}\b/i.test(line)
  );
  const fallback = [`user prompt: ${prompt}`];
  return dedupe(evidence.length > 0 ? evidence.slice(0, 8) : fallback);
}

function selectConcepts(rawTrace: string, prompt: string): string[] {
  const text = `${prompt}\n${rawTrace}`;
  const concepts = [
    "audit",
    "evidence",
    "safe fix",
    "approval",
    "oauth",
    "callback",
    "policy",
    "trust",
  ].filter((concept) => text.toLowerCase().includes(concept));
  return concepts.length > 0 ? concepts.slice(0, 5) : ["evidence"];
}

function selectModelEvidence(plan: QuadChainModelPlan | null | undefined, rawTrace: string): string[] | null {
  const evidence = plan?.evidence
    ?.map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => rawTrace.includes(line));
  return evidence && evidence.length > 0 ? dedupe(evidence).slice(0, 8) : null;
}

function selectModelConcepts(plan: QuadChainModelPlan | null | undefined): string[] | null {
  const concepts = plan?.concepts?.map((line) => line.trim()).filter(Boolean);
  return concepts && concepts.length > 0 ? dedupe(concepts).slice(0, 6) : null;
}

function selectModelOmissions(plan: QuadChainModelPlan | null | undefined) {
  if (!plan?.omitted?.length) return null;
  return plan.omitted.slice(0, 6).map((item, index) => ({
    id: `omitted_${index + 1}`,
    reason: item.reason || "Low-signal trace noise was removed from the receiver packet.",
    preview: item.preview,
  }));
}

function normalizeModelCompressedContext(
  plan: QuadChainModelPlan | null | undefined,
  evidenceLines: string[],
  conceptLines: string[]
): string | null {
  const compressed = plan?.compressedContext?.trim();
  if (!compressed) return null;
  const lower = compressed.toLowerCase();
  const missingEvidence = evidenceLines.some((line) => !compressed.includes(line));
  const missingConcepts = conceptLines.some((concept) => !lower.includes(concept.toLowerCase()));
  if (missingEvidence || missingConcepts) {
    return [
      compressed,
      "verified evidence:",
      ...evidenceLines.filter((line) => !compressed.includes(line)).map((line) => `- ${line}`),
      "answer concepts:",
      ...conceptLines.filter((concept) => !lower.includes(concept.toLowerCase())).map((concept) => `- ${concept}`),
    ].join("\n");
  }
  return compressed;
}

function selectOmittedRanges(rawTrace: string, evidenceLines: string[]) {
  const protectedSet = new Set(evidenceLines);
  return rawTrace
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !protectedSet.has(line))
    .filter((line) => /debug:|noise:|healthcheck|cache hit|trace:|verbose:/i.test(line))
    .slice(0, 6)
    .map((line, index) => ({
      id: `omitted_${index + 1}`,
      reason: "Low-signal trace noise was removed from the receiver packet.",
      preview: line,
    }));
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

function stringArray(value: unknown, limit: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
  return items.length > 0 ? items : undefined;
}
