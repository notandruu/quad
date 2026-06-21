"use client";

import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";
import { CountUp } from "@/components/ui";

const STATS = [
  { v: <CountUp value={74.63} suffix="%" />, l: "4-agent token reduction" },
  { v: "41/41", l: "evidence preserved" },
  { v: <CountUp value={100} suffix="%" />, l: "adversarial rejection" },
  { v: "0", l: "raw context bytes onchain" },
];

const COLS = ["eval surface", "raw tokens", "QuadChain", "saved / reduction", "preservation", "trust signal"];

const ROWS: string[][] = [
  ["single-context compression", "2,250", "1,383", "867 / 38.53%", "evidence 41/41 · concepts 38/38", "readiness 1.000"],
  ["4-agent routed workflow", "9,000", "2,283", "6,717 / 74.63%", "evidence 41/41 · concepts 38/38", "role packets verified"],
  ["actual scale ladder", "1,858,850", "605,450", "1,253,400 / 67.43%", "evidence 36/36 · role prompts 144/144", "24 routed prompts"],
  ["115k-token context", "115,038", "74,813", "40,225 / 34.97%", "evidence 12/12", "measured, not projected"],
  ["verified rehydration harness", "budget matched", "selective repair", "88.89% mean", "task score 0.939 · accepted 210/240", "fails unsafe packets"],
  ["proof-carrying handoff", "n/a", "certificate envelope", "raw onchain: 0 bytes", "handoff 4/4", "rejects 4/4 attacks"],
];

export default function QuadChain() {
  return (
    <Panel
      id="quadchain"
      label="QuadChain"
      desc="QuadChain is not summarization. It is compression with measurable downstream preservation and proof-carrying handoff verification."
      title="Compression you can audit."
    >
      {/* headline stats */}
      <Reveal stagger className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-ink/12 bg-ink/12 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <div key={i} className="bg-paper p-6">
            <div className="tnum font-medium text-[40px] leading-none text-ink">{s.v}</div>
            <div className="mt-2 font-mono text-[12px] lowercase tracking-[0.02em] text-ink-soft">{s.l}</div>
          </div>
        ))}
      </Reveal>

      {/* eval table */}
      <Reveal className="mt-6 overflow-hidden rounded-xl border border-ink/12">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left">
            <thead>
              <tr className="bg-ink text-bone">
                {COLS.map((c) => (
                  <th key={c} className="px-5 py-3.5 font-mono text-[12px] font-medium uppercase tracking-[0.04em]">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r, ri) => (
                <tr key={ri} className={ri % 2 ? "bg-mist" : "bg-paper"}>
                  {r.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`px-5 py-4 align-top text-[13px] ${
                        ci === 0
                          ? "font-medium text-ink"
                          : ci === 3
                            ? "font-mono text-flame-2"
                            : "text-ink-soft"
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Reveal>

      <p className="mt-4 font-mono text-[12px] text-ink/40">source: token-diet-results / quad-chain-eval.json</p>
    </Panel>
  );
}
