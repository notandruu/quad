import { DEMO_ORG_ID } from "@/data/seed";
import { getRedis } from "@/lib/redis";
import {
  addTask,
  createWorkflowRun,
  getRunSnapshot,
  saveRunSnapshot,
  summarizeAgentTask,
  type AgentTaskSummary,
  type WorkflowKind,
} from "@/lib/runs";

export type JobType = "audit" | "agent_run" | "canary";
export type JobStatus = "queued" | "running" | "retrying" | "completed" | "failed" | "dead_letter";

export type AuditJobPayload = {
  orgId: string;
  runId: string;
  targetUrl: string;
  limit: number;
};

export type AgentRunJobPayload = AuditJobPayload & {
  workflow: "website_audit" | "enterprise_proof";
};

export type CanaryJobPayload = {
  orgId: string;
  runId: string;
  nonce: string;
};

export type QuadJobPayload = AuditJobPayload | AgentRunJobPayload | CanaryJobPayload;

export type QuadJob = {
  id: string;
  type: JobType;
  status: JobStatus;
  orgId: string;
  runId: string;
  payload: QuadJobPayload;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  retryAt?: string;
  deadLetteredAt?: string;
  claimedBy?: string;
  claimExpiresAt?: string;
  error?: string;
  errorHistory?: Array<{
    attempt: number;
    message: string;
    at: string;
  }>;
  result?: unknown;
};

export type EnqueueAuditJobInput = {
  orgId?: string;
  targetUrl: string;
  limit?: number;
  runId?: string;
  workflow?: Extract<WorkflowKind, "website_audit" | "enterprise_proof">;
  createdBy?: "dashboard" | "agent" | "system";
};

export type EnqueueJobResult = {
  job: QuadJob;
  task: AgentTaskSummary | null;
  mode: "redis" | "memory";
};

export type WorkerQueueHealth = {
  mode: "redis" | "memory";
  configured: boolean;
  queueDepth: number;
  running: number;
  retrying: number;
  completed: number;
  failed: number;
  deadLetter: number;
  oldestQueuedAt: string | null;
  latestUpdatedAt: string | null;
};

export type WorkerRuntimeHealth = {
  mode: "redis" | "memory";
  configured: boolean;
  seen: boolean;
  alive: boolean;
  workerId: string | null;
  startedAt: string | null;
  lastHeartbeatAt: string | null;
  processed: number;
  staleAfterMs: number;
};

export type WorkerCanaryHealth = {
  seen: boolean;
  ok: boolean;
  mode: "redis" | "memory";
  jobId: string | null;
  status: JobStatus | null;
  lastRunAt: string | null;
  durationMs: number | null;
};

export type WorkerHeartbeatInput = {
  workerId: string;
  startedAt?: string;
  processed?: number;
  now?: string;
};

const QUEUE_KEY = "quad:jobs:queue";
const JOB_KEY_PREFIX = "quad:jobs:item:";
const JOB_LOCK_KEY_PREFIX = "quad:jobs:lock:";
const WORKER_HEARTBEAT_KEY = "quad:jobs:worker:heartbeat";
const WORKER_CANARY_KEY = "quad:jobs:worker:canary";
const JOB_TTL_SECONDS = 60 * 60 * 24;

const g = globalThis as typeof globalThis & {
  __quadJobs?: Map<string, QuadJob>;
  __quadJobQueue?: string[];
  __quadJobLocks?: Map<string, { owner: string; expiresAt: string }>;
  __quadWorkerHeartbeat?: WorkerRuntimeHealth;
  __quadWorkerCanary?: WorkerCanaryHealth;
};
if (!g.__quadJobs) g.__quadJobs = new Map();
if (!g.__quadJobQueue) g.__quadJobQueue = [];
if (!g.__quadJobLocks) g.__quadJobLocks = new Map();
const memoryJobs = g.__quadJobs;
const memoryQueue = g.__quadJobQueue;
const memoryLocks = g.__quadJobLocks;

export async function enqueueAuditJob(input: EnqueueAuditJobInput): Promise<EnqueueJobResult> {
  const orgId = input.orgId ?? DEMO_ORG_ID;
  const run = createWorkflowRun({
    id: input.runId,
    orgId,
    workflowKind: input.workflow ?? "website_audit",
    title: input.workflow === "enterprise_proof" ? "Enterprise proof run" : "Website audit run",
    createdBy: input.createdBy ?? "dashboard",
    targetUrl: input.targetUrl,
  });
  addTask({
    runId: run.id,
    title: "Queued backend job",
    status: "queued",
    owner: "quad",
    detail: "The run is queued for the backend worker.",
  });
  await saveRunSnapshot(run.id);

  const type: JobType = input.workflow === "enterprise_proof" ? "agent_run" : "audit";
  const payload: QuadJobPayload =
    type === "agent_run"
      ? {
          orgId,
          runId: run.id,
          targetUrl: input.targetUrl,
          limit: clampLimit(input.limit),
          workflow: input.workflow ?? "website_audit",
        }
      : {
          orgId,
          runId: run.id,
          targetUrl: input.targetUrl,
          limit: clampLimit(input.limit),
        };
  const job = await enqueueJob({
    type,
    orgId,
    runId: run.id,
    payload,
  });
  const snapshot = getRunSnapshot(run.id);

  return {
    job: job.job,
    task: snapshot ? summarizeAgentTask(snapshot) : null,
    mode: job.mode,
  };
}

export async function enqueueJob(input: {
  type: JobType;
  orgId: string;
  runId: string;
  payload: QuadJobPayload;
  maxAttempts?: number;
}): Promise<{ job: QuadJob; mode: "redis" | "memory" }> {
  const now = new Date().toISOString();
  const job: QuadJob = {
    id: `job_${crypto.randomUUID()}`,
    type: input.type,
    status: "queued",
    orgId: input.orgId,
    runId: input.runId,
    payload: input.payload,
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 3,
    createdAt: now,
    updatedAt: now,
  };

  memoryJobs.set(job.id, job);
  memoryQueue.push(job.id);
  pruneMemoryJobs();

  const redis = getRedis();
  if (!redis) return { job, mode: "memory" };

  try {
    await redis.set(jobKey(job.id), job, { ex: JOB_TTL_SECONDS });
    await redis.lpush(QUEUE_KEY, job.id);
    return { job, mode: "redis" };
  } catch {
    return { job, mode: "memory" };
  }
}

export async function enqueueWorkerCanaryJob(input: {
  orgId?: string;
  runId?: string;
  nonce?: string;
} = {}): Promise<{ job: QuadJob; mode: "redis" | "memory" }> {
  const orgId = input.orgId ?? DEMO_ORG_ID;
  const runId = input.runId ?? `canary_${crypto.randomUUID()}`;
  const nonce = input.nonce ?? crypto.randomUUID();
  return enqueueJob({
    type: "canary",
    orgId,
    runId,
    maxAttempts: 1,
    payload: {
      orgId,
      runId,
      nonce,
    },
  });
}

export async function getJob(jobId: string): Promise<QuadJob | null> {
  const memory = memoryJobs.get(jobId);
  if (memory) return cloneJob(memory);

  const redis = getRedis();
  if (!redis) return null;
  try {
    const job = await redis.get<QuadJob>(jobKey(jobId));
    return isJob(job) ? job : null;
  } catch {
    return null;
  }
}

export async function claimNextJob(): Promise<QuadJob | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const jobId = await redis.rpop<string>(QUEUE_KEY);
      if (jobId) {
        const claimed = await claimJob(jobId);
        if (claimed) return claimed;
      }
    } catch {
      // fall through to memory queue
    }
  }

  while (memoryQueue.length > 0) {
    const jobId = memoryQueue.shift();
    if (!jobId) continue;
    const claimed = await claimJob(jobId);
    if (claimed) return claimed;
  }

  return null;
}

export async function claimJob(jobId: string): Promise<QuadJob | null> {
  const job = await getJob(jobId);
  if (!job || !isClaimable(job)) return null;
  const lease = await acquireJobLease(job.id);
  if (!lease) return null;
  return updateJob(job.id, {
    status: "running",
    attempts: job.attempts + 1,
    startedAt: new Date().toISOString(),
    retryAt: undefined,
    claimedBy: lease.owner,
    claimExpiresAt: lease.expiresAt,
  });
}

export async function retryJob(
  job: QuadJob,
  input: { error: string; retryDelayMs?: number; now?: string } 
): Promise<QuadJob> {
  const now = input.now ?? new Date().toISOString();
  const retryAt = new Date(Date.parse(now) + (input.retryDelayMs ?? retryDelayMs(job.attempts))).toISOString();
  const updated = await updateJob(job.id, {
    status: "retrying",
    error: input.error,
    retryAt,
    claimedBy: undefined,
    claimExpiresAt: undefined,
    errorHistory: [
      ...(job.errorHistory ?? []),
      {
        attempt: job.attempts,
        message: input.error,
        at: now,
      },
    ],
  });
  await pushJobId(job.id);
  return updated ?? job;
}

export async function deadLetterJob(
  job: QuadJob,
  input: { error: string; now?: string }
): Promise<QuadJob> {
  const now = input.now ?? new Date().toISOString();
  return (await updateJob(job.id, {
    status: "dead_letter",
    error: input.error,
    completedAt: now,
    deadLetteredAt: now,
    claimedBy: undefined,
    claimExpiresAt: undefined,
    errorHistory: [
      ...(job.errorHistory ?? []),
      {
        attempt: job.attempts,
        message: input.error,
        at: now,
      },
    ],
  })) ?? job;
}

export async function requeueJob(
  job: QuadJob,
  input: { reason: string; resetAttempts?: boolean; now?: string }
): Promise<QuadJob> {
  const now = input.now ?? new Date().toISOString();
  const updated = await updateJob(job.id, {
    status: "queued",
    attempts: (input.resetAttempts ?? true) ? 0 : job.attempts,
    startedAt: undefined,
    completedAt: undefined,
    retryAt: undefined,
    deadLetteredAt: undefined,
    claimedBy: undefined,
    claimExpiresAt: undefined,
    error: input.reason,
    result: undefined,
    errorHistory: [
      ...(job.errorHistory ?? []),
      {
        attempt: job.attempts,
        message: `operator retry: ${input.reason}`,
        at: now,
      },
    ],
  });
  await pushJobId(job.id);
  return updated ?? job;
}

export async function getWorkerQueueHealth(): Promise<WorkerQueueHealth> {
  const jobs = [...memoryJobs.values()];
  const queued = jobs.filter((job) => job.status === "queued" || job.status === "retrying");
  const latest = jobs
    .map((job) => job.updatedAt)
    .sort((a, b) => b.localeCompare(a))[0] ?? null;
  const oldestQueued = queued
    .map((job) => job.createdAt)
    .sort((a, b) => a.localeCompare(b))[0] ?? null;

  return {
    mode: getRedis() ? "redis" : "memory",
    configured: Boolean(process.env.QUAD_REDIS_REST_URL && process.env.QUAD_REDIS_REST_TOKEN),
    queueDepth: queued.length,
    running: jobs.filter((job) => job.status === "running").length,
    retrying: jobs.filter((job) => job.status === "retrying").length,
    completed: jobs.filter((job) => job.status === "completed").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    deadLetter: jobs.filter((job) => job.status === "dead_letter").length,
    oldestQueuedAt: oldestQueued,
    latestUpdatedAt: latest,
  };
}

export async function recordWorkerHeartbeat(input: WorkerHeartbeatInput): Promise<WorkerRuntimeHealth> {
  const now = input.now ?? new Date().toISOString();
  const heartbeat: WorkerRuntimeHealth = {
    mode: getRedis() ? "redis" : "memory",
    configured: true,
    seen: true,
    alive: true,
    workerId: input.workerId,
    startedAt: input.startedAt ?? g.__quadWorkerHeartbeat?.startedAt ?? now,
    lastHeartbeatAt: now,
    processed: input.processed ?? g.__quadWorkerHeartbeat?.processed ?? 0,
    staleAfterMs: workerHeartbeatStaleMs(),
  };
  g.__quadWorkerHeartbeat = heartbeat;

  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(WORKER_HEARTBEAT_KEY, heartbeat, {
        ex: Math.max(60, Math.ceil(heartbeat.staleAfterMs / 1000) * 2),
      });
    } catch {
      // Memory heartbeat still tells local health checks that this process is alive.
    }
  }

  return heartbeat;
}

export async function getWorkerRuntimeHealth(input: { now?: string } = {}): Promise<WorkerRuntimeHealth> {
  const staleAfterMs = workerHeartbeatStaleMs();
  const redis = getRedis();
  const mode: WorkerRuntimeHealth["mode"] = redis ? "redis" : "memory";
  let heartbeat = g.__quadWorkerHeartbeat;

  if (redis) {
    try {
      const redisHeartbeat = await redis.get<WorkerRuntimeHealth>(WORKER_HEARTBEAT_KEY);
      if (isWorkerRuntimeHealth(redisHeartbeat)) heartbeat = redisHeartbeat;
    } catch {
      // Fall back to the in-process heartbeat below.
    }
  }

  if (!heartbeat) {
    return {
      mode,
      configured: workerExpected(),
      seen: false,
      alive: false,
      workerId: null,
      startedAt: null,
      lastHeartbeatAt: null,
      processed: 0,
      staleAfterMs,
    };
  }

  const nowMs = Date.parse(input.now ?? new Date().toISOString());
  const lastMs = Date.parse(heartbeat.lastHeartbeatAt ?? "");
  const alive = Number.isFinite(lastMs) && nowMs - lastMs <= staleAfterMs;
  return {
    ...heartbeat,
    mode,
    configured: true,
    seen: true,
    alive,
    staleAfterMs,
  };
}

export async function recordWorkerCanaryHealth(input: {
  ok: boolean;
  mode: "redis" | "memory";
  jobId: string;
  status: JobStatus;
  durationMs: number;
  now?: string;
}): Promise<WorkerCanaryHealth> {
  const canary: WorkerCanaryHealth = {
    seen: true,
    ok: input.ok,
    mode: input.mode,
    jobId: input.jobId,
    status: input.status,
    lastRunAt: input.now ?? new Date().toISOString(),
    durationMs: input.durationMs,
  };
  g.__quadWorkerCanary = canary;

  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(WORKER_CANARY_KEY, canary, { ex: JOB_TTL_SECONDS });
    } catch {
      // Memory canary status still gives local health checks useful signal.
    }
  }

  return canary;
}

export async function getWorkerCanaryHealth(): Promise<WorkerCanaryHealth> {
  const redis = getRedis();
  if (redis) {
    try {
      const canary = await redis.get<WorkerCanaryHealth>(WORKER_CANARY_KEY);
      if (isWorkerCanaryHealth(canary)) return canary;
    } catch {
      // Fall back to memory below.
    }
  }

  return g.__quadWorkerCanary ?? {
    seen: false,
    ok: false,
    mode: redis ? "redis" : "memory",
    jobId: null,
    status: null,
    lastRunAt: null,
    durationMs: null,
  };
}

export async function updateJob(
  jobId: string,
  patch: Partial<Omit<QuadJob, "id" | "createdAt">>
): Promise<QuadJob | null> {
  const existing = memoryJobs.get(jobId) ?? (await loadRedisJob(jobId));
  if (!existing) return null;

  const updated: QuadJob = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  if (shouldReleaseJobLease(updated.status)) {
    updated.claimedBy = undefined;
    updated.claimExpiresAt = undefined;
  }
  memoryJobs.set(jobId, updated);

  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(jobKey(jobId), updated, { ex: JOB_TTL_SECONDS });
    } catch {
      // memory copy remains authoritative for fallback mode
    }
  }

  if (shouldReleaseJobLease(updated.status)) {
    await releaseJobLease(jobId);
  }

  return cloneJob(updated);
}

export async function listJobs(input: {
  orgId?: string;
  status?: JobStatus;
  limit?: number;
} = {}): Promise<QuadJob[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 25, 100));
  return [...memoryJobs.values()]
    .filter((job) => !input.orgId || job.orgId === input.orgId)
    .filter((job) => !input.status || job.status === input.status)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)
    .map(cloneJob);
}

export async function deleteJobs(input: { orgId: string; runId?: string }): Promise<number> {
  const jobs = [...memoryJobs.values()].filter((job) =>
    job.orgId === input.orgId && (!input.runId || job.runId === input.runId)
  );
  for (const job of jobs) {
    memoryJobs.delete(job.id);
    memoryLocks.delete(job.id);
  }
  if (jobs.length > 0) {
    const deletedIds = new Set(jobs.map((job) => job.id));
    for (let index = memoryQueue.length - 1; index >= 0; index -= 1) {
      if (deletedIds.has(memoryQueue[index])) memoryQueue.splice(index, 1);
    }
  }

  const redis = getRedis();
  if (redis) {
    for (const job of jobs) {
      try {
        await redis.del(jobKey(job.id));
        await redis.del(jobLockKey(job.id));
      } catch {
        // Memory deletion is still authoritative for fallback mode.
      }
    }
  }

  return jobs.length;
}

async function pushJobId(jobId: string): Promise<void> {
  memoryQueue.push(jobId);
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.lpush(QUEUE_KEY, jobId);
  } catch {
    // Memory queue remains the local fallback.
  }
}

async function loadRedisJob(jobId: string): Promise<QuadJob | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const job = await redis.get<QuadJob>(jobKey(jobId));
    return isJob(job) ? job : null;
  } catch {
    return null;
  }
}

function jobKey(jobId: string): string {
  return `${JOB_KEY_PREFIX}${jobId}`;
}

function jobLockKey(jobId: string): string {
  return `${JOB_LOCK_KEY_PREFIX}${jobId}`;
}

async function acquireJobLease(jobId: string): Promise<{ owner: string; expiresAt: string } | null> {
  const owner = `lease_${crypto.randomUUID()}`;
  const ttlSeconds = jobLeaseTtlSeconds();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const existingMemoryLock = memoryLocks.get(jobId);

  if (existingMemoryLock && Date.parse(existingMemoryLock.expiresAt) > Date.now()) return null;
  memoryLocks.set(jobId, { owner, expiresAt });

  const redis = getRedis();
  if (!redis) return { owner, expiresAt };

  try {
    const result = await redis.set(jobLockKey(jobId), { owner, expiresAt }, {
      nx: true,
      ex: ttlSeconds,
    });
    if (result === null) {
      memoryLocks.delete(jobId);
      return null;
    }
    return { owner, expiresAt };
  } catch {
    return { owner, expiresAt };
  }
}

async function releaseJobLease(jobId: string): Promise<void> {
  memoryLocks.delete(jobId);
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(jobLockKey(jobId));
  } catch {
    // Lease expiration is the backstop if explicit release fails.
  }
}

function shouldReleaseJobLease(status: JobStatus): boolean {
  return status !== "running";
}

function isClaimable(job: QuadJob): boolean {
  if (job.status === "queued") return true;
  if (job.status !== "retrying") return false;
  if (!job.retryAt) return true;
  return Date.parse(job.retryAt) <= Date.now();
}

function retryDelayMs(attempts: number): number {
  const configured = Number.parseInt(process.env.QUAD_WORKER_RETRY_DELAY_MS ?? "", 10);
  if (Number.isFinite(configured)) return Math.max(0, configured);
  const base = 1000 * 2 ** Math.max(0, attempts - 1);
  return Math.min(base, 30_000);
}

function jobLeaseTtlSeconds(): number {
  const configured = Number.parseInt(process.env.QUAD_WORKER_JOB_LEASE_SECONDS ?? "", 10);
  if (Number.isFinite(configured)) return Math.max(5, configured);
  return 300;
}

function workerHeartbeatStaleMs(): number {
  const configured = Number.parseInt(process.env.QUAD_WORKER_HEARTBEAT_STALE_MS ?? "", 10);
  if (Number.isFinite(configured)) return Math.max(1000, configured);
  return 30_000;
}

function workerExpected(): boolean {
  return Boolean(process.env.QUAD_WORKER_ENABLED || process.env.QUAD_WORKER_SECRET || process.env.RAILWAY_SERVICE_NAME);
}

function clampLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return 12;
  return Math.max(1, Math.min(50, Math.floor(value ?? 12)));
}

function cloneJob(job: QuadJob): QuadJob {
  return structuredClone(job);
}

function isJob(value: unknown): value is QuadJob {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as QuadJob).id === "string" &&
      typeof (value as QuadJob).runId === "string" &&
      typeof (value as QuadJob).type === "string"
  );
}

function isWorkerRuntimeHealth(value: unknown): value is WorkerRuntimeHealth {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as WorkerRuntimeHealth).seen === "boolean" &&
      typeof (value as WorkerRuntimeHealth).alive === "boolean" &&
      typeof (value as WorkerRuntimeHealth).processed === "number"
  );
}

function isWorkerCanaryHealth(value: unknown): value is WorkerCanaryHealth {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as WorkerCanaryHealth).seen === "boolean" &&
      typeof (value as WorkerCanaryHealth).ok === "boolean"
  );
}

function pruneMemoryJobs(): void {
  if (memoryJobs.size <= 250) return;
  const oldest = [...memoryJobs.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (oldest) memoryJobs.delete(oldest.id);
}
