import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type WorkflowKind =
  | "website_audit"
  | "enterprise_proof"
  | "trust_packet"
  | "agent_bridge";

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
  | "receipt";

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

export type RunLedgerSnapshot = {
  run: WorkflowRunRecord;
  tasks: WorkflowTaskRecord[];
  artifacts: WorkflowArtifactRecord[];
  approvals: ApprovalRecord[];
  receipts: ReceiptRecord[];
};

export type RunLedgerPersistResult = {
  mode: "supabase" | "memory";
  snapshot: RunLedgerSnapshot;
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
  nextAction: string;
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

  return { mode: "supabase", snapshot };
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
  if (error) return null;
  if (!data) return null;

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
  const updated: WorkflowRunRecord = {
    ...snapshot.run,
    status,
    updatedAt: input.now ?? new Date().toISOString(),
    failureReason: input.failureReason,
  };
  snapshot.run = updated;
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
  return receipt;
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
    nextAction: pendingApproval
      ? "Human approval required before customer-facing work can ship."
      : blockedReceipt
        ? "Resolve blocked receipt before execution."
        : snapshot.run.status === "completed"
          ? "Run complete."
          : "Continue workflow.",
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
  };
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

function clampListLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return 25;
  return Math.max(1, Math.min(100, Math.floor(value ?? 25)));
}
