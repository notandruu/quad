"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Data-minimization flow: the tenant holds all the data; only the smallest
 * verified evidence packet clears the policy/redaction gate and reaches the
 * model. Raw data bounces back at the gate (stays inside). A receipt records
 * exactly what crossed.
 */

const BRAIN = { x: 176, y: 175 };
const GATE = { x: 492, y: 175 };
const MODEL = { x: 700, y: 175 };

// data dots scattered inside the tenant (gentle float)
const DATA = Array.from({ length: 13 }).map((_, i) => {
  const a = (i / 13) * Math.PI * 2;
  const rad = 60 + (i % 3) * 26;
  return { x: BRAIN.x + Math.cos(a) * rad * 1.15, y: BRAIN.y + Math.sin(a) * rad * 0.7 };
});

export default function SecurityFlow({ className = "" }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      // gentle float on the data dots
      gsap.utils.toArray<SVGCircleElement>("[data-d]").forEach((d, i) => {
        if (reduce) return;
        gsap.to(d, { x: i % 2 ? 5 : -5, y: i % 3 ? -4 : 4, duration: 2.4 + (i % 4) * 0.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
      });

      if (reduce) {
        gsap.set("[data-ev]", { opacity: 1 });
        gsap.set("[data-blk]", { opacity: 0.5 });
        gsap.set("[data-receipt]", { opacity: 1 });
        return;
      }

      // play only while in view (pause off-screen)
      const start = {
        scrollTrigger: { trigger: el, start: "top 85%", end: "bottom 15%", toggleActions: "play pause resume pause" },
      };

      // verified evidence packets: brain -> gate (shrink) -> model
      gsap.utils.toArray<SVGCircleElement>("[data-ev]").forEach((p, i) => {
        gsap.set(p, { attr: { cx: BRAIN.x, cy: BRAIN.y, r: 4 }, opacity: 0 });
        const tl = gsap.timeline({ repeat: -1, delay: i * 1.0, repeatDelay: 1.2, ...start });
        tl.to(p, { opacity: 1, duration: 0.2 })
          .to(p, { attr: { cx: GATE.x, cy: GATE.y + (i % 2 ? -7 : 7) }, duration: 0.85, ease: "power1.in" })
          .to(p, { attr: { r: 2.4 }, duration: 0.15 })
          .to(p, { attr: { cx: MODEL.x, cy: MODEL.y }, duration: 0.85, ease: "power1.out" })
          .to(p, { opacity: 0, duration: 0.25 });
      });

      // raw data: inside -> gate -> bounces back (blocked, stays in tenant)
      gsap.utils.toArray<SVGCircleElement>("[data-blk]").forEach((p, i) => {
        const home = DATA[i % DATA.length];
        gsap.set(p, { attr: { cx: home.x, cy: home.y, r: 3 }, opacity: 0 });
        const tl = gsap.timeline({ repeat: -1, delay: 0.4 + i * 0.7, repeatDelay: 0.8, ...start });
        tl.to(p, { opacity: 0.8, duration: 0.2 })
          .to(p, { attr: { cx: GATE.x - 26, cy: GATE.y + (i % 2 ? 14 : -14) }, duration: 0.7, ease: "power1.inOut" })
          .to(p, { attr: { cx: home.x, cy: home.y }, duration: 0.8, ease: "power2.out" })
          .to(p, { opacity: 0, duration: 0.2 });
      });

      // gate pulse + receipt breathing
      gsap.to("[data-gate]", { scale: 1.08, transformOrigin: "center", transformBox: "fill-box", duration: 1.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.fromTo("[data-receipt]", { opacity: 0.4 }, { opacity: 1, duration: 1.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
    }, el);
    return () => ctx.revert();
  }, []);

  const pink = "rgba(255,182,214,";
  return (
    <svg ref={ref} viewBox="0 0 780 350" className={className} fill="none">
      {/* tenant boundary */}
      <rect x="22" y="40" width="476" height="270" rx="18" stroke={`${pink}0.35)`} strokeWidth="1.4" strokeDasharray="5 6" />
      <text x="40" y="64" fill={`${pink}0.7)`} fontSize="12" fontFamily="var(--font-mono), monospace" letterSpacing="0.5">
        inside your tenant
      </text>

      {/* connecting rails */}
      <line x1={BRAIN.x + 26} y1={BRAIN.y} x2={GATE.x} y2={GATE.y} stroke={`${pink}0.18)`} strokeWidth="1" />
      <line x1={GATE.x} y1={GATE.y} x2={MODEL.x - 20} y2={MODEL.y} stroke={`${pink}0.18)`} strokeWidth="1" />

      {/* data dots inside */}
      {DATA.map((d, i) => (
        <circle key={i} data-d cx={d.x} cy={d.y} r="3" fill={`${pink}0.45)`} />
      ))}

      {/* brain */}
      <circle cx={BRAIN.x} cy={BRAIN.y} r="34" fill="#FF5CAB" opacity="0.12" />
      <circle cx={BRAIN.x} cy={BRAIN.y} r="24" fill="#FF5CAB" />
      <circle cx={BRAIN.x} cy={BRAIN.y} r="9" fill="#1a0b14" />
      <text x={BRAIN.x} y={BRAIN.y + 50} textAnchor="middle" fill="rgba(243,239,243,0.8)" fontSize="11" fontFamily="var(--font-mono), monospace">
        company brain
      </text>

      {/* moving particles */}
      {[0, 1, 2, 3].map((i) => <circle key={`e${i}`} data-ev r="4" fill="#FF5CAB" />)}
      {[0, 1, 2, 3, 4, 5].map((i) => <circle key={`b${i}`} data-blk r="3" fill="rgba(180,170,185,0.7)" />)}

      {/* gate */}
      <g data-gate>
        <path
          d={`M${GATE.x} ${GATE.y - 30} L${GATE.x + 22} ${GATE.y - 16} V${GATE.y + 14} C${GATE.x + 22} ${GATE.y + 28} ${GATE.x + 12} ${GATE.y + 36} ${GATE.x} ${GATE.y + 40} C${GATE.x - 12} ${GATE.y + 36} ${GATE.x - 22} ${GATE.y + 28} ${GATE.x - 22} ${GATE.y + 14} V${GATE.y - 16} Z`}
          fill="#161616"
          stroke="#FF5CAB"
          strokeWidth="1.4"
        />
        <path d={`M${GATE.x - 9} ${GATE.y + 2} l6 6 12 -14`} stroke="#FF5CAB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <text x={GATE.x} y={GATE.y - 42} textAnchor="middle" fill="rgba(243,239,243,0.8)" fontSize="11" fontFamily="var(--font-mono), monospace">
        policy + redaction
      </text>

      {/* model */}
      <circle cx={MODEL.x} cy={MODEL.y} r="22" fill="#1c1c1c" stroke={`${pink}0.6)`} strokeWidth="1.3" />
      <text x={MODEL.x} y={MODEL.y + 4} textAnchor="middle" fill="rgba(243,239,243,0.85)" fontSize="10" fontFamily="var(--font-mono), monospace">
        model
      </text>
      <text x={MODEL.x} y={MODEL.y + 44} textAnchor="middle" fill="rgba(243,239,243,0.4)" fontSize="10" fontFamily="var(--font-mono), monospace">
        outside tenant
      </text>

      {/* evidence label + receipt */}
      <text x="595" y="150" textAnchor="middle" fill={`${pink}0.7)`} fontSize="10.5" fontFamily="var(--font-mono), monospace">
        smallest verified packet
      </text>
      <g data-receipt>
        <text x={MODEL.x} y="252" textAnchor="middle" fill="#FF5CAB" fontSize="11" fontFamily="var(--font-mono), monospace">
          ✓ receipt qc_1f93a4
        </text>
      </g>
    </svg>
  );
}
