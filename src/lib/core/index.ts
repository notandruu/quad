import type { QuadEmployee, Intent, BrainMemory } from "@/lib/types";
import { retrieveMemoriesWithPackets, type RetrievedMemoryWithPacket } from "@/lib/brain";
import type { BrainMemoryRequester } from "@/lib/brain/permissions";
import { getMemoryMetadata } from "@/lib/brain/metadata";
import { summarizeCapabilities, type ActiveTool, type CapabilitySummary } from "@/lib/metaregistry";
import {
  createQuadChainPacket,
  summarizeQuadChainPacket,
  type QuadChainOpenObligation,
  type QuadChainPacket,
  type QuadChainPacketSummary,
  type QuadChainPacketType,
  type QuadChainSource,
  type QuadChainVisibility,
} from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
import { publishAuditEvent } from "@/lib/redis";
import { classifyIntent, extractUrl } from "@/lib/runtime/intent";
import { checkPermission, type PermissionDecision } from "@/lib/runtime/permissions";

export type QuadCoreSurface = "dashboard" | "chat" | "voice" | "fetch_agent" | "worker";

export type QuadCoreEvent = {
  type: string;
  payload: Record<string, unknown>;
};

export type QuadCoreContextInput = {
  orgId: string;
  employee: QuadEmployee;
  text: string;
  surface: QuadCoreSurface;
  runId?: string;
  pinnedUrl?: string;
  hasActiveAudit?: boolean;
  contextMode?: "load" | "skip";
  requester?: BrainMemoryRequester;
  env?: Record<string, string | undefined>;
  retrieve?: (input: {
    orgId: string;
    query: string;
    limit: number;
    requester?: BrainMemoryRequester;
  }) => Promise<RetrievedMemoryWithPacket[]>;
  publish?: (runId: string, type: string, payload: Record<string, unknown>) => Promise<unknown>;
};

export type QuadCoreContext = {
  orgId: string;
  runId: string;
  surface: QuadCoreSurface;
  employeeId: string;
  intent: Intent;
  detectedUrl: string | null;
  memories: BrainMemory[];
  verifiedContext: QuadChainPacketSummary[];
  capabilities: CapabilitySummary;
  selectedTools: ActiveTool[];
  missingCapabilities: Array<{
    id: string;
    reason: string;
    missingEnv: string[];
  }>;
  permission: PermissionDecision;
  events: QuadCoreEvent[];
};

export type QuadCoreReceiptInput = {
  context: QuadCoreContext;
  output: string;
  type?: QuadChainPacketType;
  producer?: string;
  consumer?: string;
  sources?: QuadChainSource[];
  answerConcepts?: string[];
  visibility?: QuadChainVisibility;
};

export async function buildQuadCoreContext(input: QuadCoreContextInput): Promise<QuadCoreContext> {
  const runId = input.runId || `run_${crypto.randomUUID()}`;
  const publish = input.publish ?? publishAuditEvent;
  const events: QuadCoreEvent[] = [];
  const emit = async (type: string, payload: Record<string, unknown>) => {
    events.push({ type, payload });
    await publish(runId, type, payload).catch(() => null);
  };

  await emit("core.input_received", {
    surface: input.surface,
    employeeId: input.employee.id,
  });

  const intent = classifyIntent(input.text, {
    hasActiveAudit: input.hasActiveAudit,
    pinnedUrl: input.pinnedUrl,
  });
  const detectedUrl = extractUrl(input.text) ?? input.pinnedUrl ?? null;
  await emit("core.intent_classified", { intent, detectedUrl });

  const retrieved = input.contextMode === "skip"
    ? await emit("core.context_skipped", {
      reason: "Context retrieval is owned by the downstream worker task.",
    }).then(() => [])
    : await (input.retrieve ?? retrieveMemoriesWithPackets)({
      orgId: input.orgId,
      query: input.text,
      limit: 6,
      requester: input.requester,
    }).catch(async (error) => {
      await emit("core.context_failed", {
        reason: error instanceof Error ? error.message : "Context retrieval failed.",
      });
      return [];
    });
  const memories = retrieved.map((item) => item.memory);
  const verifiedContext = retrieved
    .map((item) => item.quadChain)
    .filter((item): item is QuadChainPacketSummary => Boolean(item));
  await emit("core.context_loaded", {
    memoryCount: memories.length,
    verifiedContextCount: verifiedContext.length,
  });

  const capabilities = summarizeCapabilities(input.env ?? process.env, { orgId: input.orgId });
  const selectedTools = selectToolsForRuntime(intent, input.surface, capabilities.activeTools);
  const missingCapabilities = missingCapabilitiesForRuntime(intent, input.surface, capabilities);
  await emit("core.capabilities_selected", {
    selectedToolIds: selectedTools.map((tool) => tool.id),
    missingCapabilityIds: missingCapabilities.map((tool) => tool.id),
  });

  const permission = checkPermission(input.employee, intent);
  await emit("core.permission_checked", {
    allowed: permission.allowed,
    requiresApproval: permission.requiresApproval,
    reason: permission.reason ?? null,
  });

  return {
    orgId: input.orgId,
    runId,
    surface: input.surface,
    employeeId: input.employee.id,
    intent,
    detectedUrl,
    memories,
    verifiedContext,
    capabilities,
    selectedTools,
    missingCapabilities,
    permission,
    events,
  };
}

export function selectToolsForIntent(intent: Intent, activeTools: ActiveTool[]): ActiveTool[] {
  const desired = desiredCapabilityIds(intent);
  return activeTools.filter((tool) => desired.includes(tool.id));
}

export function selectToolsForRuntime(
  intent: Intent,
  surface: QuadCoreSurface,
  activeTools: ActiveTool[]
): ActiveTool[] {
  const desired = new Set([...desiredCapabilityIds(intent), ...desiredSurfaceCapabilityIds(surface)]);
  return activeTools.filter((tool) => desired.has(tool.id));
}

export function createQuadCoreReceipt(input: QuadCoreReceiptInput): QuadChainPacket {
  const context = input.context;
  const sources = input.sources ?? buildDefaultSources(context);
  const evidence = context.memories
    .flatMap((memory) =>
      memory.evidence
        .filter((item) => item.quote?.trim())
        .slice(0, 2)
        .map((item, index) => ({
          id: `${memory.id}_evidence_${index + 1}`,
          sourceId: memory.id,
          quote: item.quote,
          required: context.intent !== "general_chat",
        }))
    )
    .slice(0, 8);

  const openObligations: QuadChainOpenObligation[] = [];
  if (context.permission.requiresApproval) {
    openObligations.push({
      kind: "approval_required",
      id: `${context.runId}:approval`,
      reason: context.permission.reason ?? "Human approval is required before execution.",
    });
  }
  for (const capability of context.missingCapabilities
    .filter((item) => isExecutionCriticalMissingCapability(context.intent, item.id))
    .slice(0, 4)) {
    openObligations.push({
      kind: "connector_missing",
      id: capability.id,
      reason: capability.reason,
    });
  }

  return createQuadChainPacket({
    type: input.type ?? "chat_answer",
    orgId: context.orgId,
    runId: context.runId,
    producer: input.producer ?? `quad.${context.employeeId}`,
    consumer: input.consumer ?? `quad.${context.surface}`,
    sources,
    evidence,
    output: buildReceiptOutput(context, input.output),
    answerConcepts: input.answerConcepts ?? ["intent", "answer", ...context.selectedTools.map((tool) => tool.id)],
    openObligations,
    visibility: input.visibility ?? "internal",
  });
}

export async function saveQuadCoreReceipt(input: QuadCoreReceiptInput): Promise<QuadChainPacketSummary> {
  const packet = createQuadCoreReceipt(input);
  const saved = await saveQuadChainPacket(packet);
  return summarizeQuadChainPacket(packet) ?? saved.summary;
}

function missingCapabilitiesForRuntime(
  intent: Intent,
  surface: QuadCoreSurface,
  capabilities: CapabilitySummary
): QuadCoreContext["missingCapabilities"] {
  const desired = new Set([...desiredCapabilityIds(intent), ...desiredSurfaceCapabilityIds(surface)]);
  const active = new Set(capabilities.activeTools.map((tool) => tool.id));
  return capabilities.installed
    .filter((state) => desired.has(state.id) && !active.has(state.id))
    .map((state) => ({
      id: state.id,
      reason: state.reason,
      missingEnv: state.missingEnv,
    }));
}

function desiredCapabilityIds(intent: Intent): string[] {
  switch (intent) {
    case "website_audit":
      return ["quad.company_brain", "browserbase.read_browser", "quad.chain_verifier", "arize.phoenix", "sentry.reliability"];
    case "audit_follow_up":
      return ["quad.company_brain", "quad.chain_verifier", "trust_packet.exporter"];
    case "draft_content":
      return ["quad.company_brain", "quad.chain_verifier", "cms.publisher"];
    case "create_task":
      return ["quad.company_brain", "quad.chain_verifier", "task.publisher"];
    case "save_memory":
    case "summarize_meeting":
      return ["quad.company_brain", "quad.chain_verifier"];
    case "company_question":
    case "general_chat":
    default:
      return ["quad.company_brain", "quad.chain_verifier"];
  }
}

function desiredSurfaceCapabilityIds(surface: QuadCoreSurface): string[] {
  switch (surface) {
    case "fetch_agent":
      return ["fetch.agent_bridge"];
    case "voice":
      return ["deepgram.voice_memory"];
    case "worker":
      return ["redis.event_spine"];
    case "dashboard":
    case "chat":
    default:
      return [];
  }
}

function isExecutionCriticalMissingCapability(intent: Intent, capabilityId: string): boolean {
  if (capabilityId === "quad.company_brain") return false;
  if (intent === "company_question" || intent === "general_chat" || intent === "audit_follow_up") return false;
  return capabilityId === "cms.publisher" || capabilityId === "task.publisher";
}

function buildDefaultSources(context: QuadCoreContext): QuadChainSource[] {
  return [
    {
      id: "runtime_context",
      kind: "event",
      content: {
        intent: context.intent,
        surface: context.surface,
        selectedTools: context.selectedTools.map((tool) => tool.id),
        verifiedContext: context.verifiedContext.map((packet) => packet.certificateId),
      },
    },
    ...context.memories.slice(0, 6).map((memory) => ({
      id: memory.id,
      kind: "memory" as const,
      content: {
        title: memory.title,
        sourceType: memory.sourceType,
        summary: memory.summary,
        evidence: memory.evidence,
        metadata: getMemoryMetadata(memory),
      },
    })),
  ];
}

function buildReceiptOutput(context: QuadCoreContext, output: string): string {
  return [
    `surface: ${context.surface}`,
    `intent: ${context.intent}`,
    `selected tools: ${context.selectedTools.map((tool) => tool.id).join(", ") || "none"}`,
    `verified receipts: ${context.verifiedContext.map((packet) => packet.certificateId).join(", ") || "none"}`,
    `answer: ${output}`,
  ].join("\n");
}
