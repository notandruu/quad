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
} from "@/lib/runs";
import type { ConnectorDraftPayload, PublishCapabilityId } from "./publisher";

export type ApprovedPublishExecution = {
  sourceDraft: Pick<WorkflowArtifactRecord, "id" | "kind" | "title" | "hash">;
  artifact: WorkflowArtifactRecord;
  receiptId: string;
  packet: QuadChainPacketSummary;
};

export type ApprovedPublishResult = {
  task: AgentTaskSummary;
  executed: ApprovedPublishExecution[];
};

export type ApprovedPublishInput = {
  runId: string;
  orgId?: string;
  actor?: string;
  now?: string;
  env?: Record<string, string | undefined>;
};

type ConnectorExecutionPayload = {
  schemaVersion: "quad.connector_execution.v1";
  sourceDraftArtifactId: string;
  sourceDraftHash: WorkflowArtifactRecord["hash"];
  connector: {
    id: PublishCapabilityId;
    mode: "approved_execution";
    writeIntent: "execute_approved_artifact";
  };
  target: ConnectorDraftPayload["target"];
  action: ConnectorDraftPayload["action"] & {
    approvalRequired: true;
    executed: true;
  };
  payload: Record<string, unknown>;
  proof: ConnectorDraftPayload["proof"] & {
    sourceDraftHash: WorkflowArtifactRecord["hash"];
  };
  validation: {
    checks: Array<{
      id: string;
      passed: boolean;
      detail: string;
    }>;
    ready: boolean;
  };
  rollbackPlan: {
    reversible: boolean;
    steps: string[];
  };
  postExecutionVerification: {
    required: true;
    verifier: "quad.post_ship_verifier";
    checks: string[];
  };
  targetUrl: string;
  actor: string;
  dryRun: false;
  executedAt: string;
};

const EXECUTABLE_DRAFT_KINDS = new Set<WorkflowArtifactRecord["kind"]>([
  "cms_draft",
  "task_draft",
  "trust_packet_export",
]);

export async function executeApprovedPublish(input: ApprovedPublishInput): Promise<ApprovedPublishResult> {
  const loaded = await loadRunSnapshot(input.runId);
  if (!loaded) throw new ApprovedPublishError("run_not_found", 404, "Run not found.");
  if (input.orgId && loaded.run.orgId !== input.orgId) {
    throw new ApprovedPublishError("run_not_found", 404, "Run not found.");
  }

  try {
    assertCustomerWriteAllowed(loaded);
  } catch (error) {
    throw new ApprovedPublishError("approval_required", 409, error instanceof Error ? error.message : "Approval required.");
  }

  const drafts = findExecutableDrafts(loaded);
  if (drafts.length === 0) {
    throw new ApprovedPublishError("drafts_missing", 404, "No staged connector drafts were found.");
  }

  const alreadyExecuted = new Set(
    loaded.artifacts
      .map((artifact) => (isRecord(artifact.data) ? artifact.data.sourceDraftArtifactId : null))
      .filter((id): id is string => typeof id === "string")
  );
  const pendingDrafts = drafts.filter((draft) => !alreadyExecuted.has(draft.id));
  if (pendingDrafts.length === 0) {
    throw new ApprovedPublishError("already_executed", 409, "All staged connector drafts are already executed.");
  }

  const now = input.now ?? new Date().toISOString();
  const actor = input.actor ?? "quad.publisher_agent";
  const capabilitySummary = summarizeCapabilities(input.env ?? process.env, { orgId: loaded.run.orgId });
  const activeCapabilities = new Set(capabilitySummary.activeTools.map((tool) => tool.id));
  const installStates = new Map(capabilitySummary.installed.map((state) => [state.id, state]));
  const blockedDrafts = pendingDrafts.filter((draft) => !activeCapabilities.has(readDraftPayload(draft).connector.id));
  if (blockedDrafts.length > 0) {
    for (const draft of blockedDrafts) {
      const capabilityId = readDraftPayload(draft).connector.id;
      const state = installStates.get(capabilityId);
      addTask({
        runId: loaded.run.id,
        title: `Execute ${draft.title}`,
        status: "blocked",
        owner: "connector",
        capabilityId,
        detail: state?.reason ?? "Capability is not active in the metaregistry.",
        now,
      });
    }
    await saveRunSnapshot(loaded.run.id);
    throw new ApprovedPublishError(
      "capability_blocked",
      409,
      `Connector capability blocked: ${blockedDrafts.map((draft) => readDraftPayload(draft).connector.id).join(", ")}.`
    );
  }

  const executed: ApprovedPublishExecution[] = [];
  for (const draft of pendingDrafts) {
    const draftPayload = readDraftPayload(draft);
    const executionPayload = buildExecutionPayload({
      draft,
      draftPayload,
      actor,
      now,
    });
    addTask({
      runId: loaded.run.id,
      title: `Execute ${draft.title}`,
      status: "completed",
      owner: "connector",
      capabilityId: executionPayload.connector.id,
      detail: "Approved connector draft executed into a customer-write artifact receipt.",
      now,
    });
    const artifact = addArtifact({
      runId: loaded.run.id,
      kind: "connector_execution",
      title: `Execution: ${draft.title}`,
      data: executionPayload,
      now,
    });
    const receipt = createReceipt({
      runId: loaded.run.id,
      artifactId: artifact.id,
      status: "executed",
      summary: `${draft.title} executed after approval.`,
      now,
    });
    const packet = createQuadChainPacket({
      type: "connector_action",
      orgId: loaded.run.orgId,
      runId: loaded.run.id,
      producer: "quad.publisher_agent",
      consumer: executionPayload.connector.id,
      sources: [
        {
          id: draft.id,
          kind: "artifact",
          content: {
            title: draft.title,
            kind: draft.kind,
            hash: draft.hash,
          },
        },
        {
          id: artifact.id,
          kind: "tool_result",
          content: {
            title: artifact.title,
            hash: artifact.hash,
            dryRun: false,
            sourceDraftArtifactId: draft.id,
          },
        },
      ],
      evidence: [
        {
          id: `${artifact.id}:approval_execution`,
          sourceId: artifact.id,
          quote: "Approved connector draft executed into a customer-write artifact receipt.",
          required: true,
        },
        {
          id: `${artifact.id}:rollback`,
          sourceId: artifact.id,
          quote: executionPayload.rollbackPlan.steps.join(" "),
          required: true,
        },
      ],
      output: [
        `connector action: ${executionPayload.connector.id}`,
        "mode: approved_execution",
        `source draft: ${draft.id}`,
        `execution artifact: ${artifact.id}`,
        `receipt: ${receipt.status}`,
      ].join("\n"),
      answerConcepts: ["connector action", "approved execution", "receipt", "rollback"],
      visibility: "internal",
      createdAt: now,
    });
    const saved = await saveQuadChainPacket(packet);
    executed.push({
      sourceDraft: {
        id: draft.id,
        kind: draft.kind,
        title: draft.title,
        hash: draft.hash,
      },
      artifact,
      receiptId: receipt.id,
      packet: summarizeQuadChainPacket(packet) ?? saved.summary,
    });
  }

  await saveRunSnapshot(loaded.run.id);
  const snapshot = getRunSnapshot(loaded.run.id);
  if (!snapshot) throw new ApprovedPublishError("run_not_found", 404, "Run not found.");

  return {
    task: summarizeAgentTask(snapshot),
    executed,
  };
}

function findExecutableDrafts(snapshot: RunLedgerSnapshot): WorkflowArtifactRecord[] {
  return snapshot.artifacts.filter((artifact) => {
    if (!EXECUTABLE_DRAFT_KINDS.has(artifact.kind)) return false;
    const data = isRecord(artifact.data) ? artifact.data : {};
    return data.schemaVersion === "quad.connector_draft.v1" && data.dryRun === true;
  });
}

function readDraftPayload(artifact: WorkflowArtifactRecord): ConnectorDraftPayload {
  const data = artifact.data;
  if (!isConnectorDraftPayload(data)) {
    throw new ApprovedPublishError("draft_invalid", 422, `Draft artifact is invalid: ${artifact.id}.`);
  }
  return data;
}

function buildExecutionPayload(input: {
  draft: WorkflowArtifactRecord;
  draftPayload: ConnectorDraftPayload;
  actor: string;
  now: string;
}): ConnectorExecutionPayload {
  const checks = [
    {
      id: "approved_source_draft",
      passed: input.draftPayload.dryRun === true && input.draftPayload.validation.ready,
      detail: "Source draft was staged and validated before execution.",
    },
    {
      id: "proof_bound",
      passed: Boolean(input.draftPayload.proof.trustPacketArtifactId && input.draftPayload.proof.trustPacketHash),
      detail: "Execution remains bound to the approved trust packet proof.",
    },
    {
      id: "rollback_present",
      passed: input.draftPayload.action.reversible,
      detail: input.draftPayload.action.reversible
        ? "Draft is reversible and has a rollback plan."
        : "Draft did not declare reversibility.",
    },
  ];

  return {
    schemaVersion: "quad.connector_execution.v1",
    sourceDraftArtifactId: input.draft.id,
    sourceDraftHash: input.draft.hash,
    connector: {
      id: input.draftPayload.connector.id,
      mode: "approved_execution",
      writeIntent: "execute_approved_artifact",
    },
    target: input.draftPayload.target,
    action: {
      ...input.draftPayload.action,
      approvalRequired: true,
      executed: true,
    },
    payload: input.draftPayload.payload,
    proof: {
      ...input.draftPayload.proof,
      sourceDraftHash: input.draft.hash,
    },
    validation: {
      checks,
      ready: checks.every((check) => check.passed),
    },
    rollbackPlan: {
      reversible: input.draftPayload.action.reversible,
      steps: buildRollbackSteps(input.draftPayload),
    },
    postExecutionVerification: {
      required: true,
      verifier: "quad.post_ship_verifier",
      checks: ["source draft still exists", "execution receipt exists", "proof binding preserved"],
    },
    targetUrl: input.draftPayload.targetUrl,
    actor: input.actor,
    dryRun: false,
    executedAt: input.now,
  };
}

function buildRollbackSteps(payload: ConnectorDraftPayload): string[] {
  if (payload.connector.id === "cms.publisher") {
    return [
      `restore previous cms section at ${payload.target.selector ?? payload.target.destination}`,
      "remove quad proof block if verification fails",
    ];
  }
  if (payload.connector.id === "task.publisher") {
    return [
      "close generated implementation task",
      "link closure reason back to the rejected quad receipt",
    ];
  }
  return [
    "archive exported trust packet",
    "regenerate export from the latest approved trust packet",
  ];
}

function isConnectorDraftPayload(value: unknown): value is ConnectorDraftPayload {
  if (!isRecord(value)) return false;
  const connector = isRecord(value.connector) ? value.connector : {};
  const validation = isRecord(value.validation) ? value.validation : {};
  return (
    value.schemaVersion === "quad.connector_draft.v1" &&
    value.dryRun === true &&
    typeof connector.id === "string" &&
    connector.mode === "dry_run" &&
    validation.ready === true
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export class ApprovedPublishError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApprovedPublishError";
  }
}
