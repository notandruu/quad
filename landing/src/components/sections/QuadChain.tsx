"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";

gsap.registerPlugin(ScrollTrigger);

const RAW = 9000;
const COMPRESSED = 2283;
const PCT = (COMPRESSED / RAW) * 100; // ~25.37
const SAVED_PCT = ((RAW - COMPRESSED) / RAW) * 100; // 74.63

const COLS = ["eval surface", "raw tokens", "QuadChain", "saved / reduction", "preservation", "trust signal"];
const ROWS: string[][] = [
  ["single-context compression", "2,250", "1,383", "867 / 38.53%", "evidence 41/41 · concepts 38/38", "readiness 1.000"],
  ["4-agent routed workflow", "9,000", "2,283", "6,717 / 74.63%", "evidence 41/41 · concepts 38/38", "role packets verified"],
  ["actual scale ladder", "1,858,850", "605,450", "1,253,400 / 67.43%", "evidence 36/36 · role prompts 144/144", "24 routed prompts"],
  ["115k-token context", "115,038", "74,813", "40,225 / 34.97%", "evidence 12/12", "measured, not projected"],
  ["verified rehydration harness", "budget matched", "selective repair", "88.89% mean", "task score 0.939 · accepted 210/240", "fails unsafe packets"],
  ["proof-carrying handoff", "n/a", "certificate envelope", "raw onchain: 0 bytes", "handoff 4/4", "rejects 4/4 attacks"],
];

function CheckPink() {
  return (
    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-flame">
      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 6.4 5 8.9 9.5 3.4" />
      </svg>
    </span>
  );
}

function CompressionViz() {
  const root = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const tok = useRef<HTMLSpanElement>(null);
  const saved = useRef<HTMLSpanElement>(null);
  const cert = useRef<HTMLDivElement>(null);
  const ticks = [4, 8, 12, 16, 20, 24];

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const setText = (t: number, s: number) => {
        if (tok.current) tok.current.textContent = Math.round(t).toLocaleString("en-US");
        if (saved.current) saved.current.textContent = `${s.toFixed(2)}%`;
      };

      if (reduce) {
        gsap.set(fill.current, { width: `${PCT}%` });
        setText(COMPRESSED, SAVED_PCT);
        gsap.set(cert.current, { opacity: 1, y: 0 });
        return;
      }

      gsap.set(fill.current, { width: "100%" });
      gsap.set(cert.current, { opacity: 0, y: 10 });
      const c = { tok: RAW, saved: 0 };

      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 78%", once: true } });
      tl.to(fill.current, { width: `${PCT}%`, duration: 1.6, ease: "power3.inOut" }, 0)
        .to(c, { tok: COMPRESSED, saved: SAVED_PCT, duration: 1.6, ease: "power3.inOut", onUpdate: () => setText(c.tok, c.saved) }, 0)
        .to(cert.current, { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.25");
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="rounded-xl border border-ink/12 bg-ink p-6 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-tan/50">raw context</div>
          <div className="tnum mt-1 text-[24px] text-bone">
            9,000<span className="text-[14px] text-tan/60"> tokens</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-tan/50">QuadChain</div>
          <div className="tnum mt-1 text-[24px] text-flame">
            <span ref={tok}>9,000</span>
            <span className="text-[14px] text-tan/60"> tokens</span>
          </div>
        </div>
      </div>

      {/* compressing bar */}
      <div className="relative mt-5 h-12 w-full overflow-hidden rounded-md bg-white/[0.04]">
        <div
          ref={fill}
          className="absolute inset-y-0 left-0 rounded-md border-r-2 border-flame bg-flame/20"
          style={{ width: "100%" }}
        />
        {ticks.map((t, i) => (
          <span
            key={i}
            className="absolute top-1/2 h-5 w-[2px] -translate-y-1/2 bg-flame"
            style={{ left: `${t}%` }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-tan/55">
        <span>omitted ranges collapse, required evidence stays</span>
        <span>
          saved <span ref={saved} className="text-bone">0%</span>
        </span>
      </div>

      {/* certificate */}
      <div
        ref={cert}
        className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.07] pt-5 font-mono text-[12px] text-tan/70"
      >
        <span className="flex items-center gap-2">
          <CheckPink /> 41/41 evidence preserved
        </span>
        <span>38/38 concepts</span>
        <span>0 dropped</span>
        <span className="text-flame">cert qc_1f93a4</span>
      </div>
    </div>
  );
}

export default function QuadChain() {
  return (
    <Panel
      id="quadchain"
      label="QuadChain"
      desc="QuadChain is not summarization. It is compression with measurable downstream preservation and proof-carrying handoff verification."
      title="Compression you can audit."
    >
      <Reveal className="mt-9">
        <CompressionViz />
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
