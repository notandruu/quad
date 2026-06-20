/**
 * Shape returned by GET /api/settings. Each boolean reports whether that
 * backend is configured (its env vars are present).
 */
export type BackendSettings = {
  redis: boolean;
  brain: boolean;
  browserbase: boolean;
  phoenix: boolean;
  sentry: boolean;
  voice: boolean;
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

const ROWS: Omit<BackendRow, "live">[] = [
  {
    key: "redis",
    label: "Redis Streams",
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
    key: "voice",
    label: "Moshi voice",
    category: "Voice",
    fallback: "Voice disabled; use text chat.",
    sponsor: "Kyutai",
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
