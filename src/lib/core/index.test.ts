import { describe, expect, it, vi } from "vitest";
import { DEMO_ORG_ID } from "@/data/seed";
import { chiefOfStaff } from "@/lib/employees";
import type { RetrievedMemoryWithPacket } from "@/lib/brain";
import {
  buildQuadCoreContext,
  createQuadCoreReceipt,
  selectToolsForIntent,
  selectToolsForRuntime,
} from ".";

const memory: RetrievedMemoryWithPacket = {
  memory: {
    id: "mem_security",
    orgId: DEMO_ORG_ID,
    sourceId: "doc_security",
    sourceType: "doc",
    title: "Security overview",
    content: "Quad keeps private customer context tenant-scoped.",
    summary: "Tenant-scoped customer context.",
    entities: ["security", "tenant"],
    embedding: [],
    confidence: 0.94,
    permissions: ["read"],
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
    evidence: [{ quote: "private customer context tenant-scoped" }],
  },
  quadChain: {
    id: "qpacket_memory",
    type: "brain_memory_write",
    orgId: DEMO_ORG_ID,
    runId: "run_memory",
    certificateId: "qchain_memory",
    handoffId: "handoff_memory",
    accepted: true,
    failures: [],
    evidencePreserved: 1,
    evidenceRequired: 1,
    tokensBefore: 20,
    tokensAfter: 12,
    tokensSaved: 8,
    compressionRatio: 0.6,
    visibility: "internal",
    createdAt: "2026-06-20T00:00:00.000Z",
  },
  metadata: {
    visibility: "company",
    ownerUserId: null,
    teamIds: [],
    validationStatus: "approved",
    sourceUpdatedAt: "2026-06-20T00:00:00.000Z",
    staleAfter: null,
    freshness: "unknown",
    relationships: [],
  },
};

describe("quad core", () => {
  it("builds one runtime context for surface, memory, tools, and approval policy", async () => {
    const publish = vi.fn(async () => undefined);
    const context = await buildQuadCoreContext({
      orgId: DEMO_ORG_ID,
      employee: chiefOfStaff,
      text: "audit https://example.com for missing security proof",
      surface: "chat",
      runId: "run_core_test",
      env: {
        BROWSERBASE_API_KEY: "bb_test",
        BROWSERBASE_PROJECT_ID: "proj_test",
        PHOENIX_COLLECTOR_ENDPOINT: "https://phoenix.example.test",
        SENTRY_DSN: "https://sentry.example.test",
      },
      retrieve: async () => [memory],
      publish,
    });

    expect(context.intent).toBe("website_audit");
    expect(context.detectedUrl).toBe("https://example.com");
    expect(context.memories).toHaveLength(1);
    expect(context.verifiedContext.map((packet) => packet.certificateId)).toEqual(["qchain_memory"]);
    expect(context.selectedTools.map((tool) => tool.id)).toContain("browserbase.read_browser");
    expect(context.selectedTools.map((tool) => tool.id)).toContain("quad.chain_verifier");
    expect(context.toolRouting.eagerTools.map((route) => route.tool.id)).toEqual(
      expect.arrayContaining(["browserbase.read_browser", "quad.chain_verifier"])
    );
    expect(context.toolRouting.deferredTools.map((route) => route.tool.id)).toEqual(
      expect.arrayContaining(["arize.phoenix", "sentry.reliability"])
    );
    expect(context.missingCapabilities.map((tool) => tool.id)).toContain("quad.company_brain");
    expect(context.permission.allowed).toBe(true);
    expect(context.events.map((event) => event.type)).toEqual([
      "core.input_received",
      "core.intent_classified",
      "core.context_loaded",
      "core.capabilities_selected",
      "core.permission_checked",
    ]);
    expect(publish).toHaveBeenCalledTimes(5);
  });

  it("selects only active tools for an intent", () => {
    const selected = selectToolsForIntent("create_task", [
      {
        id: "task.publisher",
        name: "Task publisher",
        kind: "publisher",
        approvalMode: "human_approval",
        scopes: ["tasks:create"],
      },
      {
        id: "browserbase.read_browser",
        name: "Browserbase read browser",
        kind: "connector",
        approvalMode: "none",
        scopes: ["browser:read"],
      },
    ]);

    expect(selected.map((tool) => tool.id)).toEqual(["task.publisher"]);
  });

  it("adds fetch bridge capability for external agent surfaces", () => {
    const selected = selectToolsForRuntime("website_audit", "fetch_agent", [
      {
        id: "browserbase.read_browser",
        name: "Browserbase read browser",
        kind: "connector",
        approvalMode: "none",
        scopes: ["browser:read"],
      },
      {
        id: "fetch.agent_bridge",
        name: "Fetch agent bridge",
        kind: "surface",
        approvalMode: "none",
        scopes: ["agent:run"],
      },
    ]);

    expect(selected.map((tool) => tool.id)).toEqual([
      "browserbase.read_browser",
      "fetch.agent_bridge",
    ]);
  });

  it("degrades to empty context when retrieval fails", async () => {
    const context = await buildQuadCoreContext({
      orgId: DEMO_ORG_ID,
      employee: chiefOfStaff,
      text: "what changed in the last call?",
      surface: "voice",
      runId: "run_context_failure_test",
      env: {},
      retrieve: async () => {
        throw new Error("embedding provider unavailable");
      },
      publish: async () => undefined,
    });

    expect(context.memories).toEqual([]);
    expect(context.verifiedContext).toEqual([]);
    expect(context.events.map((event) => event.type)).toContain("core.context_failed");
    expect(context.events.map((event) => event.type)).toContain("core.context_loaded");
  });

  it("creates accepted proof receipts for runtime answers without exposing raw reasoning", async () => {
    const context = await buildQuadCoreContext({
      orgId: DEMO_ORG_ID,
      employee: chiefOfStaff,
      text: "what does quad know about security?",
      surface: "chat",
      runId: "run_receipt_test",
      env: {},
      retrieve: async () => [memory],
      publish: async () => undefined,
    });

    const packet = createQuadCoreReceipt({
      context,
      output: "Quad keeps private customer context tenant-scoped.",
    });

    expect(packet.type).toBe("chat_answer");
    expect(packet.verification.accepted).toBe(true);
    expect(packet.certificate.proofChain.requiredEvidencePreserved).toHaveLength(1);
    expect(packet.output).toContain("intent: company_question");
    expect(packet.output).not.toContain("chain-of-thought");
  });

  it("creates restricted voice transcript receipts through the same runtime substrate", async () => {
    const context = await buildQuadCoreContext({
      orgId: DEMO_ORG_ID,
      employee: chiefOfStaff,
      text: "our soc 2 audit is complete",
      surface: "voice",
      runId: "run_voice_receipt_test",
      env: {},
      retrieve: async () => [],
      publish: async () => undefined,
    });

    const packet = createQuadCoreReceipt({
      context,
      type: "voice_transcript",
      output: "voice transcript: our soc 2 audit is complete",
      producer: "quad.voice.deepgram",
      consumer: "quad.chat",
      sources: [
        {
          id: "voice_audio",
          kind: "transcript",
          content: {
            mimeType: "audio/webm",
            size: 2048,
            model: "nova-3",
          },
        },
      ],
      answerConcepts: ["voice", "transcript"],
      visibility: "restricted",
    });

    expect(packet.type).toBe("voice_transcript");
    expect(packet.visibility).toBe("restricted");
    expect(packet.consumer).toBe("quad.chat");
    expect(packet.verification.accepted).toBe(true);
  });
});
