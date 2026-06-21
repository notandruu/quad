"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";

gsap.registerPlugin(ScrollTrigger);

type Sev = "Critical" | "Warning" | "Info";
const SEV: Record<Sev, { chip: string; bar: string }> = {
  Critical: { chip: "text-flame border-flame/40 bg-flame/10", bar: "bg-flame" },
  Warning: { chip: "text-[#c98a2b] border-[#c98a2b]/40 bg-[#c98a2b]/10", bar: "bg-[#c98a2b]" },
  Info: { chip: "text-ink/55 border-ink/20 bg-ink/[0.04]", bar: "bg-ink/30" },
};

const GAPS: { claim: string; truth: string; src1: string; src2: string; kind: string; sev: Sev }[] = [
  { claim: "“SSO is available on all plans”", truth: "“SSO is Enterprise-only”", src1: "Marketing site / Features", src2: "Billing / Plan matrix", kind: "pricing mismatch", sev: "Critical" },
  { claim: "“SOC 2 Type I”", truth: "“SOC 2 Type II — Mar 2026”", src1: "Security page", src2: "Audit report v4", kind: "outdated cert", sev: "Critical" },
  { claim: "“Data stored in the US only”", truth: "“EU region available”", src1: "Trust center", src2: "Infra config / regions", kind: "stale claim", sev: "Warning" },
  { claim: "“24/7 support for all customers”", truth: "“Business hours, Mon–Fri”", src1: "Homepage", src2: "Support policy v2", kind: "support hours", sev: "Warning" },
  { claim: "“99.9% uptime”", truth: "“99.95% over last 90 days”", src1: "Sales deck", src2: "Status page", kind: "understated", sev: "Info" },
];

function Gauge() {
  const arc = useRef<SVGCircleElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  const R = 27;
  const C = 2 * Math.PI * R;
  const target = 78;

  useEffect(() => {
    const el = arc.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      gsap.set(el, { strokeDasharray: C, strokeDashoffset: reduce ? C * (1 - target / 100) : C });
      if (num.current) num.current.textContent = reduce ? String(target) : "0";
      if (reduce) return;
      const c = { v: 0 };
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 90%", once: true } });
      tl.to(el, { strokeDashoffset: C * (1 - target / 100), duration: 1.3, ease: "power3.out" }, 0)
        .to(c, { v: target, duration: 1.3, ease: "power3.out", onUpdate: () => { if (num.current) num.current.textContent = String(Math.round(c.v)); } }, 0);
    });
    return () => ctx.revert();
  }, [C]);

  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(17,17,17,0.1)" strokeWidth="5" />
        <circle ref={arc} cx="32" cy="32" r={R} fill="none" stroke="#FF5CAB" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span ref={num} className="tnum text-[20px] font-medium leading-none text-ink">0</span>
        <span className="font-mono text-[8px] text-ink/40">/ 100</span>
      </div>
    </div>
  );
}

export default function TrustGaps() {
  return (
    <Panel
      id="trustgaps"
      label="Trust gaps"
      desc="One pass compares every public claim against your internal source of truth, and shows the exact page that caused each gap."
      title="See where trust breaks."
    >
      <Reveal className="mt-9 overflow-hidden rounded-xl border border-ink/12 bg-paper">
        {/* scan header with gauge */}
        <div className="flex items-center justify-between gap-6 border-b border-ink/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-flame" />
            <span className="font-mono text-[13px] text-ink">quad.dev</span>
            <span className="hidden font-mono text-[12px] text-ink/45 sm:inline">184 pages scanned · 5 gaps found</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-ink/45">Trust score</span>
            <Gauge />
          </div>
        </div>

        {/* findings */}
        <div>
          {GAPS.map((g) => (
            <div key={g.claim} className="flex items-stretch gap-4 border-t border-ink/8 px-6 py-5 transition-colors hover:bg-cream">
              <span className={`w-1 shrink-0 rounded-full ${SEV[g.sev].bar}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[15px]">
                  <span className="text-ink/45 line-through decoration-flame/60">{g.claim}</span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-ink/35">verified</span>
                  <span className="text-ink">{g.truth}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink/40">
                  <span>{g.src1}</span>
                  <span>·</span>
                  <span>{g.src2}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end justify-center gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] ${SEV[g.sev].chip}`}>
                  {g.sev}
                </span>
                <span className="hidden font-mono text-[11px] lowercase text-ink/40 md:block">{g.kind}</span>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </Panel>
  );
}
