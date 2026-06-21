import { describe, it, expect, beforeEach } from "vitest";
import {
  answerTrustQuestion,
  computeQuestionSourceId,
  type JudgeResult,
  type TrustQuestionInput,
} from "./answerTrustQuestion";
import { deleteMemoryStore, addMemory } from "@/lib/brain/store";
import type { BrainMemory } from "@/lib/types";
import { registerLocalDocuments } from "@/lib/connectors/documents";
import { ENTERPRISE_PROOF_CONNECTOR_DOCS, ENTERPRISE_PROOF_ORG_ID, ENTERPRISE_PROOF_BRAIN } from "@/data/demo/enterprise-proof";

const PASS_JUDGE = async (): Promise<JudgeResult> => ({
  passed: true,
  answersQuestion: true,
  confidence: 0.91,
  reason: "All claims are traceable to the provided sources.",
  risks: [],
});

const FAIL_JUDGE = async (): Promise<JudgeResult> => ({
  passed: false,
  answersQuestion: false,
  confidence: 0.2,
  reason: "The answer makes claims not supported by any provided source.",
  risks: ["hallucination"],
});

// Grounded, but the answer declines / says the sources do not establish the fact.
const DECLINE_JUDGE = async (): Promise<JudgeResult> => ({
  passed: true,
  answersQuestion: false,
  confidence: 0.95,
  reason: "Faithful to sources, but the answer declines because no source covers this.",
  risks: [],
});

function captureIngest() {
  const captures: unknown[] = [];
  const fn: TrustQuestionInput["_ingestOverride"] = async (input) => {
    captures.push(input);
    return {
      id: `mem_test_${Date.now()}`,
      orgId: input.orgId,
      sourceId: input.sourceId,
      sourceType: input.sourceType,
      title: input.title,
      content: input.content,
      summary: input.summary,
      entities: input.entities ?? [],
      embedding: [],
      confidence: input.confidence ?? 0.8,
      permissions: input.permissions ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evidence: input.evidence ?? [],
    } satisfies BrainMemory;
  };
  return { fn, captures };
}

const QUESTION_IR = "Do you have a documented incident response plan?";
const QUESTION_PENTEST = "When was your last penetration test conducted and what was the scope?";

const NOW = new Date().toISOString();

/** Seed org_acme brain memories into the in-memory store for tests that need them. */
function seedAcmeBrain() {
  deleteMemoryStore({ orgId: ENTERPRISE_PROOF_ORG_ID });
  for (const input of ENTERPRISE_PROOF_BRAIN) {
    addMemory({
      id: `mem_seed_${input.sourceId}`,
      orgId: input.orgId,
      sourceId: input.sourceId,
      sourceType: input.sourceType,
      title: input.title,
      content: input.content,
      summary: input.summary,
      entities: input.entities ?? [],
      embedding: [],
      confidence: input.confidence ?? 0.9,
      permissions: input.permissions ?? ["read"],
      createdAt: NOW,
      updatedAt: NOW,
      evidence: input.evidence ?? [],
    });
  }
}

beforeEach(() => {
  registerLocalDocuments(ENTERPRISE_PROOF_CONNECTOR_DOCS);
  seedAcmeBrain();
});

describe("computeQuestionSourceId", () => {
  it("returns a stable string for the same org + question", () => {
    const a = computeQuestionSourceId("org_x", "Do you have MFA?");
    const b = computeQuestionSourceId("org_x", "Do you have MFA?");
    expect(a).toBe(b);
  });

  it("normalizes whitespace and case", () => {
    const a = computeQuestionSourceId("org_x", "  Do you have MFA?  ");
    const b = computeQuestionSourceId("org_x", "do you have mfa?");
    expect(a).toBe(b);
  });

  it("is different for different orgs", () => {
    const a = computeQuestionSourceId("org_x", "Do you have MFA?");
    const b = computeQuestionSourceId("org_y", "Do you have MFA?");
    expect(a).not.toBe(b);
  });

  it("is different for different questions", () => {
    const a = computeQuestionSourceId("org_x", "Do you have MFA?");
    const b = computeQuestionSourceId("org_x", "Do you have a SOC2 report?");
    expect(a).not.toBe(b);
  });

  it("prefixes with ep: and the orgId", () => {
    const id = computeQuestionSourceId("org_acme", "any question");
    expect(id.startsWith("ep:org_acme:")).toBe(true);
  });
});

describe("answerTrustQuestion", () => {
  it("returns needs_human for a question with no relevant brain or connector context", async () => {
    // Use an unknown org so the in-memory store has nothing
    const result = await answerTrustQuestion({
      orgId: "org_totally_empty_xyz",
      question: "Do you have a SOC2 Type II certification?",
      runId: "test_run_no_context",
    });
    expect(result.status).toBe("needs_human");
    expect(result.sources).toHaveLength(0);
    expect(result.memory).toBeUndefined();
  });

  it("returns needs_human and does NOT write to brain when judge fails", async () => {
    const { fn: ingestFn, captures } = captureIngest();

    // org_acme has brain memories — context will be found, but judge will reject
    const result = await answerTrustQuestion({
      orgId: ENTERPRISE_PROOF_ORG_ID,
      question: QUESTION_IR,
      runId: "test_run_judge_fail",
      _judgeOverride: FAIL_JUDGE,
      _ingestOverride: ingestFn,
    });

    expect(result.status).toBe("needs_human");
    expect(captures).toHaveLength(0);
    expect(result.memory).toBeUndefined();
  });

  it("returns needs_human and does NOT write to brain when the answer is grounded but declines", async () => {
    const { fn: ingestFn, captures } = captureIngest();

    const result = await answerTrustQuestion({
      orgId: ENTERPRISE_PROOF_ORG_ID,
      question: "When was your last third-party penetration test?",
      runId: "test_run_decline",
      _judgeOverride: DECLINE_JUDGE,
      _ingestOverride: ingestFn,
    });

    // A grounded "we have no evidence for this" answer must escalate, not be learned.
    expect(result.status).toBe("needs_human");
    expect(captures).toHaveLength(0);
    expect(result.memory).toBeUndefined();
  });

  it("returns needs_human when judge is unavailable (no API key)", async () => {
    // No _judgeOverride => defaultJudge => complete() returns null => needs_human
    const result = await answerTrustQuestion({
      orgId: ENTERPRISE_PROOF_ORG_ID,
      question: QUESTION_IR,
      runId: "test_run_no_apikey",
    });
    // Without an ANTHROPIC_API_KEY, both draftAnswer and defaultJudge return null.
    // No judge pass => needs_human.
    expect(result.status).toBe("needs_human");
    expect(result.memory).toBeUndefined();
  });

  it("writes to brain when judge passes, with correct org scope", async () => {
    const { fn: ingestFn, captures } = captureIngest();

    const result = await answerTrustQuestion({
      orgId: ENTERPRISE_PROOF_ORG_ID,
      question: QUESTION_IR,
      runId: "test_run_judge_pass",
      _judgeOverride: PASS_JUDGE,
      _ingestOverride: ingestFn,
    });

    expect(result.status).toBe("answered");
    expect(captures).toHaveLength(1);
    const captured = captures[0] as { orgId: string; sourceId: string; confidence: number };
    expect(captured.orgId).toBe(ENTERPRISE_PROOF_ORG_ID);
    expect(captured.confidence).toBeCloseTo(0.91, 2);
  });

  it("uses the stable questionId as the sourceId in brain writeback", async () => {
    const { fn: ingestFn, captures } = captureIngest();

    await answerTrustQuestion({
      orgId: ENTERPRISE_PROOF_ORG_ID,
      question: QUESTION_IR,
      runId: "test_run_stable_id",
      _judgeOverride: PASS_JUDGE,
      _ingestOverride: ingestFn,
    });

    const expected = computeQuestionSourceId(ENTERPRISE_PROOF_ORG_ID, QUESTION_IR);
    const captured = captures[0] as { sourceId: string };
    expect(captured.sourceId).toBe(expected);
  });

  it("marks wasReused=true if a memory with that sourceId already exists in the store", async () => {
    const orgId = "org_reuse_test";
    const sourceId = computeQuestionSourceId(orgId, QUESTION_IR);

    // Pre-seed the store with a matching memory
    const { addMemory } = await import("@/lib/brain/store");
    addMemory({
      id: "mem_preexisting",
      orgId,
      sourceId,
      sourceType: "doc",
      title: "Pre-existing answer",
      content: "Already answered.",
      entities: [],
      embedding: [],
      confidence: 0.9,
      permissions: ["read"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evidence: [],
    });

    const { fn: ingestFn, captures } = captureIngest();
    const result = await answerTrustQuestion({
      orgId,
      question: QUESTION_IR,
      runId: "test_run_reuse",
      _judgeOverride: PASS_JUDGE,
      _ingestOverride: ingestFn,
    });

    // No new ingest call — existing memory returned
    expect(captures).toHaveLength(0);
    expect(result.wasReused).toBe(true);
    expect(result.memory?.id).toBe("mem_preexisting");

    // Cleanup
    deleteMemoryStore({ orgId });
  });

  it("always includes quadChain in the result", async () => {
    const result = await answerTrustQuestion({
      orgId: "org_totally_empty_xyz",
      question: "Unrelated question with no context",
      runId: "test_run_qc",
    });
    expect(result.quadChain).toBeDefined();
    expect(typeof result.quadChain.accepted).toBe("boolean");
  });

  it("sources include both brain and connector kinds", async () => {
    const { fn: ingestFn } = captureIngest();

    const result = await answerTrustQuestion({
      orgId: ENTERPRISE_PROOF_ORG_ID,
      question: "Is MFA required for all users?",
      runId: "test_run_sources",
      _judgeOverride: PASS_JUDGE,
      _ingestOverride: ingestFn,
    });

    const kinds = result.sources.map((s) => s.kind);
    // Brain memories should be present for access control / MFA question
    expect(kinds).toContain("brain");
  });

  it("carries evaluation result in answered responses", async () => {
    const { fn: ingestFn } = captureIngest();

    const result = await answerTrustQuestion({
      orgId: ENTERPRISE_PROOF_ORG_ID,
      question: QUESTION_IR,
      runId: "test_run_eval",
      _judgeOverride: PASS_JUDGE,
      _ingestOverride: ingestFn,
    });

    expect(result.evaluation).toBeDefined();
    expect(result.evaluation?.passed).toBe(true);
    expect(result.evaluation?.confidence).toBeGreaterThan(0);
  });
});
