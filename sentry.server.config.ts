import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  // Capture token usage, latency, and tool spans for AI agent monitoring.
  // See https://docs.sentry.io/platforms/javascript/guides/nextjs/
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.NODE_ENV,
});
