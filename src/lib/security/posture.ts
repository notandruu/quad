import { CAPABILITY_CATALOG, summarizeCapabilities } from "@/lib/metaregistry";
import { getObservabilityReadiness } from "@/lib/observability";
import { getServiceTokenReadiness, securityReadiness, type ServiceTokenReadiness } from ".";
import { buildRetentionPolicy, type RetentionPolicy } from "./retention";

export type SecurityControlStatus = "pass" | "warning" | "missing";

export type SecurityControl = {
  id: string;
  label: string;
  status: SecurityControlStatus;
  detail: string;
  evidence: string[];
};

export type SecurityDataFlow = {
  id: string;
  label: string;
  data: string;
  leavesTenant: boolean;
  minimization: string;
  proof: string;
};

export type SecurityPacket = {
  orgId: string;
  generatedAt: string;
  posture: "production_ready" | "demo_guarded" | "needs_hardening";
  score: number;
  controls: SecurityControl[];
  dataFlows: SecurityDataFlow[];
  modelRoutes: Array<{
    purpose: string;
    provider: string;
    maxChars: number;
    restrictedDefault: "blocked" | "redacted";
  }>;
  storage: Array<{
    store: string;
    contents: string;
    isolation: string;
    retention: string;
  }>;
  deletion: {
    configured: boolean;
    retentionDays: number | null;
    policy: RetentionPolicy;
    supportedToday: string[];
    missing: string[];
  };
  serviceTokens: ServiceTokenReadiness;
  connectorScopes: Array<{
    id: string;
    scopes: string[];
    writes: boolean;
    approvalMode: string;
    active: boolean;
  }>;
  redactionGuarantees: string[];
  warnings: string[];
};

export type SecurityPacketSummary = {
  posture: SecurityPacket["posture"];
  score: number;
  controls: Array<Pick<SecurityControl, "id" | "label" | "status" | "detail">>;
  warnings: string[];
};

export function buildSecurityPacket(input: {
  orgId: string;
  env?: Record<string, string | undefined>;
  now?: string;
}): SecurityPacket {
  const env = input.env ?? process.env;
  const readiness = securityReadiness(env);
  const capabilities = summarizeCapabilities(env);
  const retentionPolicy = buildRetentionPolicy({ orgId: input.orgId, env, now: input.now });
  const retentionDays = retentionPolicy.retentionDays;
  const apiSecretConfigured = Boolean(env.QUAD_API_SECRET);
  const serviceTokens = getServiceTokenReadiness(env);
  const allowedOrgsConfigured = Boolean(env.QUAD_ALLOWED_ORGS);
  const durableBrainConfigured = Boolean(
    env.DATABASE_URL || (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY)
  );
  const redisConfigured = Boolean(env.QUAD_REDIS_REST_URL && env.QUAD_REDIS_REST_TOKEN);
  const sentryConfigured = Boolean(env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN);
  const phoenixConfigured = Boolean(env.PHOENIX_COLLECTOR_ENDPOINT);
  const telemetrySafety = getObservabilityReadiness(env).telemetrySafety;
  const unsafeWriteCapabilities = CAPABILITY_CATALOG.filter(
    (capability) => capability.writes && capability.approvalMode === "none"
  );

  const controls: SecurityControl[] = [
    control({
      id: "tenant_isolation",
      label: "Tenant isolation",
      ok: readiness.tenantKeySubstrate && readiness.requestAuthSubstrate,
      warning: !apiSecretConfigured,
      passDetail: "Tenant keys and hosted request auth are available.",
      warningDetail: "Tenant keys are available; hosted API secret is not configured, so only demo-org fallback should be used.",
      missingDetail: "Tenant isolation substrate is missing.",
      evidence: [
        "redis/cache keys are namespaced with tenantKey()",
        "org-owned API routes use authorizeRequest()",
      ],
    }),
    control({
      id: "org_allowlist",
      label: "Org allowlist",
      ok: allowedOrgsConfigured,
      passDetail: "QUAD_ALLOWED_ORGS restricts hosted org access.",
      missingDetail: "QUAD_ALLOWED_ORGS is not configured; secret holders can request any org.",
      evidence: ["authorizeRequest() enforces QUAD_ALLOWED_ORGS when present"],
    }),
    control({
      id: "service_tokens",
      label: "Scoped service tokens",
      ok: serviceTokens.configured && serviceTokens.unscopedCount === 0 && serviceTokens.orgScopedCount === serviceTokens.count,
      warning: serviceTokens.configured && (serviceTokens.unscopedCount > 0 || serviceTokens.orgScopedCount < serviceTokens.count),
      passDetail: `Scoped service tokens are configured for ${serviceTokens.count} runtime(s).`,
      warningDetail: "Service tokens exist, but at least one token is admin-scoped or not org-scoped.",
      missingDetail: "Service runtimes still need to share the admin API secret.",
      evidence: ["QUAD_SERVICE_TOKENS", "requiredScopes on worker and jobs routes"],
    }),
    control({
      id: "model_gateway",
      label: "Model gateway",
      ok: readiness.modelGatewaySubstrate,
      passDetail: "Model payloads are classified, minimized, and blocked when restricted by default.",
      missingDetail: "Model gateway substrate is missing.",
      evidence: ["prepareModelPayload()", "classifyText()", "sanitizePayload()"],
    }),
    control({
      id: "telemetry_redaction",
      label: "Telemetry redaction",
      ok: readiness.telemetryRedactionSubstrate && telemetrySafety.ok,
      warning: telemetrySafety.status === "warning" || (!sentryConfigured && !phoenixConfigured),
      passDetail: "Telemetry attributes avoid raw org ids and raw payloads.",
      warningDetail: telemetrySafety.status === "warning"
        ? "Telemetry redaction is active, but observability configuration has warnings."
        : "Redaction helpers exist, but Sentry and Phoenix are not both configured.",
      missingDetail: telemetrySafety.status === "blocker"
        ? "Unsafe telemetry configuration is enabled."
        : "Telemetry redaction substrate is missing.",
      evidence: [
        "telemetryAttributes() emits org hash and payload lengths",
        "validateTelemetryConfig() blocks raw prompt, response, and payload logging flags",
        ...telemetrySafety.issues.map((issue) => issue.id),
      ],
    }),
    control({
      id: "durable_memory",
      label: "Durable memory",
      ok: durableBrainConfigured,
      passDetail: "Durable Postgres/Supabase memory is configured.",
      missingDetail: "Memory falls back to in-process demo data.",
      evidence: ["DATABASE_URL or SUPABASE_URL + SUPABASE_SERVICE_KEY"],
    }),
    control({
      id: "event_retention",
      label: "Retention policy",
      ok: retentionDays !== null,
      warning: redisConfigured,
      passDetail: `Retention policy is configured for ${retentionDays ?? 0} days.`,
      warningDetail: "Redis/event TTL is configured, but QUAD_RETENTION_DAYS is missing.",
      missingDetail: "No global retention policy is configured.",
      evidence: ["QUAD_RETENTION_DAYS", "QUAD_AUDIT_EVENT_TTL_SECONDS"],
    }),
    control({
      id: "connector_approval",
      label: "Connector approval gates",
      ok: unsafeWriteCapabilities.length === 0,
      passDetail: "All write-capable registry entries require approval.",
      missingDetail: "A write-capable registry entry can run without approval.",
      evidence: CAPABILITY_CATALOG.filter((capability) => capability.writes).map(
        (capability) => `${capability.id}:${capability.approvalMode}`
      ),
    }),
    control({
      id: "connector_credentials",
      label: "Connector credentials",
      ok: true,
      warning: !env.QUAD_CONNECTOR_ENCRYPTION_KEY && !env.QUAD_API_SECRET,
      passDetail: "Connector credentials are encrypted at rest and exposed only as metadata summaries.",
      warningDetail: "Connector credentials are encrypted with the local development fallback key; configure QUAD_CONNECTOR_ENCRYPTION_KEY before hosting.",
      missingDetail: "Connector credential vault is missing.",
      evidence: ["connector_credentials table", "installConnectorCredential()", "revokeConnectorCredential()"],
    }),
    control({
      id: "mutation_rate_limits",
      label: "Mutation rate limits",
      ok: true,
      passDetail: "Hosted mutation routes share org-scoped rate-limit guards with Redis and memory fallback.",
      missingDetail: "Mutation routes are not rate limited.",
      evidence: ["checkMutationGuards()", "checkRateLimit()", "QUAD_MUTATION_RATE_LIMIT"],
    }),
    control({
      id: "idempotent_mutations",
      label: "Idempotent mutations",
      ok: true,
      passDetail: "High-risk mutation routes support Idempotency-Key replay and conflict detection.",
      missingDetail: "Mutation routes do not support safe retries.",
      evidence: ["Idempotency-Key", "saveIdempotentResult()", "buildRequestFingerprint()"],
    }),
    control({
      id: "quadchain_receipts",
      label: "Quadchain receipts",
      ok: capabilities.activeTools.some((tool) => tool.id === "quad.chain_verifier"),
      passDetail: "Proof-carrying packet verification is active.",
      missingDetail: "Quadchain verifier is unavailable.",
      evidence: ["quad.chain_verifier capability"],
    }),
  ];

  const score = scoreControls(controls);
  const productionReady = score >= 90 && controls.every((item) => item.status === "pass");
  const warnings = controls
    .filter((item) => item.status !== "pass")
    .map((item) => `${item.label}: ${item.detail}`);

  return {
    orgId: input.orgId,
    generatedAt: input.now ?? new Date().toISOString(),
    posture: productionReady ? "production_ready" : apiSecretConfigured ? "demo_guarded" : "needs_hardening",
    score,
    controls,
    dataFlows: [
      {
        id: "audit_context",
        label: "Audit context",
        data: "Rendered website text, screenshots, company brain memories, findings, and verifier outputs.",
        leavesTenant: true,
        minimization: "Model calls are bounded by purpose-specific character limits and redacted before provider calls.",
        proof: "Audit findings and reports emit quadchain packet summaries.",
      },
      {
        id: "voice_context",
        label: "Voice context",
        data: "Uploaded audio is sent to Deepgram for transcription when configured.",
        leavesTenant: true,
        minimization: "The stored packet contains transcript text and audio metadata, not raw audio bytes.",
        proof: "voice_transcript quadchain packet.",
      },
      {
        id: "operator_context",
        label: "Operator context",
        data: "Run summaries, approvals, staged artifacts, capability states, and security controls.",
        leavesTenant: false,
        minimization: "Operator payloads use summaries and hashes instead of raw private source documents.",
        proof: "Protected org-scoped /api/operator response.",
      },
    ],
    modelRoutes: [
      { purpose: "chat", provider: "anthropic", maxChars: 12000, restrictedDefault: "blocked" },
      { purpose: "audit", provider: "anthropic", maxChars: 24000, restrictedDefault: "blocked" },
      { purpose: "embedding", provider: "openai", maxChars: 8000, restrictedDefault: "blocked" },
      { purpose: "evaluation", provider: "anthropic", maxChars: 12000, restrictedDefault: "blocked" },
      { purpose: "trust_packet", provider: "anthropic", maxChars: 16000, restrictedDefault: "blocked" },
    ],
    storage: [
      {
        store: "workflow ledger",
        contents: "run, task, artifact, approval, and receipt rows plus snapshot fallback",
        isolation: "org_id filtered and protected by request auth on exposed routes",
        retention: retentionDays ? `${retentionDays} days target` : "not configured",
      },
      {
        store: "quadchain registry",
        contents: "packet json, certificate json, verification status, hashes, and summaries",
        isolation: "org/run/source indexes with restricted packet summaries",
        retention: retentionDays ? `${retentionDays} days target` : "not configured",
      },
      {
        store: "company brain",
        contents: "approved memories, source ids, summaries, entities, permissions, metadata sidecars, evidence, and embeddings",
        isolation: "org-scoped retrieval plus company/team/personal permission filters",
        retention: retentionDays ? `${retentionDays} days target` : "not configured",
      },
      {
        store: "connector credentials",
        contents: "encrypted credential envelopes, scopes, install status, hashes, actor, and revocation timestamps",
        isolation: "org_id filtered and protected by request auth on exposed routes",
        retention: retentionDays ? `${retentionDays} days target plus explicit revoke` : "explicit revoke supported",
      },
    ],
    deletion: {
      configured: retentionDays !== null,
      retentionDays,
      policy: retentionPolicy,
      supportedToday: [
        "protected dry-run deletion receipts",
        "protected org/run deletion execution",
        "ttl-backed audit events",
        "in-memory demo reset",
      ],
      missing: [
        "self-serve org data export",
        "external provider-side token invalidation",
      ],
    },
    serviceTokens,
    connectorScopes: capabilities.activeTools.map((tool) => {
      const manifest = CAPABILITY_CATALOG.find((capability) => capability.id === tool.id);
      return {
        id: tool.id,
        scopes: tool.scopes,
        writes: Boolean(manifest?.writes),
        approvalMode: tool.approvalMode,
        active: true,
      };
    }),
    redactionGuarantees: [
      "restricted payloads are blocked from model calls unless explicitly overridden",
      "non-public payloads are redacted before provider calls",
      "telemetry emits hashed org ids and payload lengths, not raw org ids or source text",
      "unsafe telemetry flags are surfaced as security posture blockers",
      "security packet summaries never include env secret values",
    ],
    warnings,
  };
}

export function summarizeSecurityPacket(packet: SecurityPacket): SecurityPacketSummary {
  return {
    posture: packet.posture,
    score: packet.score,
    controls: packet.controls.map((item) => ({
      id: item.id,
      label: item.label,
      status: item.status,
      detail: item.detail,
    })),
    warnings: packet.warnings,
  };
}

function control(input: {
  id: string;
  label: string;
  ok: boolean;
  warning?: boolean;
  passDetail: string;
  warningDetail?: string;
  missingDetail: string;
  evidence: string[];
}): SecurityControl {
  if (input.ok && !input.warning) {
    return {
      id: input.id,
      label: input.label,
      status: "pass",
      detail: input.passDetail,
      evidence: input.evidence,
    };
  }

  if (input.ok || input.warning) {
    return {
      id: input.id,
      label: input.label,
      status: "warning",
      detail: input.warningDetail ?? input.missingDetail,
      evidence: input.evidence,
    };
  }

  return {
    id: input.id,
    label: input.label,
    status: "missing",
    detail: input.missingDetail,
    evidence: input.evidence,
  };
}

function scoreControls(controls: SecurityControl[]): number {
  const total = controls.reduce((sum, item) => {
    if (item.status === "pass") return sum + 1;
    if (item.status === "warning") return sum + 0.5;
    return sum;
  }, 0);
  return Math.round((total / controls.length) * 100);
}
