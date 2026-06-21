import { trace, type Span, SpanStatusCode } from "@opentelemetry/api";

/**
 * Arize Phoenix is an OpenTelemetry collector. We register a Node tracer
 * provider that exports spans over OTLP/HTTP to the Phoenix endpoint. Called
 * once from instrumentation.ts on the Node runtime.
 *
 * Docs: https://arize.com/docs/phoenix/tracing/llm-traces
 */
let registered = false;

export function registerPhoenix(): void {
  if (registered) return;
  const endpoint = process.env.PHOENIX_COLLECTOR_ENDPOINT;
  if (!endpoint) return;

  // Dynamic require keeps these heavy modules off the edge runtime bundle.
  const { NodeTracerProvider } = require("@opentelemetry/sdk-trace-node");
  const { SimpleSpanProcessor } = require("@opentelemetry/sdk-trace-node");
  const {
    OTLPTraceExporter,
  } = require("@opentelemetry/exporter-trace-otlp-http");
  const { Resource } = require("@opentelemetry/resources");
  const {
    SemanticResourceAttributes,
  } = require("@opentelemetry/semantic-conventions");

  const headers: Record<string, string> = {};
  if (process.env.PHOENIX_API_KEY) {
    headers.authorization = `Bearer ${process.env.PHOENIX_API_KEY}`;
  }

  const provider = new NodeTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "quad",
    }),
  });
  provider.addSpanProcessor(
    new SimpleSpanProcessor(new OTLPTraceExporter({ url: endpoint, headers }))
  );
  provider.register();
  registered = true;
}

const tracer = () => trace.getTracer("quad");

/**
 * Trace span names used across the audit and chat flows. Keep these stable so
 * the Phoenix dashboard groups traces consistently.
 */
export const SPAN = {
  chatRequest: "chat.request",
  brainRetrieve: "brain.retrieve",
  embeddingCreate: "embedding.create",
  discoverPages: "audit.discover_pages",
  renderPage: "browserbase.render_page",
  analyzePage: "llm.analyze_page",
  evaluateFinding: "llm.evaluate_finding",
  synthesize: "audit.synthesize",
  createTask: "tool.create_task",
  memoryWrite: "memory.write",
} as const;

export type SpanName = (typeof SPAN)[keyof typeof SPAN];

/**
 * Run an LLM/tool operation inside an OTel span exported to Phoenix. Attributes
 * follow OpenInference-style conventions where useful.
 */
export async function traced<T>(
  name: SpanName | string,
  attributes: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return tracer().startActiveSpan(name, async (span) => {
    try {
      span.setAttributes(attributes);
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}
