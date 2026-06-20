/**
 * Next.js runs this once per server process. We register Sentry first, then
 * OpenTelemetry/Phoenix tracing for the AI quality side.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
    const { registerPhoenix } = await import(
      "./src/lib/observability/phoenix"
    );
    registerPhoenix();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export async function onRequestError(
  ...args: Parameters<
    NonNullable<typeof import("@sentry/nextjs")["captureRequestError"]>
  >
) {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
