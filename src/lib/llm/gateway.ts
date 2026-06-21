import { DEMO_ORG_ID } from "@/data/seed";
import { eventTtlSeconds, getRedis, tenantScopedKeys } from "@/lib/redis";
import {
  assertModelCallAllowed,
  prepareModelPayload,
  type ModelGatewayDecision,
  type ModelPurpose,
  type ProviderName,
} from "@/lib/security";

export type ModelCallStatus = "completed" | "blocked" | "skipped" | "failed";

export type ModelCallReceipt = {
  id: string;
  orgId: string;
  runId?: string;
  provider: ProviderName;
  model: string;
  purpose: ModelPurpose;
  status: ModelCallStatus;
  createdAt: string;
  completedAt: string;
  durationMs: number;
  attempts: number;
  maxAttempts: number;
  input: {
    promptHash: string;
    systemHash: string | null;
    originalChars: number;
    sanitizedChars: number;
    redactionCount: number;
    classifications: string[];
  };
  output: {
    hash: string | null;
    chars: number;
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  errorClass?: string;
  reason: string;
};

export type TextModelCallInput = {
  orgId?: string;
  runId?: string;
  provider: Exclude<ProviderName, "blocked">;
  model: string;
  purpose: Extract<ModelPurpose, "chat" | "audit" | "evaluation" | "trust_packet">;
  system?: string;
  prompt: string;
  maxTokens: number;
  maxAttempts?: number;
  execute: null | ((payload: {
    model: string;
    system?: string;
    prompt: string;
    maxTokens: number;
  }) => Promise<{
    text: string;
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
    };
  }>);
};

export type TextModelCallResult = {
  text: string | null;
  receipt: ModelCallReceipt;
};

const g = globalThis as typeof globalThis & {
  __quadModelCallReceipts?: Map<string, ModelCallReceipt>;
};
if (!g.__quadModelCallReceipts) g.__quadModelCallReceipts = new Map();
const memoryReceipts = g.__quadModelCallReceipts;

export async function runTextModelCall(input: TextModelCallInput): Promise<TextModelCallResult> {
  const orgId = input.orgId ?? DEMO_ORG_ID;
  const startedAt = new Date();
  const promptDecision = prepareModelPayload({
    purpose: input.purpose,
    text: input.prompt,
  });
  const systemDecision = input.system
    ? prepareModelPayload({
        purpose: input.purpose,
        text: input.system,
      })
    : null;
  const base = receiptBase(input, orgId, startedAt, promptDecision, systemDecision);

  try {
    assertModelCallAllowed(promptDecision);
    if (systemDecision) assertModelCallAllowed(systemDecision);
  } catch (error) {
    const receipt = await saveModelCallReceipt({
      ...base,
      status: "blocked",
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      attempts: 0,
      output: { hash: null, chars: 0 },
      errorClass: errorName(error),
      reason: error instanceof Error ? error.message : "Model call blocked by policy.",
    });
    throw new Error(receipt.reason);
  }

  if (!input.execute) {
    const receipt = await saveModelCallReceipt({
      ...base,
      status: "skipped",
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      attempts: 0,
      output: { hash: null, chars: 0 },
      reason: "Provider client is not configured.",
    });
    return { text: null, receipt };
  }

  const maxAttempts = resolveMaxAttempts(input.maxAttempts);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await input.execute({
        model: input.model,
        system: systemDecision?.payload.text,
        prompt: promptDecision.payload.text,
        maxTokens: input.maxTokens,
      });
      const text = result.text.trim();
      const receipt = await saveModelCallReceipt({
        ...base,
        status: "completed",
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt.getTime(),
        attempts: attempt,
        output: {
          hash: hashText(text),
          chars: text.length,
        },
        usage: result.usage,
        reason: "Model call completed.",
      });
      return { text, receipt };
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) await sleep(retryDelayMs(attempt));
    }
  }

  const receipt = await saveModelCallReceipt({
    ...base,
    status: "failed",
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    attempts: maxAttempts,
    output: { hash: null, chars: 0 },
    errorClass: errorName(lastError),
    reason: lastError instanceof Error ? lastError.message : "Model call failed.",
  });
  throw lastError instanceof Error ? lastError : new Error(receipt.reason);
}

export async function getLatestModelCallReceipts(input: {
  orgId?: string;
  runId?: string;
  limit?: number;
} = {}): Promise<ModelCallReceipt[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 25, 100));
  return [...memoryReceipts.values()]
    .filter((receipt) => !input.orgId || receipt.orgId === input.orgId)
    .filter((receipt) => !input.runId || receipt.runId === input.runId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

async function saveModelCallReceipt(receipt: ModelCallReceipt): Promise<ModelCallReceipt> {
  memoryReceipts.set(receipt.id, receipt);
  pruneMemoryReceipts();

  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(tenantScopedKeys.modelCall(receipt.orgId, receipt.id), receipt, { ex: eventTtlSeconds() });
    } catch {
      // Memory receipts still preserve local observability in demo mode.
    }
  }

  return receipt;
}

function receiptBase(
  input: TextModelCallInput,
  orgId: string,
  startedAt: Date,
  promptDecision: ModelGatewayDecision,
  systemDecision: ModelGatewayDecision | null
): Omit<ModelCallReceipt, "status" | "completedAt" | "durationMs" | "attempts" | "output" | "reason"> {
  const decisions = [promptDecision, systemDecision].filter((item): item is ModelGatewayDecision => Boolean(item));
  return {
    id: `model_${crypto.randomUUID()}`,
    orgId,
    runId: input.runId,
    provider: input.provider,
    model: input.model,
    purpose: input.purpose,
    createdAt: startedAt.toISOString(),
    maxAttempts: resolveMaxAttempts(input.maxAttempts),
    input: {
      promptHash: hashText(promptDecision.payload.text),
      systemHash: systemDecision ? hashText(systemDecision.payload.text) : null,
      originalChars: decisions.reduce((total, decision) => total + decision.payload.originalLength, 0),
      sanitizedChars: decisions.reduce((total, decision) => total + decision.payload.sanitizedLength, 0),
      redactionCount: decisions.reduce(
        (total, decision) => total + decision.payload.redactions.reduce((sum, redaction) => sum + redaction.count, 0),
        0
      ),
      classifications: [...new Set(decisions.map((decision) => decision.payload.classification))],
    },
  };
}

function resolveMaxAttempts(value: number | undefined): number {
  if (Number.isFinite(value)) return Math.max(1, Math.min(5, Math.floor(value ?? 1)));
  const configured = Number.parseInt(process.env.QUAD_MODEL_MAX_ATTEMPTS ?? "", 10);
  if (Number.isFinite(configured)) return Math.max(1, Math.min(5, configured));
  return 2;
}

function retryDelayMs(attempt: number): number {
  const configured = Number.parseInt(process.env.QUAD_MODEL_RETRY_DELAY_MS ?? "", 10);
  if (Number.isFinite(configured)) return Math.max(0, configured);
  return Math.min(250 * 2 ** Math.max(0, attempt - 1), 1000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashText(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function errorName(error: unknown): string {
  return error instanceof Error && error.name ? error.name : "Error";
}

function pruneMemoryReceipts(): void {
  if (memoryReceipts.size <= 250) return;
  const oldest = [...memoryReceipts.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (oldest) memoryReceipts.delete(oldest.id);
}
