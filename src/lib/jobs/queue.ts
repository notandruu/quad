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

export type JobType = "audit" | "agent_run";
export type JobStatus = "queued" | "running" | "completed" | "failed";

export type AuditJobPayload = {
  orgId: string;
  runId: string;
  targetUrl: string;
  limit: number;
};

export type AgentRunJobPayload = AuditJobPayload & {
  workflow: "website_audit" | "enterprise_proof";
};

export type QuadJobPayload = AuditJobPayload | AgentRunJobPayload;

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
  error?: string;
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

const QUEUE_KEY = "quad:jobs:queue";
const JOB_KEY_PREFIX = "quad:jobs:item:";
const JOB_TTL_SECONDS = 60 * 60 * 24;

const g = globalThis as typeof globalThis & {
  __quadJobs?: Map<string, QuadJob>;
  __quadJobQueue?: string[];
};
if (!g.__quadJobs) g.__quadJobs = new Map();
if (!g.__quadJobQueue) g.__quadJobQueue = [];
const memoryJobs = g.__quadJobs;
const memoryQueue = g.__quadJobQueue;

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
        const job = await getJob(jobId);
        if (job && job.status === "queued") {
          return updateJob(job.id, {
            status: "running",
            attempts: job.attempts + 1,
            startedAt: new Date().toISOString(),
          });
        }
      }
    } catch {
      // fall through to memory queue
    }
  }

  while (memoryQueue.length > 0) {
    const jobId = memoryQueue.shift();
    if (!jobId) continue;
    const job = memoryJobs.get(jobId);
    if (!job || job.status !== "queued") continue;
    return updateJob(job.id, {
      status: "running",
      attempts: job.attempts + 1,
      startedAt: new Date().toISOString(),
    });
  }

  return null;
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
  memoryJobs.set(jobId, updated);

  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(jobKey(jobId), updated, { ex: JOB_TTL_SECONDS });
    } catch {
      // memory copy remains authoritative for fallback mode
    }
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

function pruneMemoryJobs(): void {
  if (memoryJobs.size <= 250) return;
  const oldest = [...memoryJobs.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (oldest) memoryJobs.delete(oldest.id);
}
