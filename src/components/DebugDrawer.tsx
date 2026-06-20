"use client";

import { useCallback, useEffect, useState } from "react";
import {
  summarizeBackends,
  liveCount,
  isDemoReady,
  summarizeReadiness,
  type BackendRow,
  type BackendSettings,
  type ReadinessTone,
} from "@/lib/debug/status";

/**
 * Proof drawer. Polls /api/settings and shows which backends are live so the
 * stack is demonstrably real (Redis, Browserbase, Arize, Sentry, brain, voice).
 * Offline backends show the fallback that is currently in play.
 */
export function DebugDrawer() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<BackendSettings | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      setSettings(await res.json());
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const rows = settings ? summarizeBackends(settings) : [];
  const count = liveCount(rows);
  const readiness = settings ? summarizeReadiness(settings) : null;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-40 rounded-full border border-edge bg-panel px-3 py-1.5 text-xs text-neutral-300 shadow-lg hover:border-accent/40"
      >
        Backends {settings ? `${count.live}/${count.total}` : ""}
      </button>

      {open && (
        <aside className="fixed bottom-16 right-4 z-50 max-h-[calc(100vh-6rem)] w-[calc(100vw-2rem)] animate-fade-in overflow-y-auto rounded-xl border border-edge bg-panel p-4 shadow-2xl sm:w-96 lg:right-[22rem]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">Stack status</span>
            <div className="flex items-center gap-2">
              <button onClick={refresh} className="text-xs text-neutral-500 hover:text-neutral-300">
                {loading ? "..." : "Refresh"}
              </button>
              <button onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:text-neutral-300">
                Close
              </button>
            </div>
          </div>

          {settings && readiness && (
            <div className="mb-3 rounded-lg border border-edge bg-ink/50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className={`text-xs font-medium ${toneText(readiness.tone)}`}>
                    {readiness.label}
                  </div>
                  <div className="mt-1 text-[11px] leading-4 text-neutral-500">
                    {readiness.nextAction}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-semibold tabular-nums text-neutral-100">
                    {readiness.score}
                  </div>
                  <div className="text-[10px] text-neutral-600">Score</div>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-900">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${toneBar(readiness.tone)}`}
                  style={{ width: `${readiness.score}%` }}
                />
              </div>
            </div>
          )}

          {settings && (
            <div className="mb-3 flex items-center gap-2 text-[11px]">
              <span className={isDemoReady(settings) ? "text-accent" : "text-amber-300"}>
                {isDemoReady(settings) ? "Demo-ready" : "Running on fallbacks"}
              </span>
            </div>
          )}

          {readiness && (
            <div className="mb-3 space-y-1.5">
              {readiness.items.map((item) => (
                <div key={item.label} className="rounded bg-ink/50 px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${item.live ? "bg-accent" : "bg-neutral-600"}`} />
                    <span className="text-[11px] text-neutral-300">{item.label}</span>
                  </div>
                  <div className="mt-1 pl-3.5 text-[10px] leading-tight text-neutral-500">
                    {item.detail}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            {rows.map((row) => (
              <StatusRow key={row.key} row={row} />
            ))}
          </div>

          {settings && (
            <div className="mt-3 border-t border-edge pt-2 text-[11px] text-neutral-500">
              <div>Chat: {settings.chatModel ?? "Default"}</div>
              <div>Audit: {settings.auditModel ?? "Default"}</div>
              <div className="mt-2 text-neutral-400">Voice: {settings.voiceDecision}</div>
            </div>
          )}
        </aside>
      )}
    </>
  );
}

function toneText(tone: ReadinessTone): string {
  return {
    production: "text-accent",
    demo: "text-sky-300",
    fallback: "text-amber-300",
  }[tone];
}

function toneBar(tone: ReadinessTone): string {
  return {
    production: "bg-accent",
    demo: "bg-sky-300",
    fallback: "bg-amber-300",
  }[tone];
}

function StatusRow({ row }: { row: BackendRow }) {
  return (
    <div className="flex items-start gap-2 rounded bg-ink/60 px-2 py-1.5">
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${row.live ? "bg-accent" : "bg-neutral-600"}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-neutral-200">{row.label}</span>
          {row.sponsor && <span className="text-[10px] text-neutral-600">{row.sponsor}</span>}
        </div>
        {!row.live && (
          <div className="text-[10px] leading-tight text-neutral-500">{row.fallback}</div>
        )}
      </div>
    </div>
  );
}
