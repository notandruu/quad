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
  detail: string;
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

  const status =
    sentryConfigured && phoenixEndpoint ? "ready" : sentryConfigured || phoenixEndpoint ? "degraded" : "missing";

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
    detail:
      status === "ready"
        ? "Sentry and Phoenix are configured."
        : status === "degraded"
          ? "Only one observability sink is configured."
          : "Sentry and Phoenix are missing.",
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
