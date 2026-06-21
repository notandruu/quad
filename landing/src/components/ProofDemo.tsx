"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const SOURCES = ["SOC 2 report · §4.1", "MFA policy v3", "Access review · Q1"];

/** A live "grounded answer": the answer cites its sources, a grounding meter
 *  fills, and a tamper-evident receipt stamps. Proof you can watch. */
export default function ProofDemo() {
  const root = useRef<HTMLDivElement>(null);
  const meter = useRef<HTMLDivElement>(null);
  const score = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const setScore = (v: number) => { if (score.current) score.current.textContent = v.toFixed(2); };
      if (reduce) {
        gsap.set("[data-answer],[data-chip],[data-receipt]", { opacity: 1, y: 0 });
        gsap.set("[data-check]", { scale: 1 });
        if (meter.current) meter.current.style.width = "96%";
        setScore(0.96);
        return;
      }
      gsap.set("[data-answer]", { opacity: 0, y: 10 });
      gsap.set("[data-chip]", { opacity: 0, y: 8 });
      gsap.set("[data-check]", { scale: 0, transformOrigin: "center" });
      gsap.set(meter.current, { width: "0%" });
      gsap.set("[data-receipt]", { opacity: 0, y: 8 });

      const c = { v: 0 };
      gsap.timeline({ scrollTrigger: { trigger: el, start: "top 78%", once: true } })
        .to("[data-answer]", { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" })
        .to("[data-chip]", { opacity: 1, y: 0, duration: 0.45, stagger: 0.2, ease: "power2.out" }, "-=0.15")
        .to("[data-check]", { scale: 1, duration: 0.32, stagger: 0.2, ease: "back.out(2.2)" }, "<")
        .to(meter.current, { width: "96%", duration: 1.1, ease: "power2.inOut" }, "-=0.25")
        .to(c, { v: 0.96, duration: 1.1, ease: "power2.inOut", onUpdate: () => setScore(c.v) }, "<")
        .to("[data-receipt]", { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, "-=0.25");
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="overflow-hidden rounded-xl border border-ink/12 bg-ink p-7 md:p-9">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-flame" />
          <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-bone">Verified answer</span>
        </div>
        <span className="font-mono text-[11px] text-tan/45">qc_1f93a4</span>
      </div>

      <p className="mt-7 font-mono text-[13px] text-tan/55">Q · Do you enforce MFA across the whole org?</p>
      <p data-answer className="mt-2 max-w-[40ch] text-[22px] font-normal leading-snug text-bone md:text-[26px]">
        Yes. MFA is enforced for every employee and contractor, no exceptions.
      </p>

      <div className="mt-7 flex flex-wrap gap-2.5">
        {SOURCES.map((s) => (
          <span key={s} data-chip className="flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 font-mono text-[12px] text-tan/80">
            <span data-check className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-flame">
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#160a11" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 6.4 5 8.9 9.5 3.4" />
              </svg>
            </span>
            {s}
          </span>
        ))}
      </div>

      <div className="mt-7 flex items-center gap-4">
        <span className="w-[88px] shrink-0 font-mono text-[12px] uppercase tracking-[0.06em] text-tan/55">Grounding</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
          <div ref={meter} className="h-full rounded-full bg-flame" style={{ width: "0%" }} />
        </div>
        <span className="tnum w-[44px] text-right text-[18px] font-medium text-bone">
          <span ref={score}>0.00</span>
        </span>
      </div>

      <div data-receipt className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.07] pt-5 font-mono text-[12px] text-tan/70">
        <span className="flex items-center gap-2 text-flame">
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-flame">
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#160a11" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2.5 6.4 5 8.9 9.5 3.4" />
            </svg>
          </span>
          Verified
        </span>
        <span>3 sources cited</span>
        <span>written back to memory</span>
        <span>replayable</span>
      </div>
    </div>
  );
}
