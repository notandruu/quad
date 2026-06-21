import { captureInfo } from "./sentry";
import { traced } from "./phoenix";

export type ObservabilitySink = "sentry" | "phoenix";

export type ObservabilityReadiness = {
  status: "ready" | "degraded" | "missing";
  configured: boolean;
  sentry: {
    configured: boolean;
    serverDsn: boolean;
    publicDsn: boolean;
  };
  phoenix: {
    configured: boolean;
    endpoint: boolean;
    apiKey: boolean;
  };
  sinks: ObservabilitySink[];
  telemetrySafety: TelemetrySafetyReport;
  detail: string;
};

export type TelemetrySafetyIssue = {
  id:
    | "public_sentry_without_server"
    | "phoenix_key_without_endpoint"
    | "insecure_phoenix_endpoint"
    | "raw_payload_logging_enabled"
    | "raw_prompt_logging_enabled"
    | "raw_response_logging_enabled";
  severity: "warning" | "blocker";
  detail: string;
};

export type TelemetrySafetyReport = {
  ok: boolean;
  status: "pass" | "warning" | "blocker";
  issues: TelemetrySafetyIssue[];
  guarantees: string[];
};

export type ObservabilityProbeResult = {
  ok: boolean;
  probeId: string;
  orgHash: string;
  runId?: string;
  readiness: ObservabilityReadiness;
  emitted: Array<{
    sink: ObservabilitySink;
    ok: boolean;
    receiptId?: string;
    detail: string;
  }>;
  createdAt: string;
};

export function getObservabilityReadiness(
  env: Record<string, string | undefined> = process.env
): ObservabilityReadiness {
  const sentryServerDsn = Boolean(env.SENTRY_DSN);
  const sentryPublicDsn = Boolean(env.NEXT_PUBLIC_SENTRY_DSN);
  const sentryConfigured = sentryServerDsn || sentryPublicDsn;
  const phoenixEndpoint = Boolean(env.PHOENIX_COLLECTOR_ENDPOINT);
  const phoenixApiKey = Boolean(env.PHOENIX_API_KEY);
  const sinks: ObservabilitySink[] = [];
  if (sentryConfigured) sinks.push("sentry");
  if (phoenixEndpoint) sinks.push("phoenix");
  const telemetrySafety = validateTelemetryConfig(env);

  const status =
    telemetrySafety.status === "blocker"
      ? "degraded"
      : sentryConfigured && phoenixEndpoint
        ? "ready"
        : sentryConfigured || phoenixEndpoint
          ? "degraded"
          : "missing";

  return {
    status,
    configured: sinks.length > 0,
    sentry: {
      configured: sentryConfigured,
      serverDsn: sentryServerDsn,
      publicDsn: sentryPublicDsn,
    },
    phoenix: {
      configured: phoenixEndpoint,
      endpoint: phoenixEndpoint,
      apiKey: phoenixApiKey,
    },
    sinks,
    telemetrySafety,
    detail:
      telemetrySafety.status === "blocker"
        ? "Observability has unsafe telemetry configuration."
        : status === "ready"
        ? "Sentry and Phoenix are configured."
        : status === "degraded"
          ? "Only one observability sink is configured."
          : "Sentry and Phoenix are missing.",
  };
}

export function validateTelemetryConfig(
  env: Record<string, string | undefined> = process.env
): TelemetrySafetyReport {
  const issues: TelemetrySafetyIssue[] = [];
  const rawPayloadLogging = truthy(env.QUAD_TELEMETRY_LOG_RAW_PAYLOADS);
  const rawPromptLogging = truthy(env.QUAD_TELEMETRY_LOG_RAW_PROMPTS);
  const rawResponseLogging = truthy(env.QUAD_TELEMETRY_LOG_RAW_RESPONSES);

  if (env.NEXT_PUBLIC_SENTRY_DSN && !env.SENTRY_DSN) {
    issues.push({
      id: "public_sentry_without_server",
      severity: "warning",
      detail: "Public Sentry DSN is configured without a server DSN, so backend errors will not be captured.",
    });
  }
  if (env.PHOENIX_API_KEY && !env.PHOENIX_COLLECTOR_ENDPOINT) {
    issues.push({
      id: "phoenix_key_without_endpoint",
      severity: "warning",
      detail: "Phoenix API key is configured without a collector endpoint.",
    });
  }
  if (env.PHOENIX_COLLECTOR_ENDPOINT && !isHttpsUrl(env.PHOENIX_COLLECTOR_ENDPOINT)) {
    issues.push({
      id: "insecure_phoenix_endpoint",
      severity: "blocker",
      detail: "Phoenix collector endpoint must use HTTPS before telemetry leaves the runtime.",
    });
  }
  if (rawPayloadLogging) {
    issues.push({
      id: "raw_payload_logging_enabled",
      severity: "blocker",
      detail: "Raw payload telemetry logging is enabled.",
    });
  }
  if (rawPromptLogging) {
    issues.push({
      id: "raw_prompt_logging_enabled",
      severity: "blocker",
      detail: "Raw prompt telemetry logging is enabled.",
    });
  }
  if (rawResponseLogging) {
    issues.push({
      id: "raw_response_logging_enabled",
      severity: "blocker",
      detail: "Raw response telemetry logging is enabled.",
    });
  }

  const status = issues.some((issue) => issue.severity === "blocker")
    ? "blocker"
    : issues.length > 0
      ? "warning"
      : "pass";

  return {
    ok: status !== "blocker",
    status,
    issues,
    guarantees: [
      "Telemetry readiness reports booleans and issue ids, not secret values.",
      "Observability probes hash org ids before emitting spans or events.",
      "Raw prompt, response, and payload logging flags are treated as blockers.",
    ],
  };
}

export async function runObservabilityProbe(input: {
  orgId: string;
  runId?: string;
  env?: Record<string, string | undefined>;
  now?: string;
}): Promise<ObservabilityProbeResult> {
  const readiness = getObservabilityReadiness(input.env);
  const probeId = `obs_${crypto.randomUUID()}`;
  const createdAt = input.now ?? new Date().toISOString();
  const orgHash = hashForTelemetry(input.orgId);
  const emitted: ObservabilityProbeResult["emitted"] = [];

  if (readiness.sentry.configured) {
    try {
      const eventId = captureInfo("quad observability probe", {
        orgId: orgHash,
        runId: input.runId ?? probeId,
        eventBackend: "sentry",
      });
      emitted.push({
        sink: "sentry",
        ok: true,
        receiptId: eventId,
        detail: "Sentry info event accepted by SDK.",
      });
    } catch (error) {
      emitted.push({
        sink: "sentry",
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (readiness.phoenix.configured) {
    try {
      await traced(
        "observability.probe",
        {
          "quad.org_hash": orgHash,
          "quad.run_id": input.runId ?? probeId,
          "quad.probe_id": probeId,
          "quad.probe_created_at": createdAt,
        },
        async (span) => {
          span.setAttribute("quad.probe.ok", true);
        }
      );
      emitted.push({
        sink: "phoenix",
        ok: true,
        receiptId: probeId,
        detail: "Phoenix span emitted through OpenTelemetry.",
      });
    } catch (error) {
      emitted.push({
        sink: "phoenix",
        ok: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ok: readiness.status === "ready" && emitted.length === readiness.sinks.length && emitted.every((item) => item.ok),
    probeId,
    orgHash,
    runId: input.runId,
    readiness,
    emitted,
    createdAt,
  };
}

function hashForTelemetry(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function truthy(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test(value?.trim() ?? "");
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
