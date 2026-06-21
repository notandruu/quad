import { getClient } from "@/lib/brain/db";
import { getRedis, isRedisConfigured } from "@/lib/redis";
import { securityReadiness } from "@/lib/security";

export type BackendComponentStatus = "ready" | "degraded" | "missing";

export type BackendComponentHealth = {
  status: BackendComponentStatus;
  configured: boolean;
  reachable?: boolean;
  detail: string;
  latencyMs?: number;
};

export type BackendReadinessReport = {
  ok: boolean;
  mode: "production_ready" | "degraded" | "demo_fallback";
  generatedAt: string;
  components: {
    supabase: BackendComponentHealth & {
      requiredTables: string[];
      missingTables: string[];
    };
    redis: BackendComponentHealth;
    auth: BackendComponentHealth;
    encryption: BackendComponentHealth;
    observability: BackendComponentHealth;
    voice: BackendComponentHealth;
    browserbase: BackendComponentHealth;
  };
  nextActions: string[];
};

export type BackendReadinessInput = {
  env?: Record<string, string | undefined>;
  now?: string;
  probeSupabase?: (table: string) => Promise<boolean>;
  probeRedis?: () => Promise<boolean>;
};

export const PLATFORM_REQUIRED_TABLES = [
  "brain_memory",
  "workflow_run_snapshots",
  "workflow_runs",
  "workflow_tasks",
  "workflow_artifacts",
  "workflow_approvals",
  "workflow_receipts",
  "quadchain_packets",
  "connector_credentials",
] as const;

export async function getBackendReadiness(
  input: BackendReadinessInput = {}
): Promise<BackendReadinessReport> {
  const env = input.env ?? process.env;
  const generatedAt = input.now ?? new Date().toISOString();
  const supabaseConfigured = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY);
  const redisConfigured = Boolean(env.QUAD_REDIS_REST_URL && env.QUAD_REDIS_REST_TOKEN);
  const requiredSecretConfigured = Boolean(env.QUAD_API_SECRET);
  const encryptionConfigured = Boolean(env.QUAD_CONNECTOR_ENCRYPTION_KEY);
  const sentryConfigured = Boolean(env.SENTRY_DSN);
  const phoenixConfigured = Boolean(env.PHOENIX_COLLECTOR_ENDPOINT);
  const browserbaseConfigured = Boolean(env.BROWSERBASE_API_KEY && env.BROWSERBASE_PROJECT_ID);
  const voiceConfigured = Boolean(env.DEEPGRAM_API_KEY || env.MOSHI_SERVER_URL || env.NEXT_PUBLIC_MOSHI_SERVER_URL);

  const supabaseProbe = await probeRequiredTables(input.probeSupabase ?? defaultSupabaseProbe, supabaseConfigured);
  const redisProbe = await probeRedis(input.probeRedis ?? defaultRedisProbe, redisConfigured);
  const security = securityReadiness(env);

  const components: BackendReadinessReport["components"] = {
    supabase: {
      status: componentStatus(supabaseConfigured, supabaseProbe.reachable && supabaseProbe.missingTables.length === 0),
      configured: supabaseConfigured,
      reachable: supabaseProbe.reachable,
      latencyMs: supabaseProbe.latencyMs,
      requiredTables: [...PLATFORM_REQUIRED_TABLES],
      missingTables: supabaseProbe.missingTables,
      detail: supabaseConfigured
        ? supabaseProbe.missingTables.length === 0
          ? "Supabase is configured and all platform tables responded."
          : `Supabase is configured but missing ${supabaseProbe.missingTables.length} platform tables.`
        : "Supabase is not configured, so runs and packets fall back to memory/redis.",
    },
    redis: {
      status: componentStatus(redisConfigured, redisProbe.reachable),
      configured: redisConfigured,
      reachable: redisProbe.reachable,
      latencyMs: redisProbe.latencyMs,
      detail: redisConfigured
        ? redisProbe.reachable
          ? "Redis is reachable for events, queue state, and packet cache."
          : "Redis is configured but the health probe failed."
        : "Redis is not configured, so live events and jobs use in-process fallback.",
    },
    auth: {
      status: requiredSecretConfigured ? "ready" : "degraded",
      configured: requiredSecretConfigured,
      detail: requiredSecretConfigured
        ? "Hosted API secret is configured."
        : "Hosted API secret is missing, so demo fallback can allow local-only org access.",
    },
    encryption: {
      status: encryptionConfigured ? "ready" : "degraded",
      configured: encryptionConfigured,
      detail: encryptionConfigured
        ? "Connector credential encryption key is configured."
        : "Connector credentials will use the API secret or local dev fallback key.",
    },
    observability: {
      status: sentryConfigured && phoenixConfigured ? "ready" : sentryConfigured || phoenixConfigured ? "degraded" : "missing",
      configured: sentryConfigured || phoenixConfigured,
      detail:
        sentryConfigured && phoenixConfigured
          ? "Sentry and Phoenix are configured."
          : sentryConfigured
            ? "Sentry is configured, Phoenix tracing is missing."
            : phoenixConfigured
              ? "Phoenix tracing is configured, Sentry is missing."
              : "Sentry and Phoenix are missing.",
    },
    voice: {
      status: voiceConfigured ? "ready" : "missing",
      configured: voiceConfigured,
      detail: voiceConfigured
        ? "A voice backend is configured."
        : "Deepgram or Moshi needs to be configured for production voice.",
    },
    browserbase: {
      status: browserbaseConfigured ? "ready" : "missing",
      configured: browserbaseConfigured,
      detail: browserbaseConfigured
        ? "Browserbase is configured for remote browser execution."
        : "Browserbase is missing, so browser automation falls back to direct fetch.",
    },
  };

  const nextActions = buildNextActions(components, security);
  const hardReady =
    components.supabase.status === "ready" &&
    components.redis.status === "ready" &&
    components.auth.status === "ready" &&
    components.encryption.status === "ready";
  const optionalReady =
    components.observability.status === "ready" &&
    components.voice.status === "ready" &&
    components.browserbase.status === "ready";

  return {
    ok: hardReady,
    mode: hardReady && optionalReady ? "production_ready" : hardReady ? "degraded" : "demo_fallback",
    generatedAt,
    components,
    nextActions,
  };
}

function componentStatus(configured: boolean, reachable: boolean): BackendComponentStatus {
  if (!configured) return "missing";
  return reachable ? "ready" : "degraded";
}

async function probeRequiredTables(
  probeTable: (table: string) => Promise<boolean>,
  configured: boolean
): Promise<{ reachable: boolean; missingTables: string[]; latencyMs?: number }> {
  if (!configured) return { reachable: false, missingTables: [...PLATFORM_REQUIRED_TABLES] };

  const start = Date.now();
  const results = await Promise.all(
    PLATFORM_REQUIRED_TABLES.map(async (table) => ({
      table,
      ok: await probeTable(table),
    }))
  );
  const missingTables = results.filter((result) => !result.ok).map((result) => result.table);
  return {
    reachable: missingTables.length < PLATFORM_REQUIRED_TABLES.length,
    missingTables,
    latencyMs: Date.now() - start,
  };
}

async function probeRedis(
  probe: () => Promise<boolean>,
  configured: boolean
): Promise<{ reachable: boolean; latencyMs?: number }> {
  if (!configured) return { reachable: false };
  const start = Date.now();
  return {
    reachable: await probe(),
    latencyMs: Date.now() - start,
  };
}

async function defaultSupabaseProbe(table: string): Promise<boolean> {
  const db = getClient();
  if (!db) return false;
  try {
    const { error } = await db.from(table).select("*").limit(1);
    return !error;
  } catch {
    return false;
  }
}

async function defaultRedisProbe(): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  const redis = getRedis();
  if (!redis) return false;
  try {
    await redis.set("quad:health:backend", "ok", { ex: 60 });
    const value = await redis.get<string>("quad:health:backend");
    return value === "ok";
  } catch {
    return false;
  }
}

function buildNextActions(
  components: BackendReadinessReport["components"],
  security: ReturnType<typeof securityReadiness>
): string[] {
  const actions: string[] = [];
  if (components.supabase.status !== "ready") {
    actions.push("Apply docs/backend/platform-schema.sql in Supabase before relying on durable runs.");
  }
  if (components.redis.status !== "ready") {
    actions.push("Configure Upstash Redis for live events, packet cache, and background job continuity.");
  }
  if (components.auth.status !== "ready") {
    actions.push("Set QUAD_API_SECRET and QUAD_ALLOWED_ORGS before exposing hosted mutation routes.");
  }
  if (components.encryption.status !== "ready") {
    actions.push("Set QUAD_CONNECTOR_ENCRYPTION_KEY before installing real connector credentials.");
  }
  if (components.browserbase.status !== "ready") {
    actions.push("Set Browserbase credentials so audits use remote browser execution.");
  }
  if (components.observability.status !== "ready") {
    actions.push("Configure both Sentry and Phoenix so sponsor-visible traces are real.");
  }
  if (components.voice.status !== "ready") {
    actions.push("Configure Deepgram or Moshi for the voice agent surface.");
  }
  if (!security.retentionPolicy || !security.orgAllowlistConfigured) {
    actions.push("Resolve security readiness warnings before production demo traffic.");
  }
  return actions;
}
