"use client";

import { useEffect, useMemo, useRef } from "react";
import type { PublishedEvent } from "@/lib/redis/publisher";
import {
  buildCounterRows,
  buildLogRows,
  progressPercent,
  type LogTone,
} from "@/lib/debug/liveLogs";

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
  const rows = useMemo(() => buildLogRows(events), [events]);
  const counterRows = useMemo(() => buildCounterRows(counters), [counters]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [rows.length]);

  if (!open) {
    return (
      <button
        onClick={onToggle}
        className="self-start rounded-md border border-edge bg-panel px-3 py-2 text-xs text-neutral-400 transition hover:border-neutral-700 hover:text-neutral-200"
      >
        Show logs
      </button>
    );
  }

  return (
    <aside className="flex h-full w-full shrink-0 flex-col overflow-hidden rounded-lg border border-edge bg-panel lg:w-80">
      <div className="border-b border-edge px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  active ? "animate-pulse bg-accent shadow-[0_0_18px_rgba(110,231,183,0.5)]" : "bg-neutral-700"
                }`}
              />
              <span className={`text-xs font-medium ${active ? "text-accent" : "text-neutral-400"}`}>
                {active ? "Audit running" : rows.length > 0 ? "Audit finished" : "Audit idle"}
              </span>
            </div>
            <p className="mt-1 truncate text-[11px] text-neutral-600">
              {rows.length > 0 ? `${rows.length} live events captured` : "Waiting for the first run"}
            </p>
          </div>
          <button
            onClick={onToggle}
            className="rounded-md border border-edge px-2 py-1 text-[11px] text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-300"
          >
            Hide
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-edge p-3 text-xs">
        {counterRows.map((row) => (
          <Counter key={row.key} label={row.label} value={row.value} percent={progressPercent(row)} />
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
        {rows.length === 0 ? (
          <div className="flex h-full min-h-48 items-center justify-center rounded-md border border-dashed border-edge px-4 text-center text-xs leading-5 text-neutral-600">
            Start an audit and this panel will stream the worker timeline here.
          </div>
        ) : (
          rows.map((row, i) => (
            <div
              key={`${row.sequence}-${i}`}
              className="animate-fade-in rounded-md border border-edge bg-ink/55 px-3 py-2"
            >
              <div className="flex items-start gap-2">
                <ToneDot tone={row.tone} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] font-medium text-neutral-200">
                      {row.label}
                    </span>
                    <span className="shrink-0 text-[10px] tabular-nums text-neutral-600">
                      {row.time}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-neutral-500">
                    {row.detail}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-neutral-700">
                  {row.sequence}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function Counter({
  label,
  value,
  percent,
}: {
  label: string;
  value: number;
  percent: number;
}) {
  return (
    <div className="rounded-md border border-edge bg-ink/50 px-2 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="truncate text-[11px] text-neutral-500">{label}</div>
        <div className="text-sm font-semibold tabular-nums text-neutral-100 transition-all duration-300">
          {value}
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-900">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function ToneDot({ tone }: { tone: LogTone }) {
  const className: Record<LogTone, string> = {
    neutral: "bg-neutral-600",
    active: "bg-sky-400",
    success: "bg-accent",
    warning: "bg-amber-300",
    error: "bg-red-400",
  };

  return (
    <span className="mt-1 flex h-2 w-2 shrink-0 items-center justify-center">
      <span className={`h-1.5 w-1.5 rounded-full ${className[tone]}`} />
    </span>
  );
}
