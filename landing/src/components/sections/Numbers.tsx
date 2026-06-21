"use client";

import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";
import { CountUp, MonoLabel } from "@/components/ui";

function Bars({ data, highlight }: { data: number[]; highlight?: number }) {
  const max = Math.max(...data);
  const days = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  return (
    <div>
      <div className="flex h-32 items-end gap-2">
        {data.map((v, i) => (
          <div
            key={i}
            className={`hatch-ink flex-1 ${i === highlight ? "bg-flame" : "bg-ink/12"}`}
            style={{ height: `${(v / max) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((_, i) => (
          <span
            key={i}
            className={`flex-1 text-center font-mono text-[9px] ${
              i === highlight ? "text-ink/70" : "text-ink/35"
            }`}
          >
            {days[i] ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}

function Spark({ up = true }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 120 36" className="h-9 w-full" preserveAspectRatio="none">
      <polyline
        points="0,30 18,26 36,28 54,18 72,20 90,10 108,12 120,4"
        fill="none"
        stroke={up ? "#E63E96" : "#1d1d1d"}
        strokeWidth="2"
      />
    </svg>
  );
}

function Cell({
  label,
  sub,
  children,
  className = "",
}: {
  label: string;
  sub?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative flex flex-col bg-paper p-5 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[12px] font-medium uppercase tracking-[0.04em] text-ink/70">
          {label}
        </span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 opacity-30">
          <path d="M8 2l5.5 3-5.5 3-5.5-3z" fill="#1d1d1d" />
          <path d="M2.5 8l5.5 3 5.5-3" stroke="#1d1d1d" strokeWidth="1.1" fill="none" />
          <path d="M2.5 11l5.5 3 5.5-3" stroke="#1d1d1d" strokeWidth="1.1" fill="none" />
        </svg>
      </div>
      {sub && <span className="mt-1 text-[12px] text-ink-soft">{sub}</span>}
      <div className="mt-auto pt-4">{children}</div>
    </div>
  );
}

export default function Numbers() {
  return (
    <Panel
      id="numbers"
      label="Proof"
      desc="Every number here is backed by evidence Quad collected and validated during real runs."
      title="The work, with receipts."
    >
      <Reveal className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink/10 bg-ink/10 md:grid-cols-4">
        {/* questions answered — spans 2 cols */}
        <Cell label="Questions answered" sub="Questionnaires + trust packets" className="col-span-2 row-span-2">
          <div className="tnum font-medium text-[46px] font-normal leading-none text-ink">
            <CountUp value={1231} />
          </div>
          <div className="mt-5">
            <Bars data={[6, 9, 7, 10, 13, 8, 5]} highlight={4} />
          </div>
        </Cell>

        {/* work automated list */}
        <Cell label="Work automated" className="col-span-2 md:col-span-2">
          <div className="space-y-2.5">
            {[
              ["Questionnaires completed", "420"],
              ["Evidence packets shipped", "1.2k"],
              ["Memories verified", "8.6k"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-ink/10 pb-2 text-[12px]">
                <span className="text-ink-soft">{k}</span>
                <span className="tnum font-medium text-ink">{v}</span>
              </div>
            ))}
          </div>
        </Cell>

        {/* grounded answers */}
        <Cell label="Grounded answers" sub="Cited to a source" className="col-span-1">
          <div className="flex items-end justify-between">
            <span className="tnum font-medium text-[32px] leading-none text-ink">
              <CountUp value={98} suffix="%" />
            </span>
            <div className="w-16">
              <Spark />
            </div>
          </div>
        </Cell>

        {/* resolution mode */}
        <Cell label="Resolution mode" className="col-span-1">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-ink-soft">Auto-shipped</span>
              <span className="tnum text-[24px] text-ink">71%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-flame" style={{ width: "71%" }} />
            </div>
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-ink-soft">Human-approved</span>
              <span className="tnum text-[24px] text-ink">29%</span>
            </div>
          </div>
        </Cell>

        {/* evidence reuse */}
        <Cell label="Evidence reuse" sub="Answered from memory" className="col-span-1">
          <div className="flex items-end justify-between gap-3">
            <span className="tnum font-medium text-[30px] leading-none text-ink">
              +<CountUp value={65.4} suffix="%" />
            </span>
            <div className="flex items-end gap-1.5">
              <div className="flex flex-col items-center gap-1">
                <div className="h-7 w-4 rounded-sm bg-ink/15" />
                <span className="font-mono text-[9px] text-ink/40">FEB</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="h-12 w-4 rounded-sm bg-flame" />
                <span className="font-mono text-[9px] text-ink/40">MAR</span>
              </div>
            </div>
          </div>
        </Cell>

        {/* workflows covered */}
        <Cell label="Workflows covered" sub="Quarter over quarter" className="col-span-1">
          <div className="flex items-end justify-between">
            <span className="tnum font-medium text-[30px] leading-none text-ink">
              +<CountUp value={247} suffix="%" />
            </span>
            <div className="w-16">
              <Spark />
            </div>
          </div>
        </Cell>

        {/* eval pass rate */}
        <Cell label="Eval pass rate" sub="Checked before any writeback" className="col-span-2 md:col-span-2">
          <div className="flex items-center gap-3">
            <span className="tnum font-medium text-[30px] leading-none text-ink">
              <CountUp value={96} suffix="%" />
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full rounded-full bg-ink/70" style={{ width: "96%" }} />
            </div>
          </div>
        </Cell>
      </Reveal>
    </Panel>
  );
}
