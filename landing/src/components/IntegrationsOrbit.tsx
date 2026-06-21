"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { QuadMark } from "@/components/Header";

gsap.registerPlugin(ScrollTrigger);

const CX = 380;
const CY = 268;

type Item = { name: string; ring: 0 | 1; angle: number };
const INNER = ["Slack", "GitHub", "Notion", "Salesforce", "Zendesk"];
const OUTER = ["Jira", "HubSpot", "Google Drive", "Linear", "Confluence", "Intercom", "AWS"];

const R = [148, 236];

const ITEMS: Item[] = [
  ...INNER.map((name, i) => ({ name, ring: 0 as const, angle: -90 + (360 / INNER.length) * i })),
  ...OUTER.map((name, i) => ({ name, ring: 1 as const, angle: -64 + (360 / OUTER.length) * i })),
];

function pos(ring: 0 | 1, angle: number) {
  const a = (angle * Math.PI) / 180;
  return {
    x: +(CX + R[ring] * Math.cos(a)).toFixed(2),
    y: +(CY + R[ring] * Math.sin(a)).toFixed(2),
  };
}

export default function IntegrationsOrbit({ className = "" }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const lines = gsap.utils.toArray<SVGLineElement>("[data-spoke]");
      lines.forEach((l) => {
        const len = l.getTotalLength();
        l.style.strokeDasharray = `${len}`;
        l.style.strokeDashoffset = `${len}`;
      });
      gsap.set("[data-onode]", { scale: 0, transformOrigin: "center", transformBox: "fill-box" } as gsap.TweenVars);
      gsap.set("[data-olabel]", { opacity: 0 });
      gsap.set("[data-opulse]", { opacity: 0 });

      if (reduce) {
        gsap.set(lines, { strokeDashoffset: 0 });
        gsap.set("[data-onode]", { scale: 1 });
        gsap.set("[data-olabel]", { opacity: 1 });
        return;
      }

      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 80%", once: true } });
      tl.to(lines, { strokeDashoffset: 0, duration: 0.8, ease: "power2.inOut", stagger: 0.03 })
        .to("[data-onode]", { scale: 1, duration: 0.55, ease: "back.out(2.2)", stagger: 0.04 }, "-=0.5")
        .to("[data-olabel]", { opacity: 1, duration: 0.4, stagger: 0.03 }, "-=0.35")
        .add(() => {
          // slow counter-rotating rings
          gsap.to("[data-ring='0']", { rotation: 360, transformOrigin: "center", svgOrigin: `${CX} ${CY}`, duration: 90, ease: "none", repeat: -1 });
          gsap.to("[data-ring='1']", { rotation: -360, transformOrigin: "center", svgOrigin: `${CX} ${CY}`, duration: 120, ease: "none", repeat: -1 });
          // center mark breathing halo
          gsap.to("[data-ohalo]", { scale: 1.16, opacity: 0.06, transformOrigin: "center", transformBox: "fill-box", duration: 2, ease: "sine.inOut", yoyo: true, repeat: -1 });
          // pulses travelling center -> node
          ITEMS.forEach((it, i) => {
            if (i % 2) return;
            const p = pos(it.ring, it.angle);
            const dot = el.querySelector<SVGCircleElement>(`[data-opulse="${i}"]`);
            if (!dot) return;
            gsap.set(dot, { opacity: 1 });
            gsap.fromTo(
              dot,
              { attr: { cx: CX, cy: CY } },
              { attr: { cx: p.x, cy: p.y }, duration: 1.8, ease: "power1.out", repeat: -1, delay: (i % 6) * 0.4, repeatDelay: 1.6 },
            );
          });
        });
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <svg ref={ref} viewBox="0 0 760 536" className={className} fill="none">
      {/* orbit rings */}
      <g data-ring="0">
        <circle cx={CX} cy={CY} r={R[0]} stroke="rgba(255,182,214,0.18)" strokeWidth="1" strokeDasharray="3 7" />
      </g>
      <g data-ring="1">
        <circle cx={CX} cy={CY} r={R[1]} stroke="rgba(255,182,214,0.13)" strokeWidth="1" strokeDasharray="3 7" />
      </g>

      {/* spokes */}
      {ITEMS.map((it, i) => {
        const p = pos(it.ring, it.angle);
        return <line key={`s${i}`} data-spoke x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="rgba(255,182,214,0.14)" strokeWidth="1" />;
      })}

      {/* pulses */}
      {ITEMS.map((_, i) => (i % 2 ? null : <circle key={`p${i}`} data-opulse={i} r={2.6} fill="#FF5CAB" />))}

      {/* nodes */}
      {ITEMS.map((it, i) => {
        const p = pos(it.ring, it.angle);
        const below = p.y < CY;
        return (
          <g key={`n${i}`}>
            <circle data-onode cx={p.x} cy={p.y} r={6} fill="#1c1c1c" stroke="rgba(255,182,214,0.6)" strokeWidth="1.3" />
            <text
              data-olabel
              x={p.x}
              y={below ? p.y - 13 : p.y + 20}
              textAnchor="middle"
              fontSize="11.5"
              fill="rgba(243,239,243,0.78)"
              fontFamily="var(--font-mono), monospace"
            >
              {it.name}
            </text>
          </g>
        );
      })}

      {/* center Quad mark */}
      <g>
        <circle data-ohalo cx={CX} cy={CY} r={46} fill="#FF5CAB" opacity={0.1} />
        <circle cx={CX} cy={CY} r={34} fill="#161616" stroke="rgba(255,182,214,0.4)" strokeWidth="1.2" />
        <g transform={`translate(${CX - 19}, ${CY - 19})`}>
          <QuadMark size={38} />
        </g>
      </g>
    </svg>
  );
}
