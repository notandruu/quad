import { createQuadChainPacket, summarizeQuadChainPacket, type QuadChainPacketSummary } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
import { summarizeCapabilities } from "@/lib/metaregistry";
import { createEvidenceBundle, summarizeEvidenceBundle } from "@/lib/storage/evidence";
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
    const data = draft.kind === "trust_packet_export"
      ? await attachTrustPacketExportEvidence({
          orgId: loaded.run.orgId,
          runId: loaded.run.id,
          data: draft.data,
        })
      : draft.data;
    const artifact = addArtifact({
      runId: loaded.run.id,
      kind: draft.kind,
      title: draft.title,
      data,
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
  capabilityId: PublishCapabilityId;
  data: ConnectorDraftPayload;
};

type PublishCapabilityId = "cms.publisher" | "task.publisher" | "trust_packet.exporter";

type ConnectorDraftPayload = {
  schemaVersion: "quad.connector_draft.v1";
  connector: {
    id: PublishCapabilityId;
    mode: "dry_run";
    writeIntent: "stage_only";
  };
  target: {
    url: string;
    destination: string;
    selector?: string;
  };
  action: {
    type: string;
    summary: string;
    reversible: boolean;
    approvalRequired: true;
  };
  payload: Record<string, unknown>;
  proof: {
    trustPacketArtifactId: string;
    trustPacketHash: string;
    sourceTitle: string;
    sourceSummary: string;
    evidencePreserved: boolean;
  };
  validation: {
    checks: Array<{
      id: string;
      passed: boolean;
      detail: string;
    }>;
    ready: boolean;
  };
  targetUrl: string;
  actor: string;
  dryRun: true;
  sectionTitle?: string;
  body?: string;
  callout?: string;
  title?: string;
  description?: string;
  acceptanceCriteria?: string[];
  markdown?: string;
  evidenceBundle?: ReturnType<typeof summarizeEvidenceBundle>;
};

async function attachTrustPacketExportEvidence(input: {
  orgId: string;
  runId: string;
  data: ConnectorDraftPayload;
}): Promise<ConnectorDraftPayload> {
  const markdown = typeof input.data.markdown === "string" ? input.data.markdown : "";
  if (!markdown) return input.data;
  const filename = typeof input.data.payload.filename === "string" ? input.data.payload.filename : "trust-packet.md";
  const evidence = await createEvidenceBundle({
    orgId: input.orgId,
    runId: input.runId,
    kind: "trust_packet_export",
    storageMode: "artifact_payload",
    mimeType: "text/markdown",
    byteLength: Buffer.byteLength(markdown),
    text: markdown,
    storageKey: `${input.runId}/${filename}`,
    sourceUrl: input.data.targetUrl,
    visibility: "internal",
    classification: "internal",
    metadata: {
      filename,
      connector: input.data.connector.id,
      dryRun: input.data.dryRun,
    },
  });

  return {
    ...input.data,
    evidenceBundle: summarizeEvidenceBundle(evidence),
  };
}

function buildDrafts(snapshot: RunLedgerSnapshot, trustPacket: WorkflowArtifactRecord, actor: string): DraftSpec[] {
  const packetData = isRecord(trustPacket.data) ? trustPacket.data : {};
  const targetUrl = String(packetData.targetUrl ?? snapshot.run.targetUrl ?? "customer site");
  const packetArtifacts = Array.isArray(packetData.artifacts) ? packetData.artifacts.filter(isRecord) : [];
  const firstFinding = packetArtifacts[0];
  const headline = String(firstFinding?.title ?? snapshot.run.title);
  const summary = String(firstFinding?.summary ?? "Publish the approved enterprise proof update.");
  const proof = {
    trustPacketArtifactId: trustPacket.id,
    trustPacketHash: trustPacket.hash,
    sourceTitle: headline,
    sourceSummary: summary,
    evidencePreserved: Boolean(firstFinding),
  };

  return [
    {
      kind: "cms_draft",
      title: "Cms proof block draft",
      taskTitle: "Stage cms proof block",
      capabilityId: "cms.publisher",
      data: withValidation({
        schemaVersion: "quad.connector_draft.v1",
        connector: {
          id: "cms.publisher",
          mode: "dry_run",
          writeIntent: "stage_only",
        },
        target: {
          url: targetUrl,
          destination: "website_cms",
          selector: "[data-quad-proof-block]",
        },
        action: {
          type: "upsert_page_section",
          summary: `Stage proof block on ${targetUrl}.`,
          reversible: true,
          approvalRequired: true,
        },
        payload: {
          sectionKey: "quad-proof-block",
          sectionTitle: headline,
          body: summary,
          callout: "This update is staged for review and has not been published.",
          source: "approved_trust_packet",
        },
        proof,
        targetUrl,
        actor,
        dryRun: true,
        sectionTitle: headline,
        body: summary,
        callout: "This update is staged for review and has not been published.",
      }),
    },
    {
      kind: "task_draft",
      title: "Implementation task draft",
      taskTitle: "Stage implementation task",
      capabilityId: "task.publisher",
      data: withValidation({
        schemaVersion: "quad.connector_draft.v1",
        connector: {
          id: "task.publisher",
          mode: "dry_run",
          writeIntent: "stage_only",
        },
        target: {
          url: targetUrl,
          destination: "task_tracker",
        },
        action: {
          type: "create_implementation_task",
          summary: `Create an implementation task for ${headline}.`,
          reversible: true,
          approvalRequired: true,
        },
        payload: {
          title: `Ship approved proof update: ${headline}`,
          description: summary,
          labels: ["quad", "trust-packet", "dry-run"],
          acceptanceCriteria: [
            "copy preserves approved evidence",
            "page contains the staged proof block",
            "quad post-ship verification passes",
          ],
        },
        proof,
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
      }),
    },
    {
      kind: "trust_packet_export",
      title: "Customer trust packet export",
      taskTitle: "Stage trust packet export",
      capabilityId: "trust_packet.exporter",
      data: withValidation({
        schemaVersion: "quad.connector_draft.v1",
        connector: {
          id: "trust_packet.exporter",
          mode: "dry_run",
          writeIntent: "stage_only",
        },
        target: {
          url: targetUrl,
          destination: "customer_trust_packet",
        },
        action: {
          type: "export_markdown_packet",
          summary: `Export approved packet for ${targetUrl}.`,
          reversible: true,
          approvalRequired: true,
        },
        payload: {
          format: "markdown",
          filename: `${slugify(snapshot.run.title)}.md`,
        },
        proof,
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
      }),
    },
  ];
}

function withValidation(payload: Omit<ConnectorDraftPayload, "validation">): ConnectorDraftPayload {
  const checks = [
    {
      id: "dry_run_only",
      passed: payload.dryRun === true && payload.connector.mode === "dry_run",
      detail: "Artifact is explicitly staged in dry-run mode.",
    },
    {
      id: "approval_required",
      passed: payload.action.approvalRequired === true,
      detail: "Customer-facing execution still requires approval.",
    },
    {
      id: "proof_bound",
      passed: Boolean(payload.proof.trustPacketArtifactId && payload.proof.trustPacketHash),
      detail: "Draft is bound to an approved trust packet artifact and hash.",
    },
    {
      id: "target_present",
      passed: Boolean(payload.target.url),
      detail: "Draft includes a customer target.",
    },
  ];
  return {
    ...payload,
    validation: {
      checks,
      ready: checks.every((check) => check.passed),
    },
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80) || "quad-trust-packet";
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
