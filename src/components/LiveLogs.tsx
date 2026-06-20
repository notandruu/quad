"use client";

import type { PublishedEvent } from "@/lib/redis/publisher";

type Counters = Record<string, number>;

/**
 * Right-side collapsible live log panel. Items animate in; counters animate
 * upward; status glows while a run is active and calms when complete.
 */
export function LiveLogs({
  events,
  counters,
  active,
  open,
  onToggle,
}: {
  events: PublishedEvent[];
  counters: Counters;
  active: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  if (!open) {
    return (
      <button
        onClick={onToggle}
        className="self-start rounded-md border border-edge bg-panel px-3 py-1 text-xs text-neutral-400"
      >
        Show logs
      </button>
    );
  }

  return (
    <aside className="flex h-full w-80 flex-col gap-3 rounded-lg border border-edge bg-panel p-3">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${active ? "animate-glow text-accent" : "text-neutral-400"}`}>
          {active ? "Auditing" : "Idle"}
        </span>
        <button onClick={onToggle} className="text-xs text-neutral-500 hover:text-neutral-300">
          Hide
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <Counter label="Discovered" value={counters.pagesDiscovered} />
        <Counter label="Rendered" value={counters.pagesFetched} />
        <Counter label="Analyzed" value={counters.pagesAnalyzed} />
        <Counter label="Findings" value={counters.findingsCreated} />
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto">
        {events.map((e, i) => (
          <div key={i} className="animate-fade-in rounded bg-ink/60 px-2 py-1 text-[11px] text-neutral-400">
            <span className="text-neutral-500">#{e.sequence}</span> {e.type}
          </div>
        ))}
      </div>
    </aside>
  );
}

function Counter({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded bg-ink/60 px-2 py-1">
      <div className="text-neutral-500">{label}</div>
      <div className="tabular-nums text-neutral-200">{value ?? 0}</div>
    </div>
  );
}
