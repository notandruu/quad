/**
 * Shape returned by GET /api/settings. Each boolean reports whether that
 * backend is configured (its env vars are present).
 */
export type BackendSettings = {
  redis: boolean;
  brain: boolean;
  brainLatencyMs?: number;
  embeddings: boolean;
  browserbase: boolean;
  phoenix: boolean;
  sentry: boolean;
  deepgram: boolean;
  voice: boolean;
  voiceClientUrl: string | null;
  voiceDecision: string;
  voiceNextAction: string;
  chatModel: string | null;
  auditModel: string | null;
};

export type BackendCategory =
  | "Live spine"
  | "Brain"
  | "Browser"
  | "Quality"
  | "Reliability"
  | "Voice";

export type BackendRow = {
  key: keyof BackendSettings;
  label: string;
  category: BackendCategory;
  live: boolean;
  /** What the user sees when this backend is offline, and the fallback in play. */
  fallback: string;
  /** Sponsor this proves out, for the demo narrative. */
  sponsor?: string;
};

export type ReadinessTone = "production" | "demo" | "fallback";

export type ReadinessItem = {
  label: string;
  live: boolean;
  detail: string;
};

export type ReadinessSummary = {
  label: string;
  tone: ReadinessTone;
  score: number;
  nextAction: string;
  items: ReadinessItem[];
};

const ROWS: Omit<BackendRow, "live">[] = [
  {
    key: "redis",
    label: "Redis streams",
    category: "Live spine",
    fallback: "Events stream inline; no cross-refresh replay.",
    sponsor: "Redis",
  },
  {
    key: "browserbase",
    label: "Browserbase render",
    category: "Browser",
    fallback: "Static fetch only; no screenshots or JS-rendered content.",
    sponsor: "Browserbase",
  },
  {
    key: "brain",
    label: "Postgres + pgvector",
    category: "Brain",
    fallback: "In-memory seed brain (demo org only).",
  },
  {
    key: "embeddings",
    label: "OpenAI embeddings",
    category: "Brain",
    fallback: "Deterministic hash vector (dev only, no semantic search).",
    sponsor: "OpenAI",
  },
  {
    key: "phoenix",
    label: "Arize Phoenix",
    category: "Quality",
    fallback: "Traces and evals are computed but not exported.",
    sponsor: "Arize",
  },
  {
    key: "sentry",
    label: "Sentry",
    category: "Reliability",
    fallback: "Spans run as no-ops; errors are not reported.",
    sponsor: "Sentry",
  },
  {
    key: "deepgram",
    label: "Deepgram voice",
    category: "Voice",
    fallback: "Browser speech recognition or text chat handles commands.",
    sponsor: "Deepgram",
  },
  {
    key: "voice",
    label: "Voice surface",
    category: "Voice",
    fallback: "Voice disabled; use text chat.",
    sponsor: "Deepgram / Kyutai",
  },
];

/**
 * Map raw settings into ordered status rows for the debug drawer. Pure so it is
 * unit-testable without rendering. Live backends sort to the top.
 */
export function summarizeBackends(settings: BackendSettings): BackendRow[] {
  return ROWS.map((row) => ({ ...row, live: Boolean(settings[row.key]) })).sort(
    (a, b) => Number(b.live) - Number(a.live)
  );
}

/** True when every backend in the demo-critical set is live. */
export function isDemoReady(settings: BackendSettings): boolean {
  return settings.redis && settings.browserbase;
}

export function liveCount(rows: BackendRow[]): { live: number; total: number } {
  return { live: rows.filter((r) => r.live).length, total: rows.length };
}

/**
 * Product readiness summary for the debug drawer. This answers what the team
 * can honestly demo or claim in production from the currently wired backends.
 */
export function summarizeReadiness(settings: BackendSettings): ReadinessSummary {
  const items: ReadinessItem[] = [
    {
      label: "Live audit spine",
      live: settings.redis && settings.browserbase,
      detail: settings.redis && settings.browserbase
        ? "Events replay and rendered browser evidence are live."
        : "Needs Redis Streams and Browserbase for the strongest demo.",
    },
    {
      label: "Durable company brain",
      live: settings.brain,
      detail: settings.brain
        ? "Postgres + pgvector is configured."
        : "Using in-memory BrightPath seed data.",
    },
    {
      label: "Quality telemetry",
      live: settings.phoenix,
      detail: settings.phoenix
        ? "Phoenix can receive LLM and tool traces."
        : "Evals run locally, but traces are not exported.",
    },
    {
      label: "Reliability telemetry",
      live: settings.sentry,
      detail: settings.sentry
        ? "Sentry can capture route, worker, and tool failures."
        : "Sentry spans run as no-ops.",
    },
    {
      label: "Voice transport",
      live: settings.voice,
      detail: settings.voice
        ? settings.deepgram
          ? "Deepgram push-to-talk transcription is configured."
          : "Moshi endpoint configured."
        : "Voice is disabled; text flow remains available.",
    },
  ];

  const live = items.filter((item) => item.live).length;
  const score = Math.round((live / items.length) * 100);

  if (items.every((item) => item.live)) {
    return {
      label: "Production wired",
      tone: "production",
      score,
      nextAction: "Run a real customer audit and verify traces in Sentry and Phoenix.",
      items,
    };
  }

  if (settings.redis && settings.browserbase) {
    return {
      label: "Demo spine live",
      tone: "demo",
      score,
      nextAction: "Wire Sentry and Phoenix before pitching this as production-grade.",
      items,
    };
  }

  return {
    label: "Fallback mode",
    tone: "fallback",
    score,
    nextAction: "Provision Redis and Browserbase first; they prove the core audit loop.",
    items,
  };
}
