"use client";

import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";
import ProofDemo from "@/components/ProofDemo";
import { CountUp } from "@/components/ui";

const STATS = [
  { v: 98, suffix: "%", prefix: "", label: "Grounded answers" },
  { v: 96, suffix: "%", prefix: "", label: "Eval pass rate" },
  { v: 65.4, suffix: "%", prefix: "+", label: "Evidence reuse" },
];

export default function Numbers() {
  return (
    <Panel
      id="numbers"
      label="Proof"
      desc="Every answer Quad ships cites its evidence, passes an eval, and leaves a replayable receipt. No vibes, receipts."
      title="The work, with receipts."
    >
      <Reveal className="mt-9">
        <ProofDemo />
      </Reveal>

      <Reveal stagger className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-ink/12 bg-ink/12 sm:grid-cols-3">
        {STATS.map((s) => (
          <div key={s.label} className="flex items-center justify-between bg-paper p-6">
            <span className="text-[13px] text-ink-soft">{s.label}</span>
            <span className="tnum text-[30px] font-medium leading-none text-ink">
              {s.prefix}
              <CountUp value={s.v} suffix={s.suffix} />
            </span>
          </div>
        ))}
      </Reveal>
    </Panel>
  );
}
