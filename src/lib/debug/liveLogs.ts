import type { PublishedEvent } from "@/lib/redis/publisher";

export type LogTone = "neutral" | "active" | "success" | "warning" | "error";

export type LogViewModel = {
  sequence: string;
  label: string;
  detail: string;
  time: string;
  tone: LogTone;
};

export type CounterViewModel = {
  key: string;
  label: string;
  value: number;
  max: number;
};

const LABELS: Record<string, string> = {
  "audit.started": "Audit started",
  "audit.pages_discovered": "Pages discovered",
  "page.queued": "Page queued",
  "page.rendering": "Rendering page",
  "page.rendered": "Page rendered",
  "page.fetched": "Page fetched",
  "page.analyzing": "Analyzing page",
  "page.analyzed": "Page analyzed",
  "page.failed": "Page failed",
  "finding.created": "Finding created",
  "finding.evaluated": "Finding evaluated",
  "audit.synthesizing": "Synthesizing report",
  "audit.complete": "Audit complete",
  "audit.failed": "Audit failed",
};

const TONES: Record<string, LogTone> = {
  "audit.started": "active",
  "page.rendering": "active",
  "page.analyzing": "active",
  "audit.synthesizing": "active",
  "page.rendered": "success",
  "page.analyzed": "success",
  "finding.created": "warning",
  "finding.evaluated": "success",
  "audit.complete": "success",
  "page.failed": "error",
  "audit.failed": "error",
};

export function buildLogRows(events: PublishedEvent[]): LogViewModel[] {
  return events.map((event, index) => ({
    sequence: event.sequence >= 0 ? `#${event.sequence + 1}` : `#${index + 1}`,
    label: LABELS[event.type] ?? humanize(event.type),
    detail: eventDetail(event),
    time: formatLogTime(event.createdAt),
    tone: TONES[event.type] ?? "neutral",
  }));
}

export function buildCounterRows(
  counters: Record<string, number>
): CounterViewModel[] {
  const discovered = counters.pagesDiscovered ?? 0;
  const rendered = counters.pagesFetched ?? counters.pagesRendered ?? 0;
  const analyzed = counters.pagesAnalyzed ?? 0;
  const findings = counters.findingsCreated ?? 0;

  return [
    { key: "pagesDiscovered", label: "Discovered", value: discovered, max: discovered },
    { key: "pagesFetched", label: "Rendered", value: rendered, max: discovered },
    { key: "pagesAnalyzed", label: "Analyzed", value: analyzed, max: discovered },
    { key: "findingsCreated", label: "Findings", value: findings, max: Math.max(findings, 1) },
  ];
}

export function progressPercent(row: CounterViewModel): number {
  if (row.max <= 0) return 0;
  return Math.min(100, Math.round((row.value / row.max) * 100));
}

function eventDetail(event: PublishedEvent): string {
  const payload = event.payload;

  if (typeof payload.url === "string") return compactUrl(payload.url);
  if (typeof payload.targetUrl === "string") return compactUrl(payload.targetUrl);
  if (typeof payload.title === "string") return payload.title;
  if (typeof payload.error === "string") return payload.error;
  if (typeof payload.count === "number") return `${payload.count} page${payload.count === 1 ? "" : "s"}`;
  if (typeof payload.findings === "number") {
    return `${payload.findings} finding${payload.findings === 1 ? "" : "s"}`;
  }
  if (typeof payload.findingsShown === "number") {
    const filtered =
      typeof payload.findingsFiltered === "number"
        ? `, ${payload.findingsFiltered} filtered`
        : "";
    return `${payload.findingsShown} shown${filtered}`;
  }
  if (payload.eval && typeof payload.eval === "object") {
    const evalPayload = payload.eval as Record<string, unknown>;
    const risk = typeof evalPayload.hallucinationRisk === "string"
      ? evalPayload.hallucinationRisk
      : "unknown";
    return `Risk ${risk}`;
  }

  return "Waiting for worker output";
}

function compactUrl(value: string): string {
  try {
    const url = new URL(value);
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    return `${url.hostname}${path}`;
  } catch {
    return value;
  }
}

function formatLogTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function humanize(type: string): string {
  const words = type.replaceAll(".", " ").replaceAll("_", " ");
  return `${words.slice(0, 1).toUpperCase()}${words.slice(1)}`;
}
