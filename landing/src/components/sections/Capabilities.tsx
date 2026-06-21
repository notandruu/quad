"use client";

import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";
import MemoryGraph from "@/components/MemoryGraph";

const STEPS = [
  { n: "01", t: "Connect", b: "Plug into helpdesk, CRM, docs, and code." },
  { n: "02", t: "Collect", b: "Pull the exact evidence each task needs." },
  { n: "03", t: "Validate", b: "Score grounding before anything ships." },
  { n: "04", t: "Ship", b: "Execute through approval, then verify." },
];

export default function Capabilities() {
  return (
    <Panel
      id="capabilities"
      label="How it works"
      desc="Quad starts with sparse memory. As it works it collects evidence, validates it, and writes back only what it can prove."
      title="The brain is built during the work."
    >
      {/* company-brain memory graph */}
      <Reveal className="mt-9">
        <div className="overflow-hidden rounded-xl border border-ink/12 bg-ink">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-flame" />
              <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-bone">
                Company brain
              </span>
            </div>
            <span className="font-mono text-[11px] text-tan/55">8,600 verified memories</span>
          </div>
          <MemoryGraph className="h-auto w-full" />
        </div>
      </Reveal>

      {/* step pipeline */}
      <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink/10 bg-ink/10 lg:grid-cols-4">
        {STEPS.map((s) => (
          <div key={s.n} className="relative flex flex-col bg-paper p-6 transition-colors duration-200 hover:bg-cream">
            <span className="font-mono text-[12px] text-flame">{s.n}</span>
            <h3 className="mt-3 text-[16px] font-medium text-ink">{s.t}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{s.b}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
