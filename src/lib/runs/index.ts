import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type WorkflowKind =
  | "website_audit"
  | "enterprise_proof"
  | "trust_packet"
  | "agent_bridge"
  | "capability_install"
  | "memory_write";

export type WorkflowRunStatus =
  | "queued"
  | "running"
  | "needs_approval"
  | "completed"
  | "failed";

export type ArtifactKind =
  | "audit_report"
  | "trust_packet"
  | "quad_chain_certificate"
  | "approval_request"
  | "receipt"
  | "cms_draft"
  | "task_draft"
  | "trust_packet_export"
  | "verification_report";

export type ApprovalDecision = "pending" | "approved" | "rejected";

export type WorkflowRunRecord = {
  id: string;
  orgId: string;
  workflowKind: WorkflowKind;
  title: string;
  status: WorkflowRunStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: "dashboard" | "agent" | "system";
  targetUrl?: string;
  taskIds: string[];
  artifactIds: string[];
  approvalIds: string[];
  receiptIds: string[];
  failureReason?: string;
};

export type WorkflowTaskRecord = {
  id: string;
  runId: string;
  title: string;
  status: "queued" | "running" | "blocked" | "completed";
  owner: "quad" | "human" | "connector";
  createdAt: string;
  updatedAt: string;
  dependsOn: string[];
  capabilityId?: string;
  detail: string;
};

export type WorkflowArtifactRecord = {
  id: string;
  runId: string;
  kind: ArtifactKind;
  title: string;
  hash: `fnv1a:${string}`;
  createdAt: string;
  data: unknown;
};

export type ApprovalRecord = {
  id: string;
  runId: string;
  artifactId: string;
  requestedAt: string;
  decision: ApprovalDecision;
  decidedAt: string | null;
  approver: string | null;
  evidenceVisible: boolean;
  reason: string;
};

export type ReceiptRecord = {
  id: string;
  runId: string;
  approvalId: string | null;
  artifactId: string;
  status: "blocked" | "ready" | "executed";
  createdAt: string;
  summary: string;
  artifactHash: `fnv1a:${string}`;
};

export type WorkflowTaskEventKind =
  | "run.created"
  | "run.status_changed"
  | "task.queued"
  | "task.running"
  | "task.blocked"
  | "task.completed"
  | "artifact.created"
  | "approval.requested"
  | "approval.decided"
  | "receipt.created";

export type WorkflowTaskEventActor = "dashboard" | "agent" | "worker" | "quad" | "human" | "connector" | "system";

export type WorkflowTaskEventRecord = {
  id: string;
  runId: string;
  sequence: number;
  kind: WorkflowTaskEventKind;
  actor: WorkflowTaskEventActor;
  message: string;
  createdAt: string;
  taskId?: string;
  artifactId?: string;
  approvalId?: string;
  receiptId?: string;
  capabilityId?: string;
  status?: WorkflowRunStatus | WorkflowTaskRecord["status"] | ApprovalDecision | ReceiptRecord["status"];
  payloadSummary?: Record<string, string | number | boolean | null>;
};

export type WorkflowTaskEventSummary = Pick<
  WorkflowTaskEventRecord,
  | "id"
  | "sequence"
  | "kind"
  | "actor"
  | "message"
  | "createdAt"
  | "taskId"
  | "artifactId"
  | "approvalId"
  | "receiptId"
  | "capabilityId"
  | "status"
>;

export type RunLedgerSnapshot = {
  run: WorkflowRunRecord;
  tasks: WorkflowTaskRecord[];
  artifacts: WorkflowArtifactRecord[];
  approvals: ApprovalRecord[];
  receipts: ReceiptRecord[];
  taskEvents: WorkflowTaskEventRecord[];
};

export type RunLedgerPersistResult = {
  mode: "supabase" | "memory";
  snapshot: RunLedgerSnapshot;
  durableTables?: boolean;
};

export type CreateWorkflowRunInput = {
  id?: string;
  orgId: string;
  workflowKind: WorkflowKind;
  title: string;
  createdBy: WorkflowRunRecord["createdBy"];
  targetUrl?: string;
  now?: string;
};

export type AgentTaskSummary = {
  runId: string;
  status: WorkflowRunStatus;
  title: string;
  targetUrl?: string;
  artifacts: Array<Pick<WorkflowArtifactRecord, "id" | "kind" | "title" | "hash">>;
  approvals: Array<Pick<ApprovalRecord, "id" | "decision" | "reason" | "evidenceVisible">>;
  receipts: Array<Pick<ReceiptRecord, "id" | "status" | "summary" | "artifactHash">>;
  taskEvents: WorkflowTaskEventSummary[];
  nextAction: string;
};

export type ShipTrailStatus = "pending" | "active" | "blocked" | "complete";

export type ShipTrailStep = {
  id: "audit" | "packet" | "approval" | "publish" | "verify";
  label: string;
  status: ShipTrailStatus;
  summary: string;
  artifactId?: string;
  receiptId?: string;
  href: string;
  createdAt: string;
};

export type HostedRunDetail = {
  run: WorkflowRunRecord;
  task: AgentTaskSummary;
  shipTrail: ShipTrailStep[];
  tasks: WorkflowTaskRecord[];
  artifacts: Array<Omit<WorkflowArtifactRecord, "data"> & {
    href: string;
    dataPreview: unknown;
  }>;
  approvals: ApprovalRecord[];
  receipts: ReceiptRecord[];
  taskEvents: WorkflowTaskEventSummary[];
  links: {
    self: string;
    artifacts: string;
    tasks: string;
    taskEvents: string;
  };
};

export type HostedTaskStream = {
  run: Pick<WorkflowRunRecord, "id" | "orgId" | "title" | "status" | "targetUrl" | "updatedAt">;
  events: WorkflowTaskEventSummary[];
  cursor: {
    afterSequence: number;
    latestSequence: number;
    nextAfterSequence: number | null;
    limit: number;
  };
  links: {
    self: string;
    run: string;
  };
};

export type HostedArtifactDetail = Omit<WorkflowArtifactRecord, "data"> & {
  data: unknown;
  dataPreview: unknown;
  rawDataIncluded: boolean;
  run: Pick<WorkflowRunRecord, "id" | "orgId" | "title" | "status" | "targetUrl">;
  links: {
    self: string;
    run: string;
  };
};

export type HostedTaskDetail = WorkflowTaskRecord & {
  run: Pick<WorkflowRunRecord, "id" | "orgId" | "title" | "status" | "targetUrl">;
  links: {
    self: string;
    run: string;
  };
};

const g = globalThis as typeof globalThis & {
  __quadRunLedger?: Map<string, RunLedgerSnapshot>;
};
if (!g.__quadRunLedger) g.__quadRunLedger = new Map();
const ledger = g.__quadRunLedger;

export function createWorkflowRun(input: CreateWorkflowRunInput): WorkflowRunRecord {
  const now = input.now ?? new Date().toISOString();
  const run: WorkflowRunRecord = {
    id: input.id ?? `run_${crypto.randomUUID()}`,
    orgId: input.orgId,
    workflowKind: input.workflowKind,
    title: input.title,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
    targetUrl: input.targetUrl,
    taskIds: [],
    artifactIds: [],
    approvalIds: [],
    receiptIds: [],
  };

  ledger.set(run.id, {
    run,
    tasks: [],
    artifacts: [],
    approvals: [],
    receipts: [],
    taskEvents: [],
  });
  appendTaskEvent({
    runId: run.id,
    kind: "run.created",
    actor: input.createdBy,
    message: `${input.title} created.`,
    status: "queued",
    now,
    payloadSummary: {
      workflowKind: input.workflowKind,
      targetUrl: input.targetUrl ?? null,
    },
  });
  pruneLedger();
  return run;
}

export function getRunSnapshot(runId: string): RunLedgerSnapshot | null {
  const snapshot = ledger.get(runId);
  if (!snapshot) return null;
  return cloneSnapshot(snapshot);
}

export async function saveRunSnapshot(runId: string): Promise<RunLedgerPersistResult> {
  const snapshot = getRunSnapshot(runId);
  if (!snapshot) throw new Error(`Run not found: ${runId}`);

  const db = getRunLedgerClient();
  if (!db) return { mode: "memory", snapshot };

  const { error } = await db
    .from("workflow_run_snapshots")
    .upsert(toRunSnapshotRow(snapshot), { onConflict: "id" });
  if (error) return { mode: "memory", snapshot };

  const durableTables = await saveNormalizedRunLedger(db, snapshot);

  return { mode: "supabase", snapshot, durableTables };
}

export async function loadRunSnapshot(runId: string): Promise<RunLedgerSnapshot | null> {
  const memory = getRunSnapshot(runId);
  if (memory) return memory;

  const db = getRunLedgerClient();
  if (!db) return null;

  const { data, error } = await db
    .from("workflow_run_snapshots")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (error) return loadNormalizedRunLedger(db, runId);
  if (!data) return loadNormalizedRunLedger(db, runId);

  const snapshot = fromRunSnapshotRow(data);
  ledger.set(snapshot.run.id, cloneSnapshot(snapshot));
  pruneLedger();
  return snapshot;
}

export async function listRunSnapshots(input: {
  orgId?: string;
  status?: WorkflowRunStatus;
  limit?: number;
} = {}): Promise<RunLedgerSnapshot[]> {
  const limit = clampListLimit(input.limit);
  const db = getRunLedgerClient();

  if (db) {
    let query = db
      .from("workflow_run_snapshots")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (input.orgId) query = query.eq("org_id", input.orgId);
    if (input.status) query = query.eq("status", input.status);
    const { data, error } = await query;
    if (error) return listMemoryRunSnapshots(input, limit);
    return (data ?? []).map(fromRunSnapshotRow);
  }

  return listMemoryRunSnapshots(input, limit);
}

export async function deleteRunSnapshots(input: { orgId: string; runId?: string }): Promise<number> {
  const memoryRuns = [...ledger.values()].filter((snapshot) =>
    snapshot.run.orgId === input.orgId && (!input.runId || snapshot.run.id === input.runId)
  );
  for (const snapshot of memoryRuns) {
    ledger.delete(snapshot.run.id);
  }

  const db = getRunLedgerClient();
  if (!db) return memoryRuns.length;

  try {
    const runIds = input.runId
      ? [input.runId]
      : ((await db.from("workflow_runs").select("id").eq("org_id", input.orgId)).data ?? [])
          .map((row) => String((row as { id: unknown }).id));
    if (runIds.length === 0) {
      await db.from("workflow_run_snapshots").delete().eq("org_id", input.orgId);
      return memoryRuns.length;
    }

    let snapshotDelete = db.from("workflow_run_snapshots").delete().eq("org_id", input.orgId);
    if (input.runId) snapshotDelete = snapshotDelete.eq("id", input.runId);
    await snapshotDelete;

    let runDelete = db.from("workflow_runs").delete().eq("org_id", input.orgId);
    if (input.runId) runDelete = runDelete.eq("id", input.runId);
    const { error } = await runDelete;
    if (error) return memoryRuns.length;

    return Math.max(memoryRuns.length, runIds.length);
  } catch {
    return memoryRuns.length;
  }
}

function listMemoryRunSnapshots(
  input: { orgId?: string; status?: WorkflowRunStatus },
  limit: number
): RunLedgerSnapshot[] {
  return Array.from(ledger.values())
    .map(cloneSnapshot)
    .filter((snapshot) => !input.orgId || snapshot.run.orgId === input.orgId)
    .filter((snapshot) => !input.status || snapshot.run.status === input.status)
    .sort((a, b) => b.run.updatedAt.localeCompare(a.run.updatedAt))
    .slice(0, limit);
}

export function transitionRun(
  runId: string,
  status: WorkflowRunStatus,
  input: { now?: string; failureReason?: string } = {}
): WorkflowRunRecord {
  const snapshot = requireSnapshot(runId);
  const previousStatus = snapshot.run.status;
  const updated: WorkflowRunRecord = {
    ...snapshot.run,
    status,
    updatedAt: input.now ?? new Date().toISOString(),
    failureReason: input.failureReason,
  };
  snapshot.run = updated;
  if (previousStatus !== status || input.failureReason) {
    appendTaskEvent({
      runId,
      kind: "run.status_changed",
      actor: "system",
      message: input.failureReason
        ? `Run moved to ${status}: ${input.failureReason}`
        : `Run moved from ${previousStatus} to ${status}.`,
      status,
      now: updated.updatedAt,
      payloadSummary: {
        previousStatus,
        failureReason: input.failureReason ?? null,
      },
    });
  }
  return updated;
}

export function addTask(input: {
  runId: string;
  title: string;
  status: WorkflowTaskRecord["status"];
  owner: WorkflowTaskRecord["owner"];
  detail: string;
  dependsOn?: string[];
  capabilityId?: string;
  now?: string;
}): WorkflowTaskRecord {
  const snapshot = requireSnapshot(input.runId);
  const now = input.now ?? new Date().toISOString();
  const task: WorkflowTaskRecord = {
    id: `task_${shortId(input.runId, input.title, snapshot.tasks.length)}`,
    runId: input.runId,
    title: input.title,
    status: input.status,
    owner: input.owner,
    createdAt: now,
    updatedAt: now,
    dependsOn: input.dependsOn ?? [],
    capabilityId: input.capabilityId,
    detail: input.detail,
  };

  snapshot.tasks.push(task);
  snapshot.run = {
    ...snapshot.run,
    taskIds: [...snapshot.run.taskIds, task.id],
    updatedAt: now,
  };
  appendTaskEvent({
    runId: input.runId,
    kind: taskEventKindForTaskStatus(task.status),
    actor: task.owner,
    message: `${task.title}: ${task.detail}`,
    taskId: task.id,
    capabilityId: task.capabilityId,
    status: task.status,
    now,
    payloadSummary: {
      owner: task.owner,
      dependencyCount: task.dependsOn.length,
      capabilityId: task.capabilityId ?? null,
    },
  });
  return task;
}

export function addArtifact(input: {
  runId: string;
  kind: ArtifactKind;
  title: string;
  data: unknown;
  now?: string;
}): WorkflowArtifactRecord {
  const snapshot = requireSnapshot(input.runId);
  const now = input.now ?? new Date().toISOString();
  const artifact: WorkflowArtifactRecord = {
    id: `artifact_${shortId(input.runId, input.kind, snapshot.artifacts.length)}`,
    runId: input.runId,
    kind: input.kind,
    title: input.title,
    hash: stableHash(input.data),
    createdAt: now,
    data: input.data,
  };

  snapshot.artifacts.push(artifact);
  snapshot.run = {
    ...snapshot.run,
    artifactIds: [...snapshot.run.artifactIds, artifact.id],
    updatedAt: now,
  };
  appendTaskEvent({
    runId: input.runId,
    kind: "artifact.created",
    actor: "quad",
    message: `${artifact.title} artifact created.`,
    artifactId: artifact.id,
    now,
    payloadSummary: {
      kind: artifact.kind,
      hash: artifact.hash,
    },
  });
  return artifact;
}

export function requestApproval(input: {
  runId: string;
  artifactId: string;
  reason: string;
  evidenceVisible: boolean;
  now?: string;
}): ApprovalRecord {
  const snapshot = requireSnapshot(input.runId);
  const now = input.now ?? new Date().toISOString();
  const approval: ApprovalRecord = {
    id: `approval_${shortId(input.runId, input.artifactId, snapshot.approvals.length)}`,
    runId: input.runId,
    artifactId: input.artifactId,
    requestedAt: now,
    decision: "pending",
    decidedAt: null,
    approver: null,
    evidenceVisible: input.evidenceVisible,
    reason: input.reason,
  };

  snapshot.approvals.push(approval);
  snapshot.run = {
    ...snapshot.run,
    status: "needs_approval",
    approvalIds: [...snapshot.run.approvalIds, approval.id],
    updatedAt: now,
  };
  appendTaskEvent({
    runId: input.runId,
    kind: "approval.requested",
    actor: "quad",
    message: approval.reason,
    approvalId: approval.id,
    artifactId: approval.artifactId,
    status: "pending",
    now,
    payloadSummary: {
      evidenceVisible: approval.evidenceVisible,
    },
  });
  return approval;
}

export function decideApproval(input: {
  runId: string;
  approvalId: string;
  decision: Exclude<ApprovalDecision, "pending">;
  approver: string;
  now?: string;
}): ApprovalRecord {
  const snapshot = requireSnapshot(input.runId);
  const index = snapshot.approvals.findIndex((approval) => approval.id === input.approvalId);
  if (index === -1) throw new Error(`Approval not found: ${input.approvalId}`);
  const updated: ApprovalRecord = {
    ...snapshot.approvals[index],
    decision: input.decision,
    decidedAt: input.now ?? new Date().toISOString(),
    approver: input.approver,
  };
  snapshot.approvals[index] = updated;
  snapshot.run = { ...snapshot.run, updatedAt: updated.decidedAt ?? new Date().toISOString() };
  appendTaskEvent({
    runId: input.runId,
    kind: "approval.decided",
    actor: "human",
    message: `Approval ${input.decision} by ${input.approver}.`,
    approvalId: updated.id,
    artifactId: updated.artifactId,
    status: updated.decision,
    now: updated.decidedAt ?? undefined,
    payloadSummary: {
      approver: input.approver,
    },
  });
  return updated;
}

export function createReceipt(input: {
  runId: string;
  artifactId: string;
  approvalId?: string | null;
  status: ReceiptRecord["status"];
  summary: string;
  now?: string;
}): ReceiptRecord {
  const snapshot = requireSnapshot(input.runId);
  const artifact = snapshot.artifacts.find((item) => item.id === input.artifactId);
  if (!artifact) throw new Error(`Artifact not found: ${input.artifactId}`);
  const now = input.now ?? new Date().toISOString();
  const receipt: ReceiptRecord = {
    id: `receipt_${shortId(input.runId, input.artifactId, snapshot.receipts.length)}`,
    runId: input.runId,
    approvalId: input.approvalId ?? null,
    artifactId: input.artifactId,
    status: input.status,
    createdAt: now,
    summary: input.summary,
    artifactHash: artifact.hash,
  };

  snapshot.receipts.push(receipt);
  snapshot.run = {
    ...snapshot.run,
    receiptIds: [...snapshot.run.receiptIds, receipt.id],
    updatedAt: now,
  };
  appendTaskEvent({
    runId: input.runId,
    kind: "receipt.created",
    actor: "quad",
    message: receipt.summary,
    receiptId: receipt.id,
    artifactId: receipt.artifactId,
    approvalId: receipt.approvalId ?? undefined,
    status: receipt.status,
    now,
    payloadSummary: {
      artifactHash: receipt.artifactHash,
    },
  });
  return receipt;
}

export function appendTaskEvent(input: {
  runId: string;
  kind: WorkflowTaskEventKind;
  actor: WorkflowTaskEventActor;
  message: string;
  now?: string;
  taskId?: string;
  artifactId?: string;
  approvalId?: string;
  receiptId?: string;
  capabilityId?: string;
  status?: WorkflowTaskEventRecord["status"];
  payloadSummary?: WorkflowTaskEventRecord["payloadSummary"];
}): WorkflowTaskEventRecord {
  const snapshot = requireSnapshot(input.runId);
  const events = ensureTaskEvents(snapshot);
  const now = input.now ?? new Date().toISOString();
  const sequence = events.length + 1;
  const event: WorkflowTaskEventRecord = {
    id: `event_${shortId(input.runId, input.kind, sequence, now)}`,
    runId: input.runId,
    sequence,
    kind: input.kind,
    actor: input.actor,
    message: input.message,
    createdAt: now,
    taskId: input.taskId,
    artifactId: input.artifactId,
    approvalId: input.approvalId,
    receiptId: input.receiptId,
    capabilityId: input.capabilityId,
    status: input.status,
    payloadSummary: input.payloadSummary,
  };
  events.push(event);
  snapshot.run = { ...snapshot.run, updatedAt: now };
  return event;
}

export function summarizeTaskStream(snapshot: RunLedgerSnapshot, limit = 50): WorkflowTaskEventSummary[] {
  return ensureTaskEvents(snapshot)
    .slice(-Math.max(1, Math.min(limit, 200)))
    .map((event) => ({
      id: event.id,
      sequence: event.sequence,
      kind: event.kind,
      actor: event.actor,
      message: event.message,
      createdAt: event.createdAt,
      taskId: event.taskId,
      artifactId: event.artifactId,
      approvalId: event.approvalId,
      receiptId: event.receiptId,
      capabilityId: event.capabilityId,
      status: event.status,
    }));
}

export function buildHostedTaskStream(
  snapshot: RunLedgerSnapshot,
  input: { afterSequence?: number; limit?: number } = {}
): HostedTaskStream {
  const limit = clampTaskEventLimit(input.limit);
  const afterSequence = Number.isFinite(input.afterSequence) ? Math.max(0, Math.floor(input.afterSequence ?? 0)) : 0;
  const events = ensureTaskEvents(snapshot)
    .filter((event) => event.sequence > afterSequence)
    .slice(0, limit)
    .map((event) => ({
      id: event.id,
      sequence: event.sequence,
      kind: event.kind,
      actor: event.actor,
      message: event.message,
      createdAt: event.createdAt,
      taskId: event.taskId,
      artifactId: event.artifactId,
      approvalId: event.approvalId,
      receiptId: event.receiptId,
      capabilityId: event.capabilityId,
      status: event.status,
    }));
  const latestSequence = ensureTaskEvents(snapshot).at(-1)?.sequence ?? 0;
  const lastReturnedSequence = events.at(-1)?.sequence ?? afterSequence;

  return {
    run: {
      id: snapshot.run.id,
      orgId: snapshot.run.orgId,
      title: snapshot.run.title,
      status: snapshot.run.status,
      targetUrl: snapshot.run.targetUrl,
      updatedAt: snapshot.run.updatedAt,
    },
    events,
    cursor: {
      afterSequence,
      latestSequence,
      nextAfterSequence: lastReturnedSequence < latestSequence ? lastReturnedSequence : null,
      limit,
    },
    links: {
      self: `/api/runs/${snapshot.run.id}/events`,
      run: `/api/runs/${snapshot.run.id}`,
    },
  };
}

export function assertCustomerWriteAllowed(snapshot: RunLedgerSnapshot): void {
  const pending = snapshot.approvals.find((approval) => approval.decision === "pending");
  if (pending) throw new Error(`Approval pending: ${pending.id}`);
  const rejected = snapshot.approvals.find((approval) => approval.decision === "rejected");
  if (rejected) throw new Error(`Approval rejected: ${rejected.id}`);
  const approved = snapshot.approvals.some((approval) => approval.decision === "approved");
  if (!approved) throw new Error("Customer write requires an approved approval record.");
}

export function summarizeAgentTask(snapshot: RunLedgerSnapshot): AgentTaskSummary {
  const pendingApproval = snapshot.approvals.find((approval) => approval.decision === "pending");
  const blockedReceipt = snapshot.receipts.find((receipt) => receipt.status === "blocked");

  return {
    runId: snapshot.run.id,
    status: snapshot.run.status,
    title: snapshot.run.title,
    targetUrl: snapshot.run.targetUrl,
    artifacts: snapshot.artifacts.map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title,
      hash: artifact.hash,
    })),
    approvals: snapshot.approvals.map((approval) => ({
      id: approval.id,
      decision: approval.decision,
      reason: approval.reason,
      evidenceVisible: approval.evidenceVisible,
    })),
    receipts: snapshot.receipts.map((receipt) => ({
      id: receipt.id,
      status: receipt.status,
      summary: receipt.summary,
      artifactHash: receipt.artifactHash,
    })),
    taskEvents: summarizeTaskStream(snapshot, 20),
    nextAction: pendingApproval
      ? "Human approval required before customer-facing work can ship."
      : blockedReceipt
        ? "Resolve blocked receipt before execution."
        : snapshot.run.status === "completed"
          ? "Run complete."
          : "Continue workflow.",
  };
}

export function buildHostedRunDetail(snapshot: RunLedgerSnapshot): HostedRunDetail {
  return {
    run: { ...snapshot.run },
    task: summarizeAgentTask(snapshot),
    shipTrail: buildShipTrail(snapshot),
    tasks: snapshot.tasks.map((task) => ({ ...task, dependsOn: [...task.dependsOn] })),
    artifacts: snapshot.artifacts.map((artifact) => ({
      id: artifact.id,
      runId: artifact.runId,
      kind: artifact.kind,
      title: artifact.title,
      hash: artifact.hash,
      createdAt: artifact.createdAt,
      href: `/api/runs/${snapshot.run.id}/artifacts/${artifact.id}`,
      dataPreview: previewArtifactData(artifact.data),
    })),
    approvals: snapshot.approvals.map((approval) => ({ ...approval })),
    receipts: snapshot.receipts.map((receipt) => ({ ...receipt })),
    taskEvents: summarizeTaskStream(snapshot, 100),
    links: {
      self: `/api/runs/${snapshot.run.id}`,
      artifacts: `/api/runs/${snapshot.run.id}/artifacts`,
      tasks: `/api/runs/${snapshot.run.id}/tasks`,
      taskEvents: `/api/runs/${snapshot.run.id}/events`,
    },
  };
}

export function buildShipTrail(snapshot: RunLedgerSnapshot): ShipTrailStep[] {
  const audit = latestArtifact(snapshot, "audit_report");
  const packet = latestArtifact(snapshot, "trust_packet");
  const approval = latestApproval(snapshot);
  const published =
    latestArtifact(snapshot, "cms_draft") ??
    latestArtifact(snapshot, "task_draft") ??
    latestArtifact(snapshot, "trust_packet_export");
  const verification = latestArtifact(snapshot, "verification_report");

  return [
    {
      id: "audit",
      label: "Audit",
      status: audit ? "complete" : snapshot.run.status === "running" ? "active" : "pending",
      summary: audit ? "Audit report captured and stored." : "Waiting for website audit evidence.",
      artifactId: audit?.id,
      href: artifactHref(snapshot.run.id, audit?.id),
      createdAt: audit?.createdAt ?? snapshot.run.createdAt,
    },
    {
      id: "packet",
      label: "Packet",
      status: packet ? "complete" : audit ? "active" : "pending",
      summary: packet ? "Trust packet assembled from audit evidence." : "Waiting for trust packet assembly.",
      artifactId: packet?.id,
      href: artifactHref(snapshot.run.id, packet?.id),
      createdAt: packet?.createdAt ?? audit?.createdAt ?? snapshot.run.createdAt,
    },
    {
      id: "approval",
      label: "Approval",
      status: approvalStatus(approval),
      summary: approval
        ? approval.decision === "pending"
          ? approval.reason
          : `Approval ${approval.decision} by ${approval.approver ?? "operator"}.`
        : "No approval request has been created yet.",
      artifactId: approval?.artifactId,
      href: `/api/runs/${snapshot.run.id}`,
      createdAt: approval?.decidedAt ?? approval?.requestedAt ?? packet?.createdAt ?? snapshot.run.createdAt,
    },
    {
      id: "publish",
      label: "Publish",
      status: published ? "complete" : approval?.decision === "approved" ? "active" : approval?.decision === "rejected" ? "blocked" : "pending",
      summary: published ? "Dry-run publisher artifacts are staged." : "Waiting for approved publish staging.",
      artifactId: published?.id,
      receiptId: receiptForArtifact(snapshot, published?.id)?.id,
      href: artifactHref(snapshot.run.id, published?.id),
      createdAt: published?.createdAt ?? approval?.decidedAt ?? approval?.requestedAt ?? snapshot.run.createdAt,
    },
    {
      id: "verify",
      label: "Verify",
      status: verification ? verificationStatus(snapshot, verification.id) : published ? "active" : "pending",
      summary: verification
        ? receiptForArtifact(snapshot, verification.id)?.summary ?? "Post-ship verification report created."
        : "Waiting for staged fix verification.",
      artifactId: verification?.id,
      receiptId: receiptForArtifact(snapshot, verification?.id)?.id,
      href: artifactHref(snapshot.run.id, verification?.id),
      createdAt: verification?.createdAt ?? published?.createdAt ?? snapshot.run.updatedAt,
    },
  ];
}

export function getHostedArtifactDetail(
  snapshot: RunLedgerSnapshot,
  artifactId: string,
  input: { includeRawData?: boolean } = {}
): HostedArtifactDetail | null {
  const artifact = snapshot.artifacts.find((item) => item.id === artifactId);
  if (!artifact) return null;
  return {
    id: artifact.id,
    runId: artifact.runId,
    kind: artifact.kind,
    title: artifact.title,
    hash: artifact.hash,
    createdAt: artifact.createdAt,
    data: input.includeRawData ? artifact.data : previewArtifactData(artifact.data),
    dataPreview: previewArtifactData(artifact.data),
    rawDataIncluded: Boolean(input.includeRawData),
    run: runReference(snapshot.run),
    links: {
      self: `/api/runs/${snapshot.run.id}/artifacts/${artifact.id}`,
      run: `/api/runs/${snapshot.run.id}`,
    },
  };
}

export function getHostedTaskDetail(
  snapshot: RunLedgerSnapshot,
  taskId: string
): HostedTaskDetail | null {
  const task = snapshot.tasks.find((item) => item.id === taskId);
  if (!task) return null;
  return {
    ...task,
    dependsOn: [...task.dependsOn],
    run: runReference(snapshot.run),
    links: {
      self: `/api/runs/${snapshot.run.id}/tasks/${task.id}`,
      run: `/api/runs/${snapshot.run.id}`,
    },
  };
}

function requireSnapshot(runId: string): RunLedgerSnapshot {
  const snapshot = ledger.get(runId);
  if (!snapshot) throw new Error(`Run not found: ${runId}`);
  return snapshot;
}

function cloneSnapshot(snapshot: RunLedgerSnapshot): RunLedgerSnapshot {
  return {
    run: { ...snapshot.run },
    tasks: snapshot.tasks.map((task) => ({ ...task, dependsOn: [...task.dependsOn] })),
    artifacts: snapshot.artifacts.map((artifact) => ({ ...artifact })),
    approvals: snapshot.approvals.map((approval) => ({ ...approval })),
    receipts: snapshot.receipts.map((receipt) => ({ ...receipt })),
    taskEvents: ensureTaskEvents(snapshot).map((event) => ({
      ...event,
      payloadSummary: event.payloadSummary ? { ...event.payloadSummary } : undefined,
    })),
  };
}

function ensureTaskEvents(snapshot: RunLedgerSnapshot): WorkflowTaskEventRecord[] {
  const maybeSnapshot = snapshot as RunLedgerSnapshot & { taskEvents?: WorkflowTaskEventRecord[] };
  if (!Array.isArray(maybeSnapshot.taskEvents)) maybeSnapshot.taskEvents = [];
  return maybeSnapshot.taskEvents;
}

function taskEventKindForTaskStatus(status: WorkflowTaskRecord["status"]): WorkflowTaskEventKind {
  switch (status) {
    case "queued":
      return "task.queued";
    case "running":
      return "task.running";
    case "blocked":
      return "task.blocked";
    case "completed":
    default:
      return "task.completed";
  }
}

function pruneLedger(): void {
  if (ledger.size <= 50) return;
  const oldest = ledger.keys().next().value;
  if (oldest) ledger.delete(oldest);
}

function shortId(...parts: unknown[]): string {
  return stableHash(parts).replace("fnv1a:", "").slice(0, 12);
}

function stableHash(value: unknown): `fnv1a:${string}` {
  const encoded = new TextEncoder().encode(stableStringify(value));
  let hash = 2166136261;
  for (const byte of encoded) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}

function getRunLedgerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;

  const global = globalThis as typeof globalThis & {
    __quadRunLedgerClient?: SupabaseClient;
  };
  if (global.__quadRunLedgerClient) return global.__quadRunLedgerClient;

  global.__quadRunLedgerClient = createClient(url, key, { auth: { persistSession: false } });
  return global.__quadRunLedgerClient;
}

function toRunSnapshotRow(snapshot: RunLedgerSnapshot) {
  return {
    id: snapshot.run.id,
    org_id: snapshot.run.orgId,
    workflow_kind: snapshot.run.workflowKind,
    status: snapshot.run.status,
    title: snapshot.run.title,
    target_url: snapshot.run.targetUrl ?? null,
    created_by: snapshot.run.createdBy,
    approval_count: snapshot.approvals.length,
    pending_approval_count: snapshot.approvals.filter((approval) => approval.decision === "pending").length,
    receipt_count: snapshot.receipts.length,
    artifact_count: snapshot.artifacts.length,
    snapshot,
    created_at: snapshot.run.createdAt,
    updated_at: snapshot.run.updatedAt,
  };
}

function fromRunSnapshotRow(row: Record<string, unknown>): RunLedgerSnapshot {
  const snapshot = row.snapshot as RunLedgerSnapshot | undefined;
  if (!snapshot?.run) throw new Error("Run ledger row is missing snapshot data.");
  return cloneSnapshot(snapshot);
}

async function saveNormalizedRunLedger(
  db: SupabaseClient,
  snapshot: RunLedgerSnapshot
): Promise<boolean> {
  try {
    const run = toWorkflowRunRow(snapshot.run);
    const { error: runError } = await db
      .from("workflow_runs")
      .upsert(run, { onConflict: "id" });
    if (runError) return false;

    const taskRows = snapshot.tasks.map(toWorkflowTaskRow);
    if (taskRows.length > 0) {
      const { error } = await db.from("workflow_tasks").upsert(taskRows, { onConflict: "id" });
      if (error) return false;
    }

    const artifactRows = snapshot.artifacts.map(toWorkflowArtifactRow);
    if (artifactRows.length > 0) {
      const { error } = await db.from("workflow_artifacts").upsert(artifactRows, { onConflict: "id" });
      if (error) return false;
    }

    const approvalRows = snapshot.approvals.map(toWorkflowApprovalRow);
    if (approvalRows.length > 0) {
      const { error } = await db.from("workflow_approvals").upsert(approvalRows, { onConflict: "id" });
      if (error) return false;
    }

    const receiptRows = snapshot.receipts.map(toWorkflowReceiptRow);
    if (receiptRows.length > 0) {
      const { error } = await db.from("workflow_receipts").upsert(receiptRows, { onConflict: "id" });
      if (error) return false;
    }

    const eventRows = ensureTaskEvents(snapshot).map(toWorkflowTaskEventRow);
    if (eventRows.length > 0) {
      const { error } = await db.from("workflow_task_events").upsert(eventRows, { onConflict: "id" });
      if (error) return false;
    }

    return true;
  } catch {
    return false;
  }
}

async function loadNormalizedRunLedger(
  db: SupabaseClient,
  runId: string
): Promise<RunLedgerSnapshot | null> {
  try {
    const { data: runRow, error: runError } = await db
      .from("workflow_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();
    if (runError || !runRow) return null;

    const [tasks, artifacts, approvals, receipts, taskEvents] = await Promise.all([
      db.from("workflow_tasks").select("*").eq("run_id", runId).order("created_at", { ascending: true }),
      db.from("workflow_artifacts").select("*").eq("run_id", runId).order("created_at", { ascending: true }),
      db.from("workflow_approvals").select("*").eq("run_id", runId).order("requested_at", { ascending: true }),
      db.from("workflow_receipts").select("*").eq("run_id", runId).order("created_at", { ascending: true }),
      db.from("workflow_task_events").select("*").eq("run_id", runId).order("sequence", { ascending: true }),
    ]);

    if (tasks.error || artifacts.error || approvals.error || receipts.error || taskEvents.error) return null;

    const taskRecords = (tasks.data ?? []).map(fromWorkflowTaskRow);
    const artifactRecords = (artifacts.data ?? []).map(fromWorkflowArtifactRow);
    const approvalRecords = (approvals.data ?? []).map(fromWorkflowApprovalRow);
    const receiptRecords = (receipts.data ?? []).map(fromWorkflowReceiptRow);
    const run = fromWorkflowRunRow(runRow as Record<string, unknown>, {
      taskIds: taskRecords.map((task) => task.id),
      artifactIds: artifactRecords.map((artifact) => artifact.id),
      approvalIds: approvalRecords.map((approval) => approval.id),
      receiptIds: receiptRecords.map((receipt) => receipt.id),
    });

    const snapshot = {
      run,
      tasks: taskRecords,
      artifacts: artifactRecords,
      approvals: approvalRecords,
      receipts: receiptRecords,
      taskEvents: (taskEvents.data ?? []).map(fromWorkflowTaskEventRow),
    };
    ledger.set(snapshot.run.id, cloneSnapshot(snapshot));
    pruneLedger();
    return cloneSnapshot(snapshot);
  } catch {
    return null;
  }
}

export function toWorkflowRunRow(run: WorkflowRunRecord) {
  return {
    id: run.id,
    org_id: run.orgId,
    workflow_kind: run.workflowKind,
    title: run.title,
    status: run.status,
    created_by: run.createdBy,
    target_url: run.targetUrl ?? null,
    failure_reason: run.failureReason ?? null,
    created_at: run.createdAt,
    updated_at: run.updatedAt,
  };
}

export function toWorkflowTaskRow(task: WorkflowTaskRecord) {
  return {
    id: task.id,
    run_id: task.runId,
    title: task.title,
    status: task.status,
    owner: task.owner,
    depends_on: task.dependsOn,
    capability_id: task.capabilityId ?? null,
    detail: task.detail,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

export function toWorkflowTaskEventRow(event: WorkflowTaskEventRecord) {
  return {
    id: event.id,
    run_id: event.runId,
    sequence: event.sequence,
    event_kind: event.kind,
    actor: event.actor,
    message: event.message,
    task_id: event.taskId ?? null,
    artifact_id: event.artifactId ?? null,
    approval_id: event.approvalId ?? null,
    receipt_id: event.receiptId ?? null,
    capability_id: event.capabilityId ?? null,
    status: event.status ?? null,
    payload_summary: event.payloadSummary ?? null,
    created_at: event.createdAt,
  };
}

export function toWorkflowArtifactRow(artifact: WorkflowArtifactRecord) {
  return {
    id: artifact.id,
    run_id: artifact.runId,
    artifact_kind: artifact.kind,
    title: artifact.title,
    hash: artifact.hash,
    data: artifact.data,
    created_at: artifact.createdAt,
  };
}

export function toWorkflowApprovalRow(approval: ApprovalRecord) {
  return {
    id: approval.id,
    run_id: approval.runId,
    artifact_id: approval.artifactId,
    decision: approval.decision,
    approver: approval.approver,
    evidence_visible: approval.evidenceVisible,
    reason: approval.reason,
    requested_at: approval.requestedAt,
    decided_at: approval.decidedAt,
  };
}

export function toWorkflowReceiptRow(receipt: ReceiptRecord) {
  return {
    id: receipt.id,
    run_id: receipt.runId,
    approval_id: receipt.approvalId,
    artifact_id: receipt.artifactId,
    status: receipt.status,
    summary: receipt.summary,
    artifact_hash: receipt.artifactHash,
    created_at: receipt.createdAt,
  };
}

export function fromWorkflowRunRow(
  row: Record<string, unknown>,
  ids: {
    taskIds?: string[];
    artifactIds?: string[];
    approvalIds?: string[];
    receiptIds?: string[];
  } = {}
): WorkflowRunRecord {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    workflowKind: row.workflow_kind as WorkflowKind,
    title: String(row.title),
    status: row.status as WorkflowRunStatus,
    createdBy: row.created_by as WorkflowRunRecord["createdBy"],
    targetUrl: optionalString(row.target_url),
    failureReason: optionalString(row.failure_reason),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    taskIds: ids.taskIds ?? [],
    artifactIds: ids.artifactIds ?? [],
    approvalIds: ids.approvalIds ?? [],
    receiptIds: ids.receiptIds ?? [],
  };
}

export function fromWorkflowTaskRow(row: Record<string, unknown>): WorkflowTaskRecord {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    title: String(row.title),
    status: row.status as WorkflowTaskRecord["status"],
    owner: row.owner as WorkflowTaskRecord["owner"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    dependsOn: Array.isArray(row.depends_on) ? row.depends_on.map(String) : [],
    capabilityId: optionalString(row.capability_id),
    detail: String(row.detail),
  };
}

export function fromWorkflowTaskEventRow(row: Record<string, unknown>): WorkflowTaskEventRecord {
  const payloadSummary = isPayloadSummary(row.payload_summary);
  return {
    id: String(row.id),
    runId: String(row.run_id),
    sequence: Number(row.sequence),
    kind: row.event_kind as WorkflowTaskEventKind,
    actor: row.actor as WorkflowTaskEventActor,
    message: String(row.message),
    createdAt: String(row.created_at),
    taskId: optionalString(row.task_id),
    artifactId: optionalString(row.artifact_id),
    approvalId: optionalString(row.approval_id),
    receiptId: optionalString(row.receipt_id),
    capabilityId: optionalString(row.capability_id),
    status: optionalString(row.status) as WorkflowTaskEventRecord["status"],
    payloadSummary,
  };
}

export function fromWorkflowArtifactRow(row: Record<string, unknown>): WorkflowArtifactRecord {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    kind: row.artifact_kind as ArtifactKind,
    title: String(row.title),
    hash: String(row.hash) as `fnv1a:${string}`,
    createdAt: String(row.created_at),
    data: row.data,
  };
}

export function fromWorkflowApprovalRow(row: Record<string, unknown>): ApprovalRecord {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    artifactId: String(row.artifact_id),
    requestedAt: String(row.requested_at),
    decision: row.decision as ApprovalDecision,
    decidedAt: optionalString(row.decided_at) ?? null,
    approver: optionalString(row.approver) ?? null,
    evidenceVisible: Boolean(row.evidence_visible),
    reason: String(row.reason),
  };
}

export function fromWorkflowReceiptRow(row: Record<string, unknown>): ReceiptRecord {
  return {
    id: String(row.id),
    runId: String(row.run_id),
    approvalId: optionalString(row.approval_id) ?? null,
    artifactId: String(row.artifact_id),
    status: row.status as ReceiptRecord["status"],
    createdAt: String(row.created_at),
    summary: String(row.summary),
    artifactHash: String(row.artifact_hash) as `fnv1a:${string}`,
  };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function clampListLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return 25;
  return Math.max(1, Math.min(100, Math.floor(value ?? 25)));
}

function clampTaskEventLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(1, Math.min(200, Math.floor(value ?? 50)));
}

function isPayloadSummary(value: unknown): WorkflowTaskEventRecord["payloadSummary"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.every(([, item]) => ["string", "number", "boolean"].includes(typeof item) || item === null)) {
    return value as WorkflowTaskEventRecord["payloadSummary"];
  }
  return undefined;
}

function runReference(run: WorkflowRunRecord): HostedArtifactDetail["run"] {
  return {
    id: run.id,
    orgId: run.orgId,
    title: run.title,
    status: run.status,
    targetUrl: run.targetUrl,
  };
}

function latestArtifact(snapshot: RunLedgerSnapshot, kind: ArtifactKind): WorkflowArtifactRecord | undefined {
  return snapshot.artifacts
    .filter((artifact) => artifact.kind === kind)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function latestApproval(snapshot: RunLedgerSnapshot): ApprovalRecord | undefined {
  return snapshot.approvals
    .slice()
    .sort((a, b) => (b.decidedAt ?? b.requestedAt).localeCompare(a.decidedAt ?? a.requestedAt))[0];
}

function artifactHref(runId: string, artifactId: string | undefined): string {
  return artifactId ? `/api/runs/${runId}/artifacts/${artifactId}` : `/api/runs/${runId}`;
}

function approvalStatus(approval: ApprovalRecord | undefined): ShipTrailStatus {
  if (!approval) return "pending";
  if (approval.decision === "approved") return "complete";
  if (approval.decision === "rejected") return "blocked";
  return "active";
}

function receiptForArtifact(snapshot: RunLedgerSnapshot, artifactId: string | undefined): ReceiptRecord | undefined {
  if (!artifactId) return undefined;
  return snapshot.receipts.find((receipt) => receipt.artifactId === artifactId);
}

function verificationStatus(snapshot: RunLedgerSnapshot, artifactId: string): ShipTrailStatus {
  const receipt = receiptForArtifact(snapshot, artifactId);
  if (receipt?.status === "blocked") return "blocked";
  if (receipt?.status === "executed" || receipt?.status === "ready") return "complete";
  return snapshot.run.status === "failed" ? "blocked" : "complete";
}

function previewArtifactData(data: unknown): unknown {
  return redactPreviewValue(data, 0);
}

function redactPreviewValue(value: unknown, depth: number): unknown {
  if (value === null || typeof value !== "object") return value;
  if (depth >= 3) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, 3).map((item) => redactPreviewValue(item, depth + 1));
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .slice(0, 8)
    .map(([key, item]) => [
      key,
      isSensitivePreviewKey(key)
        ? "[redacted]"
        : isRawPreviewKey(key)
          ? summarizeRawPreviewValue(item)
          : redactPreviewValue(item, depth + 1),
    ]);
  return Object.fromEntries(entries);
}

function isSensitivePreviewKey(key: string): boolean {
  return /secret|token|credential|password|private|internal/i.test(key);
}

function isRawPreviewKey(key: string): boolean {
  return /evidence|source|content|finding|transcript|memory|output|raw|quote/i.test(key);
}

function summarizeRawPreviewValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (value && typeof value === "object") return "[object]";
  if (typeof value === "string") return `[${value.length} chars]`;
  return "[redacted]";
}
