"use client";

import { useCallback, useEffect, useState } from "react";
import {
  summarizeBackends,
  liveCount,
  isDemoReady,
  type BackendRow,
  type BackendSettings,
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

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-4 right-4 z-40 rounded-full border border-edge bg-panel px-3 py-1.5 text-xs text-neutral-300 shadow-lg hover:border-accent/40"
      >
        Backends {settings ? `${count.live}/${count.total}` : ""}
      </button>

      {open && (
        <aside className="fixed bottom-16 right-4 z-40 w-80 animate-fade-in rounded-xl border border-edge bg-panel p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium">Stack status</span>
            <div className="flex items-center gap-2">
              <button onClick={refresh} className="text-xs text-neutral-500 hover:text-neutral-300">
                {loading ? "..." : "refresh"}
              </button>
              <button onClick={() => setOpen(false)} className="text-xs text-neutral-500 hover:text-neutral-300">
                close
              </button>
            </div>
          </div>

          {settings && (
            <div className="mb-3 flex items-center gap-2 text-[11px]">
              <span className={isDemoReady(settings) ? "text-accent" : "text-amber-300"}>
                {isDemoReady(settings) ? "Demo-ready" : "Running on fallbacks"}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            {rows.map((row) => (
              <StatusRow key={row.key} row={row} />
            ))}
          </div>

          {settings && (
            <div className="mt-3 border-t border-edge pt-2 text-[11px] text-neutral-500">
              <div>chat: {settings.chatModel ?? "default"}</div>
              <div>audit: {settings.auditModel ?? "default"}</div>
            </div>
          )}
        </aside>
      )}
    </>
  );
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
