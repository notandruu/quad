import { describe, expect, it } from "vitest";
import {
  buildQuadChainCertificate,
  createQuadChainPacket,
  summarizeQuadChainPacket,
  verifyQuadChainCertificate,
  verifyQuadChainPacket,
  type QuadChainCertificate,
  type QuadChainEvidenceObligation,
  type QuadChainSource,
} from ".";

const sources: QuadChainSource[] = [
  {
    id: "finding_1",
    kind: "finding",
    content: {
      quote: "MFA is enforced for all production access",
      source: "policy.md",
      eval: "grounded",
    },
  },
  {
    id: "event_1",
    kind: "event",
    content: {
      type: "answer.evaluated",
      result: "passed",
    },
  },
];

const requiredEvidence: QuadChainEvidenceObligation[] = [
  {
    id: "mfa_policy",
    sourceId: "finding_1",
    quote: "MFA is enforced for all production access",
    required: true,
  },
];

const compressedContext = [
  "Security answer: MFA is enforced for all production access.",
  "Control concept: mfa.",
].join("\n");

describe("quad chain", () => {
  it("accepts a valid compressed handoff", () => {
    const cert = buildQuadChainCertificate({
      runId: "run_1",
      producer: "quad.enterprise_proof_agent",
      consumer: "quad.publisher_agent",
      compressedContext,
      sources,
      requiredEvidence,
      answerConcepts: ["mfa"],
      omittedRanges: [
        {
          sourceId: "event_1",
          rangeId: "event_payload_debug",
          reason: "debug status was not needed for the downstream answer.",
          content: { verbose: true },
        },
      ],
      createdAt: "2026-06-20T00:00:00.000Z",
    });

    expect(cert.proofChain.accepted).toBe(true);
    expect(cert.compressionChain.tokensSaved).toBeGreaterThan(0);
    expect(cert.proofChain.requiredEvidencePreserved).toHaveLength(1);
    expect(verifyQuadChainCertificate(cert, { compressedContext, sources, requiredEvidence })).toEqual({
      accepted: true,
      failures: [],
    });
  });

  it("rejects a tampered compressed packet", () => {
    const cert = buildQuadChainCertificate({
      runId: "run_1",
      producer: "quad.enterprise_proof_agent",
      consumer: "quad.publisher_agent",
      compressedContext,
      sources,
      requiredEvidence,
      answerConcepts: ["mfa"],
    });

    const result = verifyQuadChainCertificate(cert, {
      compressedContext: "Security answer: we probably have access controls.",
      sources,
      requiredEvidence,
    });

    expect(result.accepted).toBe(false);
    expect(result.failures).toContain("output_hash_mismatch");
  });

  it("rejects dropped required evidence", () => {
    const cert = buildQuadChainCertificate({
      runId: "run_1",
      producer: "quad.enterprise_proof_agent",
      consumer: "quad.publisher_agent",
      compressedContext: "Control concept: mfa.",
      sources,
      requiredEvidence,
      answerConcepts: ["mfa"],
    });

    expect(cert.proofChain.accepted).toBe(false);
    const result = verifyQuadChainCertificate(cert, { compressedContext: "Control concept: mfa.", sources, requiredEvidence });
    expect(result.accepted).toBe(false);
    expect(result.failures).toContain("proof_chain_rejected");
  });

  it("rejects a stale verifier version", () => {
    const cert = buildQuadChainCertificate({
      runId: "run_1",
      producer: "quad.enterprise_proof_agent",
      consumer: "quad.publisher_agent",
      compressedContext,
      sources,
      requiredEvidence,
      answerConcepts: ["mfa"],
      verifierVersion: "0.0.1",
    });

    const result = verifyQuadChainCertificate(cert, {
      compressedContext,
      sources,
      requiredEvidence,
      verifierVersion: "0.1.0",
    });

    expect(result.accepted).toBe(false);
    expect(result.failures).toContain("stale_verifier_version");
  });

  it("rejects a tampered merkle root", () => {
    const cert = buildQuadChainCertificate({
      runId: "run_1",
      producer: "quad.enterprise_proof_agent",
      consumer: "quad.publisher_agent",
      compressedContext,
      sources,
      requiredEvidence,
      answerConcepts: ["mfa"],
    });
    const tampered: QuadChainCertificate = {
      ...cert,
      anchorChain: { ...cert.anchorChain, merkleRoot: "sha256:bad" },
    };

    const result = verifyQuadChainCertificate(tampered, { compressedContext, sources, requiredEvidence });
    expect(result.accepted).toBe(false);
    expect(result.failures).toContain("merkle_root_mismatch");
  });

  it("creates an accepted platform packet and compact summary", () => {
    const packet = createQuadChainPacket({
      type: "chat_answer",
      orgId: "org_1",
      runId: "run_1",
      producer: "quad.chat",
      consumer: "quad.dashboard",
      sources,
      evidence: requiredEvidence,
      output: compressedContext,
      answerConcepts: ["mfa"],
      visibility: "restricted",
      createdAt: "2026-06-20T00:00:00.000Z",
    });

    expect(packet.id).toMatch(/^qpacket_/);
    expect(verifyQuadChainPacket(packet)).toEqual({ accepted: true, failures: [] });
    expect(summarizeQuadChainPacket(packet)).toMatchObject({
      id: packet.id,
      type: "chat_answer",
      accepted: true,
      evidencePreserved: 1,
      evidenceRequired: 1,
      visibility: "restricted",
    });
    expect(JSON.stringify(summarizeQuadChainPacket(packet))).not.toContain("MFA is enforced");
  });
});
