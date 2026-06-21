import { createQuadChainPacket, summarizeQuadChainPacket, type QuadChainPacketSummary } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
import type { ActiveTool } from "@/lib/metaregistry";
import type { QuadCoreContext } from ".";

export type QuadCoreAgentStepKind = "plan" | "tool_dispatch" | "observation" | "final";
export type QuadCoreAgentToolStatus = "ready" | "blocked" | "skipped";

export type QuadCoreAgentToolCall = {
  id: string;
  name: string;
  kind: ActiveTool["kind"];
  status: QuadCoreAgentToolStatus;
  approvalMode: ActiveTool["approvalMode"];
  scopes: string[];
  sponsor?: ActiveTool["sponsor"];
  reason: string;
};

export type QuadCoreAgentStep = {
  index: number;
  kind: QuadCoreAgentStepKind;
  title: string;
  summary: string;
  toolCalls: QuadCoreAgentToolCall[];
};

export type QuadCoreAgentLoopTrace = {
  runId: string;
  surface: QuadCoreContext["surface"];
  intent: QuadCoreContext["intent"];
  turnBudget: number;
  turnsUsed: number;
  selectedToolIds: string[];
  blockedToolIds: string[];
  steps: QuadCoreAgentStep[];
  quadChain?: QuadChainPacketSummary;
};

const DEFAULT_TURN_BUDGET = 4;

export function buildQuadCoreAgentLoop(
  context: QuadCoreContext,
  input: { finalMessage?: string; turnBudget?: number } = {}
): QuadCoreAgentLoopTrace {
  const toolCalls = [
    ...context.selectedTools.map((tool) => readyToolCall(tool)),
    ...context.missingCapabilities.map((tool) => ({
      id: tool.id,
      name: tool.id,
      kind: "connector" as const,
      status: "blocked" as const,
      approvalMode: "none" as const,
      scopes: [],
      reason: tool.reason,
    })),
  ];
  const steps: QuadCoreAgentStep[] = [
    {
      index: 1,
      kind: "plan",
      title: "classify request",
      summary: `classified ${context.surface} request as ${context.intent}.`,
      toolCalls: [],
    },
    {
      index: 2,
      kind: "tool_dispatch",
      title: "assemble tool catalog",
      summary: toolCalls.length > 0
        ? `prepared ${context.selectedTools.length} active tools and ${context.missingCapabilities.length} blocked capabilities.`
        : "no external tools were required for this turn.",
      toolCalls,
    },
    {
      index: 3,
      kind: "observation",
      title: "load verified context",
      summary: `loaded ${context.memories.length} memories and ${context.verifiedContext.length} verified receipts.`,
      toolCalls: [],
    },
    {
      index: 4,
      kind: "final",
      title: "return answer",
      summary: input.finalMessage
        ? summarizeForTrace(input.finalMessage)
        : "ready to synthesize the response from the assembled context.",
      toolCalls: [],
    },
  ];

  return {
    runId: context.runId,
    surface: context.surface,
    intent: context.intent,
    turnBudget: input.turnBudget ?? DEFAULT_TURN_BUDGET,
    turnsUsed: steps.length,
    selectedToolIds: context.selectedTools.map((tool) => tool.id),
    blockedToolIds: context.missingCapabilities.map((tool) => tool.id),
    steps,
  };
}

export async function saveQuadCoreAgentLoopReceipt(
  context: QuadCoreContext,
  trace: QuadCoreAgentLoopTrace
): Promise<QuadChainPacketSummary> {
  const packet = createQuadChainPacket({
    orgId: context.orgId,
    runId: context.runId,
    type: "agent_handoff",
    producer: "quad.core.agent_loop",
    consumer: `quad.${context.surface}`,
    output: [
      `agent loop tool dispatch for ${context.surface}.`,
      `intent ${context.intent}.`,
      `tool dispatch selected ${trace.selectedToolIds.join(", ") || "none"}.`,
      `blocked tools ${trace.blockedToolIds.join(", ") || "none"}.`,
      `turns used ${trace.turnsUsed} of ${trace.turnBudget}.`,
    ].join("\n"),
    answerConcepts: ["agent", "loop", "tool", "dispatch", context.intent],
    sources: [
      {
        id: "agent_loop_trace",
        kind: "event",
        content: {
          surface: trace.surface,
          intent: trace.intent,
          turnBudget: trace.turnBudget,
          turnsUsed: trace.turnsUsed,
          selectedToolIds: trace.selectedToolIds,
          blockedToolIds: trace.blockedToolIds,
          stepKinds: trace.steps.map((step) => step.kind),
        },
      },
    ],
    visibility: "internal",
  });
  const saved = await saveQuadChainPacket(packet);
  return summarizeQuadChainPacket(packet) ?? saved.summary;
}

function readyToolCall(tool: ActiveTool): QuadCoreAgentToolCall {
  return {
    id: tool.id,
    name: tool.name,
    kind: tool.kind,
    status: tool.approvalMode === "human_approval" || tool.approvalMode === "admin_approval" ? "skipped" : "ready",
    approvalMode: tool.approvalMode,
    scopes: tool.scopes,
    sponsor: tool.sponsor,
    reason: tool.approvalMode === "human_approval" || tool.approvalMode === "admin_approval"
      ? "write-capable tools require approval before execution."
      : "tool is active for this runtime turn.",
  };
}

function summarizeForTrace(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= 180) return text;
  return `${text.slice(0, 177)}...`;
}
