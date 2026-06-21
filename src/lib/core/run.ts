import { DEMO_ORG_ID } from "@/data/seed";
import { getEmployee } from "@/lib/employees";
import { enqueueAuditJob } from "@/lib/jobs/queue";
import { complete, chatModel } from "@/lib/llm/anthropic";
import { withRuntimeTrace } from "@/lib/observability";
import { createQuadChainPacket, summarizeQuadChainPacket, type QuadChainPacketSummary, type QuadChainSource } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
import { getMemoryMetadata, retrieveMemoriesWithPackets } from "@/lib/brain";
import type { BrainMemoryRequester } from "@/lib/brain/permissions";
import type { AuditReport, BrainMemory } from "@/lib/types";
import { buildAuditChatSystemPrompt } from "@/lib/runtime/prompts";
import { loadAuditChatContext } from "@/lib/runtime/auditChatContext";
import { runEmployee, type RuntimeResult } from "@/lib/runtime/runtime";
import {
  buildQuadCoreContext,
  saveQuadCoreReceipt,
  type QuadCoreSurface,
} from ".";

export type QuadCoreCommand = "chat" | "queue_audit";

export type QuadCoreRunInput = {
  command: QuadCoreCommand;
  orgId?: string;
  employeeId?: string;
  text?: string;
  runId?: string;
  targetUrl?: string;
  pinnedUrl?: string;
  hasActiveAudit?: boolean;
  limit?: number;
  workflow?: "website_audit" | "enterprise_proof";
  surface?: QuadCoreSurface;
  requester?: BrainMemoryRequester;
  createdBy?: "dashboard" | "agent" | "system";
};

export type QuadCoreChatRunResult = {
  ok: true;
  command: "chat";
  orgId: string;
  runId: string;
  surface: QuadCoreSurface;
  message: string;
  intent: RuntimeResult["intent"] | "audit_follow_up";
  requiresApproval: boolean;
  detectedUrl: string | null;
  quadChain: QuadChainPacketSummary;
  verifiedContext: QuadChainPacketSummary[];
};

export type QuadCoreQueueAuditResult = {
  ok: true;
  command: "queue_audit";
  orgId: string;
  runId: string;
  surface: QuadCoreSurface;
  mode: "redis" | "memory";
  quadChain: QuadChainPacketSummary[];
  runtime: {
    surface: QuadCoreSurface;
    selectedTools: string[];
    missingCapabilities: Array<{
      id: string;
      missingEnvCount: number;
    }>;
  };
  job: {
    id: string;
    type: string;
    status: string;
    attempts: number;
    maxAttempts: number;
  };
  task: Awaited<ReturnType<typeof enqueueAuditJob>>["task"];
};

export type QuadCoreRunResult = QuadCoreChatRunResult | QuadCoreQueueAuditResult;

export async function runQuadCoreCommand(input: QuadCoreRunInput): Promise<QuadCoreRunResult> {
  const orgId = input.orgId ?? DEMO_ORG_ID;
  const surface = input.surface ?? "chat";
  return withRuntimeTrace({
    name: `core.run.${input.command}`,
    kind: "workflow",
    orgId,
    runId: input.runId,
    attributes: {
      command: input.command,
      surface,
      hasText: Boolean(input.text?.trim()),
      hasRunId: Boolean(input.runId),
      hasTargetUrl: Boolean(input.targetUrl),
    },
  }, async () => {
    if (input.command === "queue_audit") {
      return runQueueAuditCommand({ ...input, orgId, surface });
    }
    return runChatCommand({ ...input, orgId, surface });
  });
}

async function runQueueAuditCommand(
  input: QuadCoreRunInput & { orgId: string; surface: QuadCoreSurface }
): Promise<QuadCoreQueueAuditResult> {
  const targetUrl = input.targetUrl ?? input.pinnedUrl;
  if (!targetUrl) throw new Error("targetUrl required");
  const runId = input.runId ?? `run_${crypto.randomUUID()}`;
  const employee = getEmployee(input.employeeId);
  const result = await enqueueAuditJob({
    orgId: input.orgId,
    targetUrl,
    limit: input.limit,
    runId,
    workflow: input.workflow ?? "website_audit",
    createdBy: input.createdBy ?? (input.surface === "fetch_agent" ? "agent" : "dashboard"),
  });
  const context = await buildQuadCoreContext({
    orgId: input.orgId,
    employee,
    runId: result.job.runId,
    text: `queue ${input.workflow ?? "website_audit"} for ${targetUrl}`,
    surface: input.surface,
    pinnedUrl: targetUrl,
    hasActiveAudit: true,
    contextMode: "skip",
  });
  const handoffPacket = createQuadChainPacket({
    orgId: input.orgId,
    runId: result.job.runId,
    type: "agent_handoff",
    producer: `quad.${input.surface}`,
    consumer: "quad.worker",
    output: [
      `core queue handoff accepted for ${input.workflow ?? "website_audit"}.`,
      `surface ${input.surface} queued job ${result.job.id} for ${targetUrl}.`,
      "worker execution and customer-facing approvals are tracked in downstream task receipts.",
    ].join("\n"),
    answerConcepts: ["core", "queue", "handoff", input.workflow ?? "website_audit"],
    evidence: [],
    sources: [
      {
        id: "core_queue_request",
        kind: "event",
        content: {
          workflow: input.workflow ?? "website_audit",
          targetUrl,
          limit: input.limit ?? null,
          jobId: result.job.id,
          selectedTools: context.selectedTools.map((tool) => tool.id),
          missingCapabilities: context.missingCapabilities.map((capability) => capability.id),
        },
      },
    ],
    visibility: "internal",
  });
  const savedHandoff = await saveQuadChainPacket(handoffPacket);
  const handoff = summarizeQuadChainPacket(handoffPacket) ?? savedHandoff.summary;

  return {
    ok: true,
    command: "queue_audit",
    orgId: input.orgId,
    runId: result.job.runId,
    surface: input.surface,
    mode: result.mode,
    quadChain: [handoff],
    runtime: {
      surface: context.surface,
      selectedTools: context.selectedTools.map((tool) => tool.id),
      missingCapabilities: context.missingCapabilities.map((capability) => ({
        id: capability.id,
        missingEnvCount: capability.missingEnv.length,
      })),
    },
    job: {
      id: result.job.id,
      type: result.job.type,
      status: result.job.status,
      attempts: result.job.attempts,
      maxAttempts: result.job.maxAttempts,
    },
    task: result.task,
  };
}

async function runChatCommand(
  input: QuadCoreRunInput & { orgId: string; surface: QuadCoreSurface }
): Promise<QuadCoreChatRunResult> {
  const text = input.text?.trim() ?? "";
  if (!text) throw new Error("text required");
  const employee = getEmployee(input.employeeId);
  const effectiveRunId = input.runId || `run_${crypto.randomUUID()}`;

  const coreContext = await buildQuadCoreContext({
    orgId: input.orgId,
    employee,
    runId: effectiveRunId,
    text,
    surface: input.surface,
    pinnedUrl: input.pinnedUrl,
    hasActiveAudit: input.hasActiveAudit || Boolean(input.runId),
    requester: input.requester,
  });

  if (input.runId) {
    const auditContext = await loadAuditChatContext({ orgId: input.orgId, runId: input.runId });
    if (auditContext.report) {
      const grounded = await auditGroundedChat(text, input.orgId, employee, auditContext.report, input.requester);
      const quadChain = await saveQuadCoreReceipt({
        context: coreContext,
        output: grounded.reply,
        producer: "quad.core",
        consumer: `quad.${input.surface}`,
        sources: [
          ...auditContext.sources,
          ...buildMemorySources(coreContext.memories),
        ] satisfies QuadChainSource[],
        answerConcepts: answerConceptsForSurface(input.surface),
      });
      return {
        ok: true,
        command: "chat",
        orgId: input.orgId,
        runId: coreContext.runId,
        surface: input.surface,
        message: grounded.reply,
        intent: "audit_follow_up",
        requiresApproval: false,
        detectedUrl: coreContext.detectedUrl,
        quadChain,
        verifiedContext: uniquePacketSummaries([
          ...auditContext.verifiedContext,
          ...grounded.verifiedContext,
        ]),
      };
    }
  }

  const result = await runEmployee({
    orgId: input.orgId,
    employee,
    runId: effectiveRunId,
    text,
    pinnedUrl: input.pinnedUrl,
    hasActiveAudit: input.hasActiveAudit,
    surface: input.surface,
    coreContext,
  });
  const quadChain = await saveQuadCoreReceipt({
    context: coreContext,
    output: result.message,
    producer: `quad.${employee.id}`,
    consumer: `quad.${input.surface}`,
    answerConcepts: answerConceptsForSurface(input.surface),
  });

  return {
    ok: true,
    command: "chat",
    orgId: input.orgId,
    runId: coreContext.runId,
    surface: input.surface,
    message: result.message,
    intent: result.intent,
    requiresApproval: result.requiresApproval,
    detectedUrl: result.detectedUrl,
    quadChain,
    verifiedContext: result.verifiedContext,
  };
}

function answerConceptsForSurface(surface: QuadCoreSurface): string[] | undefined {
  if (surface !== "voice") return undefined;
  return ["voice", "transcript", "answer", "intent"];
}

async function auditGroundedChat(
  text: string,
  orgId: string,
  employee: ReturnType<typeof getEmployee>,
  report: AuditReport,
  requester?: BrainMemoryRequester
): Promise<{ reply: string; verifiedContext: QuadChainPacketSummary[] }> {
  const retrieved = await retrieveMemoriesWithPackets({ orgId, query: text, limit: 5, requester });
  const brainContext = retrieved.map((item) => item.memory);
  const verifiedContext = retrieved
    .map((item) => item.quadChain)
    .filter((item): item is QuadChainPacketSummary => Boolean(item));

  const system = buildAuditChatSystemPrompt(
    employee.name,
    employee.tone,
    brainContext,
    report.summary,
    report.topFindings.map((finding) => ({
      title: finding.title,
      severity: finding.severity,
      recommendedFix: finding.recommendedFix,
      pageUrl: finding.pageUrl,
    }))
  );

  const reply = await complete({
    orgId,
    runId: report.runId,
    model: chatModel(),
    system,
    prompt: text,
    maxTokens: 1000,
    purpose: "chat",
  });

  return {
    reply: reply ?? `Based on the audit of ${report.targetUrl}: ${report.summary}`,
    verifiedContext,
  };
}

function buildMemorySources(memories: BrainMemory[]): QuadChainSource[] {
  return memories.slice(0, 6).map((item) => ({
    id: item.id,
    kind: "memory",
    content: {
      title: item.title,
      sourceType: item.sourceType,
      summary: item.summary,
      evidence: item.evidence,
      metadata: getMemoryMetadata(item),
    },
  }));
}

function uniquePacketSummaries(packets: QuadChainPacketSummary[]): QuadChainPacketSummary[] {
  const seen = new Set<string>();
  const unique: QuadChainPacketSummary[] = [];
  for (const packet of packets) {
    if (seen.has(packet.id)) continue;
    seen.add(packet.id);
    unique.push(packet);
  }
  return unique;
}
