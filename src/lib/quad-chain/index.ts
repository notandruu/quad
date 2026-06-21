import { createHash } from "crypto";

export type QuadChainHash = `sha256:${string}`;

export type QuadChainSource = {
  id: string;
  kind: "event" | "artifact" | "finding" | "memory" | "approval" | "tool_result";
  content: unknown;
};

export type QuadChainEvidenceObligation = {
  id: string;
  sourceId: string;
  quote?: string;
  required: boolean;
};

export type QuadChainOmittedRange = {
  sourceId: string;
  rangeId: string;
  reason: string;
  content?: unknown;
};

export type QuadChainOpenObligation = {
  kind: "needs_human" | "approval_required" | "connector_missing" | "evidence_missing";
  id: string;
  reason: string;
};

export type QuadChainCertificate = {
  certificateId: string;
  handoffId: string;
  runId: string;
  producer: string;
  consumer: string;
  createdAt: string;
  sourceChain: {
    inputHash: QuadChainHash;
    sourceHashes: QuadChainHash[];
    sourceIds: string[];
  };
  compressionChain: {
    outputHash: QuadChainHash;
    tokensBefore: number;
    tokensAfter: number;
    tokensSaved: number;
    compressionRatio: number;
    omittedRanges: Array<QuadChainOmittedRange & { rangeHash: QuadChainHash }>;
  };
  proofChain: {
    answerReadinessScore: number;
    requiredEvidencePreserved: Array<QuadChainEvidenceObligation & { quoteHash?: QuadChainHash }>;
    answerConceptsPreserved: string[];
    openObligations: QuadChainOpenObligation[];
    accepted: boolean;
  };
  anchorChain: {
    merkleRoot: QuadChainHash;
    registryReceipt: string;
    anchoredAt: string | null;
  };
  validator: {
    name: "quad.chain.verifier";
    version: string;
    policyHash: QuadChainHash;
  };
};

export type BuildQuadChainCertificateInput = {
  runId: string;
  producer: string;
  consumer: string;
  compressedContext: string;
  sources: QuadChainSource[];
  requiredEvidence: QuadChainEvidenceObligation[];
  answerConcepts: string[];
  omittedRanges?: QuadChainOmittedRange[];
  openObligations?: QuadChainOpenObligation[];
  verifierVersion?: string;
  createdAt?: string;
};

export type QuadChainVerification =
  | { accepted: true; failures: [] }
  | { accepted: false; failures: string[] };

const DEFAULT_VERIFIER_VERSION = "0.1.0";

export function buildQuadChainCertificate(
  input: BuildQuadChainCertificateInput
): QuadChainCertificate {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const verifierVersion = input.verifierVersion ?? DEFAULT_VERIFIER_VERSION;
  const sourceHashes = input.sources.map((source) => hashJson(source));
  const inputHash = hashJson({ sources: input.sources.map((source, index) => ({
    id: source.id,
    hash: sourceHashes[index],
  })) });
  const outputHash = hashText(input.compressedContext);
  const omittedRanges = (input.omittedRanges ?? []).map((range) => ({
    ...range,
    rangeHash: hashJson(range),
  }));
  const requiredEvidencePreserved = input.requiredEvidence.map((evidence) => ({
    ...evidence,
    quoteHash: evidence.quote ? hashText(evidence.quote) : undefined,
  }));
  const tokensBefore = estimateTokens(stableStringify(input.sources));
  const tokensAfter = estimateTokens(input.compressedContext);
  const tokensSaved = Math.max(0, tokensBefore - tokensAfter);
  const answerReadinessScore = computeAnswerReadiness({
    requiredEvidence: input.requiredEvidence,
    answerConcepts: input.answerConcepts,
    compressedContext: input.compressedContext,
    openObligations: input.openObligations ?? [],
  });
  const accepted = answerReadinessScore === 1;
  const policyHash = hashJson({ verifier: "quad.chain.verifier", verifierVersion });
  const merkleRoot = hashJson({
    inputHash,
    outputHash,
    sourceHashes,
    omittedRangeHashes: omittedRanges.map((range) => range.rangeHash),
    policyHash,
  });
  const handoffId = `handoff_${shortHash(hashJson({
    runId: input.runId,
    producer: input.producer,
    consumer: input.consumer,
    outputHash,
  }))}`;
  const certificateId = `qchain_${shortHash(merkleRoot)}`;

  return {
    certificateId,
    handoffId,
    runId: input.runId,
    producer: input.producer,
    consumer: input.consumer,
    createdAt,
    sourceChain: {
      inputHash,
      sourceHashes,
      sourceIds: input.sources.map((source) => source.id),
    },
    compressionChain: {
      outputHash,
      tokensBefore,
      tokensAfter,
      tokensSaved,
      compressionRatio: tokensBefore === 0 ? 1 : round(tokensAfter / tokensBefore),
      omittedRanges,
    },
    proofChain: {
      answerReadinessScore,
      requiredEvidencePreserved,
      answerConceptsPreserved: input.answerConcepts,
      openObligations: input.openObligations ?? [],
      accepted,
    },
    anchorChain: {
      merkleRoot,
      registryReceipt: `local:${certificateId}`,
      anchoredAt: null,
    },
    validator: {
      name: "quad.chain.verifier",
      version: verifierVersion,
      policyHash,
    },
  };
}

export function verifyQuadChainCertificate(
  certificate: QuadChainCertificate,
  expected: {
    compressedContext: string;
    sources: QuadChainSource[];
    requiredEvidence: QuadChainEvidenceObligation[];
    verifierVersion?: string;
  }
): QuadChainVerification {
  const failures: string[] = [];
  const sourceHashes = expected.sources.map((source) => hashJson(source));
  const inputHash = hashJson({ sources: expected.sources.map((source, index) => ({
    id: source.id,
    hash: sourceHashes[index],
  })) });
  const outputHash = hashText(expected.compressedContext);
  const requiredEvidenceIds = new Set(expected.requiredEvidence.filter((item) => item.required).map((item) => item.id));
  const preservedEvidenceIds = new Set(
    certificate.proofChain.requiredEvidencePreserved.filter((item) => item.required).map((item) => item.id)
  );
  const verifierVersion = expected.verifierVersion ?? DEFAULT_VERIFIER_VERSION;

  if (certificate.sourceChain.inputHash !== inputHash) failures.push("input_hash_mismatch");
  if (stableStringify(certificate.sourceChain.sourceHashes) !== stableStringify(sourceHashes)) {
    failures.push("source_hash_mismatch");
  }
  if (certificate.compressionChain.outputHash !== outputHash) failures.push("output_hash_mismatch");
  if (certificate.validator.version !== verifierVersion) failures.push("stale_verifier_version");
  if (!certificate.anchorChain.registryReceipt) failures.push("missing_registry_receipt");

  for (const id of requiredEvidenceIds) {
    if (!preservedEvidenceIds.has(id)) failures.push(`missing_required_evidence:${id}`);
  }

  for (const evidence of certificate.proofChain.requiredEvidencePreserved) {
    if (evidence.required && !evidence.quoteHash) failures.push(`missing_quote_hash:${evidence.id}`);
  }

  for (const range of certificate.compressionChain.omittedRanges) {
    if (!range.reason.trim()) failures.push(`missing_omission_reason:${range.rangeId}`);
    if (range.rangeHash !== hashJson({
      sourceId: range.sourceId,
      rangeId: range.rangeId,
      reason: range.reason,
      content: range.content,
    })) {
      failures.push(`omitted_range_hash_mismatch:${range.rangeId}`);
    }
  }

  const recomputedRoot = hashJson({
    inputHash: certificate.sourceChain.inputHash,
    outputHash: certificate.compressionChain.outputHash,
    sourceHashes: certificate.sourceChain.sourceHashes,
    omittedRangeHashes: certificate.compressionChain.omittedRanges.map((range) => range.rangeHash),
    policyHash: certificate.validator.policyHash,
  });
  if (certificate.anchorChain.merkleRoot !== recomputedRoot) failures.push("merkle_root_mismatch");

  if (!certificate.proofChain.accepted) failures.push("proof_chain_rejected");

  return failures.length === 0 ? { accepted: true, failures: [] } : { accepted: false, failures };
}

export function estimateTokens(value: string): number {
  if (!value.trim()) return 0;
  return Math.ceil(value.trim().length / 4);
}

export function hashText(value: string): QuadChainHash {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

export function hashJson(value: unknown): QuadChainHash {
  return hashText(stableStringify(value));
}

function computeAnswerReadiness(input: {
  requiredEvidence: QuadChainEvidenceObligation[];
  answerConcepts: string[];
  compressedContext: string;
  openObligations: QuadChainOpenObligation[];
}): number {
  const required = input.requiredEvidence.filter((item) => item.required);
  const lower = input.compressedContext.toLowerCase();
  const evidenceReady = required.every((item) => !item.quote || lower.includes(item.quote.toLowerCase()));
  const conceptsReady = input.answerConcepts.every((concept) => lower.includes(concept.toLowerCase()));
  const obligationsReady = input.openObligations.length === 0;
  return evidenceReady && conceptsReady && obligationsReady ? 1 : 0;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

function shortHash(hash: QuadChainHash): string {
  return hash.replace("sha256:", "").slice(0, 12);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
