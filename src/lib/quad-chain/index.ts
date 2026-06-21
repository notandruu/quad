import { createHash } from "crypto";

export type QuadChainHash = `sha256:${string}`;

export type QuadChainPacketType =
  | "audit_event"
  | "audit_report"
  | "finding"
  | "brain_memory_write"
  | "chat_answer"
  | "voice_transcript"
  | "agent_handoff"
  | "trust_packet"
  | "approval"
  | "connector_action";

export type QuadChainVisibility = "public" | "internal" | "restricted";

export type QuadChainSource = {
  id: string;
  kind: "event" | "artifact" | "finding" | "memory" | "approval" | "tool_result" | "transcript";
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

export type QuadChainPacket = {
  id: string;
  type: QuadChainPacketType;
  orgId: string;
  runId: string;
  producer: string;
  consumer: string;
  sources: QuadChainSource[];
  evidence: QuadChainEvidenceObligation[];
  omittedRanges: QuadChainOmittedRange[];
  output: string;
  certificate: QuadChainCertificate;
  verification: QuadChainVerification;
  visibility: QuadChainVisibility;
  createdAt: string;
};

export type QuadChainPacketSummary = {
  id: string;
  type: QuadChainPacketType;
  orgId: string;
  runId: string;
  certificateId: string;
  handoffId: string;
  accepted: boolean;
  failures: string[];
  evidencePreserved: number;
  evidenceRequired: number;
  tokensBefore: number;
  tokensAfter: number;
  tokensSaved: number;
  compressionRatio: number;
  visibility: QuadChainVisibility;
  createdAt: string;
};

export type CreateQuadChainPacketInput = {
  type: QuadChainPacketType;
  orgId: string;
  runId: string;
  producer: string;
  consumer: string;
  sources: QuadChainSource[];
  evidence?: QuadChainEvidenceObligation[];
  omittedRanges?: QuadChainOmittedRange[];
  output: string;
  answerConcepts?: string[];
  openObligations?: QuadChainOpenObligation[];
  visibility?: QuadChainVisibility;
  verifierVersion?: string;
  createdAt?: string;
};

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

export function createQuadChainPacket(input: CreateQuadChainPacketInput): QuadChainPacket {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const evidence = input.evidence ?? [];
  const omittedRanges = input.omittedRanges ?? [];
  const certificate = buildQuadChainCertificate({
    runId: input.runId,
    producer: input.producer,
    consumer: input.consumer,
    compressedContext: input.output,
    sources: input.sources,
    requiredEvidence: evidence,
    answerConcepts: input.answerConcepts ?? inferAnswerConcepts(input.output),
    omittedRanges,
    openObligations: input.openObligations,
    verifierVersion: input.verifierVersion,
    createdAt,
  });
  const verification = verifyQuadChainCertificate(certificate, {
    compressedContext: input.output,
    sources: input.sources,
    requiredEvidence: evidence,
    verifierVersion: input.verifierVersion,
  });
  const id = `qpacket_${shortHash(hashJson({
    orgId: input.orgId,
    runId: input.runId,
    type: input.type,
    certificateId: certificate.certificateId,
  }))}`;

  return {
    id,
    type: input.type,
    orgId: input.orgId,
    runId: input.runId,
    producer: input.producer,
    consumer: input.consumer,
    sources: input.sources,
    evidence,
    omittedRanges,
    output: input.output,
    certificate,
    verification,
    visibility: input.visibility ?? "internal",
    createdAt,
  };
}

export function verifyQuadChainPacket(packet: QuadChainPacket): QuadChainVerification {
  return verifyQuadChainCertificate(packet.certificate, {
    compressedContext: packet.output,
    sources: packet.sources,
    requiredEvidence: packet.evidence,
    verifierVersion: packet.certificate.validator.version,
  });
}

export function summarizeQuadChainPacket(packet: QuadChainPacket): QuadChainPacketSummary {
  const required = packet.evidence.filter((item) => item.required).length;
  const preserved = packet.certificate.proofChain.requiredEvidencePreserved.filter((item) => item.required).length;
  return {
    id: packet.id,
    type: packet.type,
    orgId: packet.orgId,
    runId: packet.runId,
    certificateId: packet.certificate.certificateId,
    handoffId: packet.certificate.handoffId,
    accepted: packet.verification.accepted,
    failures: packet.verification.accepted ? [] : packet.verification.failures,
    evidencePreserved: preserved,
    evidenceRequired: required,
    tokensBefore: packet.certificate.compressionChain.tokensBefore,
    tokensAfter: packet.certificate.compressionChain.tokensAfter,
    tokensSaved: packet.certificate.compressionChain.tokensSaved,
    compressionRatio: packet.certificate.compressionChain.compressionRatio,
    visibility: packet.visibility,
    createdAt: packet.createdAt,
  };
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

function inferAnswerConcepts(output: string): string[] {
  const words = output
    .toLowerCase()
    .match(/[a-z][a-z0-9_-]{3,}/g);
  if (!words) return [];
  return [...new Set(words)].slice(0, 4);
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
