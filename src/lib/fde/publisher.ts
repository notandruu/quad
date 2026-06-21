import { createQuadChainPacket, summarizeQuadChainPacket, type QuadChainPacketSummary } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
import { summarizeCapabilities } from "@/lib/metaregistry";
import {
  addArtifact,
  addTask,
  assertCustomerWriteAllowed,
  createReceipt,
  getRunSnapshot,
  loadRunSnapshot,
  saveRunSnapshot,
  summarizeAgentTask,
  type AgentTaskSummary,
  type RunLedgerSnapshot,
  type WorkflowArtifactRecord,
  type WorkflowTaskRecord,
} from "@/lib/runs";

export type DryRunPublishArtifact = {
  artifact: WorkflowArtifactRecord;
  receiptId: string;
  packet: QuadChainPacketSummary;
};

export type DryRunPublishResult = {
  task: AgentTaskSummary;
  staged: DryRunPublishArtifact[];
};

export type DryRunPublisherInput = {
  runId: string;
  orgId?: string;
  actor?: string;
  now?: string;
  env?: Record<string, string | undefined>;
};

export async function dryRunPublish(input: DryRunPublisherInput): Promise<DryRunPublishResult> {
  const loaded = await loadRunSnapshot(input.runId);
  if (!loaded) throw new DryRunPublishError("run_not_found", 404, "Run not found.");
  if (input.orgId && loaded.run.orgId !== input.orgId) {
    throw new DryRunPublishError("run_not_found", 404, "Run not found.");
  }

  try {
    assertCustomerWriteAllowed(loaded);
  } catch (error) {
    throw new DryRunPublishError("approval_required", 409, error instanceof Error ? error.message : "Approval required.");
  }

  const trustPacket = loaded.artifacts.find((artifact) => artifact.kind === "trust_packet");
  if (!trustPacket) {
    throw new DryRunPublishError("trust_packet_missing", 404, "Trust packet artifact not found.");
  }

  const now = input.now ?? new Date().toISOString();
  const drafts = buildDrafts(loaded, trustPacket, input.actor ?? "quad.publisher_agent");
  const capabilitySummary = summarizeCapabilities(input.env ?? process.env, { orgId: loaded.run.orgId });
  const activeCapabilities = new Set(capabilitySummary.activeTools.map((tool) => tool.id));
  const installStates = new Map(capabilitySummary.installed.map((state) => [state.id, state]));
  const blockedDrafts = drafts.filter((draft) => !activeCapabilities.has(draft.capabilityId));
  if (blockedDrafts.length > 0) {
    for (const draft of blockedDrafts) {
      const state = installStates.get(draft.capabilityId);
      addTask({
        runId: loaded.run.id,
        title: draft.taskTitle,
        status: "blocked",
        owner: "connector",
        capabilityId: draft.capabilityId,
        detail: state?.reason ?? "Capability is not active in the metaregistry.",
        now,
      });
    }
    await saveRunSnapshot(loaded.run.id);
    throw new DryRunPublishError(
      "capability_blocked",
      409,
      `Connector capability blocked: ${blockedDrafts.map((draft) => draft.capabilityId).join(", ")}.`
    );
  }
  const staged: DryRunPublishArtifact[] = [];

  for (const draft of drafts) {
    addTask({
      runId: loaded.run.id,
      title: draft.taskTitle,
      status: "completed",
      owner: "connector",
      capabilityId: draft.capabilityId,
      detail: "Dry-run artifact staged. No customer-facing write was executed.",
      now,
    });
    const artifact = addArtifact({
      runId: loaded.run.id,
      kind: draft.kind,
      title: draft.title,
      data: draft.data,
      now,
    });
    const receipt = createReceipt({
      runId: loaded.run.id,
      artifactId: artifact.id,
      status: "ready",
      summary: `${draft.title} staged in dry-run mode.`,
      now,
    });
    const packet = createQuadChainPacket({
      type: "connector_action",
      orgId: loaded.run.orgId,
      runId: loaded.run.id,
      producer: "quad.publisher_agent",
      consumer: draft.capabilityId,
      sources: [
        {
          id: trustPacket.id,
          kind: "artifact",
          content: {
            title: trustPacket.title,
            hash: trustPacket.hash,
          },
        },
        {
          id: artifact.id,
          kind: "tool_result",
          content: {
            title: artifact.title,
            hash: artifact.hash,
            dryRun: true,
          },
        },
      ],
      evidence: [
        {
          id: `${artifact.id}:dry_run`,
          sourceId: artifact.id,
          quote: "Dry-run artifact staged. No customer-facing write was executed.",
          required: true,
        },
      ],
      output: [
        `connector action: ${draft.capabilityId}`,
        `mode: dry_run`,
        `artifact: ${artifact.title}`,
        `receipt: ${receipt.status}`,
        "no customer-facing write executed",
      ].join("\n"),
      answerConcepts: ["connector action", "dry run", "artifact"],
      visibility: "internal",
      createdAt: now,
    });
    const saved = await saveQuadChainPacket(packet);

    staged.push({
      artifact,
      receiptId: receipt.id,
      packet: summarizeQuadChainPacket(packet) ?? saved.summary,
    });
  }

  await saveRunSnapshot(loaded.run.id);
  const snapshot = getRunSnapshot(loaded.run.id);
  if (!snapshot) throw new DryRunPublishError("run_not_found", 404, "Run not found.");

  return {
    task: summarizeAgentTask(snapshot),
    staged,
  };
}

type DraftSpec = {
  kind: "cms_draft" | "task_draft" | "trust_packet_export";
  title: string;
  taskTitle: string;
  capabilityId: "cms.publisher" | "task.publisher" | "trust_packet.exporter";
  data: Record<string, unknown>;
};

function buildDrafts(snapshot: RunLedgerSnapshot, trustPacket: WorkflowArtifactRecord, actor: string): DraftSpec[] {
  const packetData = isRecord(trustPacket.data) ? trustPacket.data : {};
  const targetUrl = String(packetData.targetUrl ?? snapshot.run.targetUrl ?? "customer site");
  const packetArtifacts = Array.isArray(packetData.artifacts) ? packetData.artifacts.filter(isRecord) : [];
  const firstFinding = packetArtifacts[0];
  const headline = String(firstFinding?.title ?? snapshot.run.title);
  const summary = String(firstFinding?.summary ?? "Publish the approved enterprise proof update.");

  return [
    {
      kind: "cms_draft",
      title: "Cms proof block draft",
      taskTitle: "Stage cms proof block",
      capabilityId: "cms.publisher",
      data: {
        targetUrl,
        actor,
        dryRun: true,
        sectionTitle: headline,
        body: summary,
        callout: "This update is staged for review and has not been published.",
      },
    },
    {
      kind: "task_draft",
      title: "Implementation task draft",
      taskTitle: "Stage implementation task",
      capabilityId: "task.publisher",
      data: {
        targetUrl,
        actor,
        dryRun: true,
        title: `Ship approved proof update: ${headline}`,
        description: summary,
        acceptanceCriteria: [
          "copy preserves approved evidence",
          "page contains the staged proof block",
          "quad post-ship verification passes",
        ],
      },
    },
    {
      kind: "trust_packet_export",
      title: "Customer trust packet export",
      taskTitle: "Stage trust packet export",
      capabilityId: "trust_packet.exporter",
      data: {
        targetUrl,
        actor,
        dryRun: true,
        markdown: [
          `# ${snapshot.run.title}`,
          "",
          `target: ${targetUrl}`,
          "",
          "## approved update",
          "",
          summary,
          "",
          "## status",
          "",
          "staged only. no customer-facing write executed.",
        ].join("\n"),
      },
    },
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export class DryRunPublishError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "DryRunPublishError";
  }
}
