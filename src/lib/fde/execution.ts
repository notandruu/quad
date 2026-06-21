import { createQuadChainPacket, summarizeQuadChainPacket, type QuadChainPacketSummary } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
import { summarizeCapabilities } from "@/lib/metaregistry";
import { createEvidenceBundle, summarizeEvidenceBundle, type EvidenceBundleSummary } from "@/lib/storage/evidence";
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

export type ApprovedBrowserAction = {
  sourceDraft: Pick<WorkflowArtifactRecord, "id" | "kind" | "title" | "hash">;
  executionArtifactId: string;
  artifact: WorkflowArtifactRecord;
  receiptId: string;
  packet: QuadChainPacketSummary;
};

export type ApprovedPublishResult = {
  task: AgentTaskSummary;
  executed: ApprovedPublishExecution[];
  browserActions: ApprovedBrowserAction[];
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

type BrowserActionPayload = {
  schemaVersion: "quad.browser_action.v1";
  sourceDraftArtifactId: string;
  executionArtifactId: string;
  connector: {
    id: "browserbase.write_browser";
    mode: "approved_browser_write";
    writeIntent: "fill_controlled_form";
  };
  target: {
    url: string;
    selector: string;
    destination: string;
  };
  fields: Array<{
    selector: string;
    label: string;
    valueHash: string;
    source: "approved_trust_packet";
  }>;
  action: {
    type: "fill_and_pause_before_submit";
    summary: string;
    submitted: false;
    approvalRequired: true;
  };
  evidence: {
    before: EvidenceBundleSummary;
    after: EvidenceBundleSummary;
  };
  proof: {
    trustPacketArtifactId: string;
    trustPacketHash: string;
    sourceDraftHash: WorkflowArtifactRecord["hash"];
    executionArtifactHash: WorkflowArtifactRecord["hash"];
  };
  verification: {
    required: true;
    expectedSelector: string;
    expectedValueHash: string;
    screenshotEvidenceIds: string[];
  };
  rollbackPlan: {
    reversible: true;
    steps: string[];
  };
  actor: string;
  createdAt: string;
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
  const browserActions: ApprovedBrowserAction[] = [];
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

    const browserAction = await maybeCreateBrowserAction({
      snapshot: loaded,
      draft,
      draftPayload,
      executionArtifact: artifact,
      actor,
      now,
    });
    if (browserAction) browserActions.push(browserAction);
  }

  await saveRunSnapshot(loaded.run.id);
  const snapshot = getRunSnapshot(loaded.run.id);
  if (!snapshot) throw new ApprovedPublishError("run_not_found", 404, "Run not found.");

  return {
    task: summarizeAgentTask(snapshot),
    executed,
    browserActions,
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

async function maybeCreateBrowserAction(input: {
  snapshot: RunLedgerSnapshot;
  draft: WorkflowArtifactRecord;
  draftPayload: ConnectorDraftPayload;
  executionArtifact: WorkflowArtifactRecord;
  actor: string;
  now: string;
}): Promise<ApprovedBrowserAction | null> {
  if (input.draftPayload.connector.id !== "cms.publisher") return null;

  const selector = input.draftPayload.target.selector ?? "[data-quad-proof-block]";
  const body = String(input.draftPayload.body ?? input.draftPayload.payload.body ?? input.draftPayload.proof.sourceSummary);
  const sectionTitle = String(input.draftPayload.sectionTitle ?? input.draftPayload.payload.sectionTitle ?? input.draftPayload.proof.sourceTitle);
  const valueHash = stableValueHash([sectionTitle, body].join("\n"));
  const before = await createEvidenceBundle({
    orgId: input.snapshot.run.orgId,
    runId: input.snapshot.run.id,
    kind: "browser_action",
    storageMode: "external_provider",
    mimeType: "application/json",
    byteLength: 0,
    storageKey: `${input.snapshot.run.id}/${input.draft.id}/browser-before.json`,
    sourceUrl: input.draftPayload.targetUrl,
    visibility: "internal",
    classification: "internal",
    metadata: {
      provider: "browserbase",
      mode: "fixture",
      phase: "before",
      selector,
      sourceDraftArtifactId: input.draft.id,
    },
    now: input.now,
  });
  const after = await createEvidenceBundle({
    orgId: input.snapshot.run.orgId,
    runId: input.snapshot.run.id,
    kind: "browser_action",
    storageMode: "external_provider",
    mimeType: "application/json",
    byteLength: 0,
    storageKey: `${input.snapshot.run.id}/${input.draft.id}/browser-after.json`,
    sourceUrl: input.draftPayload.targetUrl,
    visibility: "internal",
    classification: "internal",
    metadata: {
      provider: "browserbase",
      mode: "fixture",
      phase: "after",
      selector,
      valueHash,
      executionArtifactId: input.executionArtifact.id,
    },
    now: input.now,
  });
  const payload: BrowserActionPayload = {
    schemaVersion: "quad.browser_action.v1",
    sourceDraftArtifactId: input.draft.id,
    executionArtifactId: input.executionArtifact.id,
    connector: {
      id: "browserbase.write_browser",
      mode: "approved_browser_write",
      writeIntent: "fill_controlled_form",
    },
    target: {
      url: input.draftPayload.targetUrl,
      selector,
      destination: input.draftPayload.target.destination,
    },
    fields: [
      {
        selector: `${selector} [data-field='title']`,
        label: "section title",
        valueHash: stableValueHash(sectionTitle),
        source: "approved_trust_packet",
      },
      {
        selector: `${selector} [data-field='body']`,
        label: "section body",
        valueHash: stableValueHash(body),
        source: "approved_trust_packet",
      },
    ],
    action: {
      type: "fill_and_pause_before_submit",
      summary: `Fill ${selector} on ${input.draftPayload.targetUrl} and pause before submit.`,
      submitted: false,
      approvalRequired: true,
    },
    evidence: {
      before: summarizeEvidenceBundle(before),
      after: summarizeEvidenceBundle(after),
    },
    proof: {
      trustPacketArtifactId: input.draftPayload.proof.trustPacketArtifactId,
      trustPacketHash: input.draftPayload.proof.trustPacketHash,
      sourceDraftHash: input.draft.hash,
      executionArtifactHash: input.executionArtifact.hash,
    },
    verification: {
      required: true,
      expectedSelector: selector,
      expectedValueHash: valueHash,
      screenshotEvidenceIds: [before.id, after.id],
    },
    rollbackPlan: {
      reversible: true,
      steps: [
        `clear controlled browser fields under ${selector}`,
        "discard the Browserbase session if final verification fails",
      ],
    },
    actor: input.actor,
    createdAt: input.now,
  };
  const artifact = addArtifact({
    runId: input.snapshot.run.id,
    kind: "browser_action",
    title: `Browser action: ${input.draft.title}`,
    data: payload,
    now: input.now,
  });
  const receipt = createReceipt({
    runId: input.snapshot.run.id,
    artifactId: artifact.id,
    status: "executed",
    summary: `${input.draft.title} browser action recorded with before/after evidence.`,
    now: input.now,
  });
  const packet = createQuadChainPacket({
    type: "connector_action",
    orgId: input.snapshot.run.orgId,
    runId: input.snapshot.run.id,
    producer: "quad.browser_actor",
    consumer: "browserbase.write_browser",
    sources: [
      {
        id: input.draft.id,
        kind: "artifact",
        content: {
          title: input.draft.title,
          hash: input.draft.hash,
        },
      },
      {
        id: input.executionArtifact.id,
        kind: "artifact",
        content: {
          title: input.executionArtifact.title,
          hash: input.executionArtifact.hash,
        },
      },
      {
        id: artifact.id,
        kind: "tool_result",
        content: {
          title: artifact.title,
          hash: artifact.hash,
          beforeEvidenceId: before.id,
          afterEvidenceId: after.id,
        },
      },
    ],
    evidence: [
      {
        id: `${artifact.id}:selector`,
        sourceId: artifact.id,
        quote: `Selector ${selector} was filled in an approved browser action fixture.`,
        required: true,
      },
      {
        id: `${artifact.id}:evidence`,
        sourceId: artifact.id,
        quote: `Before evidence ${before.id} and after evidence ${after.id} are hash-bound.`,
        required: true,
      },
    ],
    output: [
      "browser action: browserbase.write_browser",
      "mode: approved_browser_write",
      `source draft: ${input.draft.id}`,
      `execution artifact: ${input.executionArtifact.id}`,
      `browser artifact: ${artifact.id}`,
      `receipt: ${receipt.status}`,
    ].join("\n"),
    answerConcepts: ["browser action", "approved execution", "before evidence", "after evidence"],
    visibility: "internal",
    createdAt: input.now,
  });
  const saved = await saveQuadChainPacket(packet);
  return {
    sourceDraft: {
      id: input.draft.id,
      kind: input.draft.kind,
      title: input.draft.title,
      hash: input.draft.hash,
    },
    executionArtifactId: input.executionArtifact.id,
    artifact,
    receiptId: receipt.id,
    packet: summarizeQuadChainPacket(packet) ?? saved.summary,
  };
}

function stableValueHash(value: string): `fnv1a:${string}` {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
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
