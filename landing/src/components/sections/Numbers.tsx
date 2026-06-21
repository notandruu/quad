"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";
import { CountUp } from "@/components/ui";

gsap.registerPlugin(ScrollTrigger);

function Verified({ by }: { by: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] text-ink/55">
      <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-flame">
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6.4 5 8.9 9.5 3.4" />
        </svg>
      </span>
      {by}
    </span>
  );
}

const WEEK = [6, 9, 7, 10, 13, 8, 5];
const PEAK = 4;

function AreaChart() {
  const ref = useRef<SVGSVGElement>(null);
  const W = 460;
  const H = 150;
  const P = 10;
  const max = Math.max(...WEEK);
  const step = (W - P * 2) / (WEEK.length - 1);
  const pts = WEEK.map(
    (v, i) => [P + i * step, H - P - (v / max) * (H - P * 2.4)] as const,
  );
  const line = pts
    .map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${H} L ${pts[0][0].toFixed(1)} ${H} Z`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const lineEl = el.querySelector<SVGPathElement>("[data-line]");
      const len = lineEl?.getTotalLength() ?? 0;
      if (lineEl) {
        lineEl.style.strokeDasharray = `${len}`;
        lineEl.style.strokeDashoffset = `${len}`;
      }
      gsap.set("[data-area]", { opacity: 0 });
      gsap.set("[data-dot]", { scale: 0, transformOrigin: "center" });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top 85%", once: true },
      });
      tl.to(lineEl, { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut" })
        .to("[data-area]", { opacity: 1, duration: 0.6, ease: "power1.out" }, "-=0.6")
        .to("[data-dot]", { scale: 1, duration: 0.4, ease: "back.out(2)", stagger: 0.05 }, "-=0.7");
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="mt-6 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="proofArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF5CAB" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#FF5CAB" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* hairline baseline */}
      <line x1="0" y1={H - P} x2={W} y2={H - P} stroke="rgba(17,17,17,0.1)" strokeWidth="1" />
      <path data-area d={area} fill="url(#proofArea)" />
      <path data-line d={line} fill="none" stroke="#FF5CAB" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i} data-dot>
          {i === PEAK && <circle cx={p[0]} cy={p[1]} r="9" fill="#FF5CAB" opacity="0.18" />}
          <circle cx={p[0]} cy={p[1]} r={i === PEAK ? 4 : 2.6} fill="#FF5CAB" />
        </g>
      ))}
    </svg>
  );
}

const METRICS = [
  { v: 98, suffix: "%", prefix: "", label: "Grounded answers", by: "every answer traced to a source" },
  { v: 96, suffix: "%", prefix: "", label: "Eval pass rate", by: "checked before any writeback" },
  { v: 65.4, suffix: "%", prefix: "+", label: "Evidence reuse", by: "answered from verified memory" },
];

export default function Numbers() {
  return (
    <Panel
      id="numbers"
      label="Proof"
      desc="Every number here is backed by evidence Quad collected and validated during real runs. No vibes, receipts."
      title="The work, with receipts."
    >
      <div className="mt-9 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-ink/12 bg-ink/12 lg:grid-cols-[1.45fr_1fr]">
        {/* feature chart */}
        <Reveal className="bg-paper p-7 md:p-9">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-ink/55">
              Questions answered / week
            </span>
            <Verified by="41 sources cited" />
          </div>
          <div className="mt-3 tnum font-medium leading-none text-ink" style={{ fontSize: "clamp(46px, 6vw, 66px)" }}>
            <CountUp value={1231} />
          </div>
          <AreaChart />
        </Reveal>

        {/* hairline-divided figure stack */}
        <div className="flex flex-col bg-paper">
          {METRICS.map((m) => (
            <div
              key={m.label}
              className="flex flex-1 flex-col justify-center gap-3 border-t border-ink/10 p-7 first:border-t-0 md:px-9"
            >
              <div className="flex items-end justify-between gap-4">
                <span className="text-[13px] text-ink-soft">{m.label}</span>
                <span className="tnum text-[40px] font-medium leading-none text-ink">
                  {m.prefix}
                  <CountUp value={m.v} suffix={m.suffix} />
                </span>
              </div>
              <Verified by={m.by} />
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
