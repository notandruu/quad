"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type N = { x: number; y: number; r: number; label: string; hub?: boolean };

const NODES: N[] = [
  { x: 330, y: 215, r: 34, label: "Company brain", hub: true },
  { x: 150, y: 95, r: 18, label: "SOC 2 v3.2" },
  { x: 470, y: 92, r: 16, label: "MFA policy" },
  { x: 565, y: 178, r: 17, label: "Encryption" },
  { x: 545, y: 300, r: 18, label: "Access reviews" },
  { x: 452, y: 366, r: 16, label: "Tickets" },
  { x: 250, y: 376, r: 17, label: "Repos" },
  { x: 118, y: 292, r: 18, label: "Policies" },
  { x: 72, y: 188, r: 15, label: "Uptime SLA" },
  { x: 322, y: 66, r: 17, label: "RFP answers" },
  { x: 602, y: 252, r: 14, label: "Data residency" },
  { x: 178, y: 366, r: 15, label: "Prior Q&A" },
];

const EDGES: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [0, 7], [0, 8], [0, 9], [0, 10], [0, 11],
  [1, 9], [3, 10], [3, 4], [4, 5], [6, 11], [7, 11], [7, 8], [2, 4],
];

// outer nodes whose edges carry a traveling pulse into the hub
const PULSE_FROM = [1, 4, 6, 9, 3, 7];

export default function MemoryGraph({ className = "" }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const edges = gsap.utils.toArray<SVGLineElement>("[data-edge]");
      edges.forEach((e) => {
        const len = e.getTotalLength();
        e.style.strokeDasharray = `${len}`;
        e.style.strokeDashoffset = `${len}`;
      });
      gsap.set("[data-node]", { scale: 0, transformOrigin: "center", transformBox: "fill-box" } as gsap.TweenVars);
      gsap.set("[data-label]", { opacity: 0 });
      gsap.set("[data-pulse]", { opacity: 0 });

      if (reduce) {
        gsap.set(edges, { strokeDashoffset: 0 });
        gsap.set("[data-node]", { scale: 1 });
        gsap.set("[data-label]", { opacity: 1 });
        return;
      }

      const tl = gsap.timeline({
        scrollTrigger: { trigger: el, start: "top 80%", once: true },
      });
      tl.to(edges, { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut", stagger: 0.03 })
        .to("[data-node]", { scale: 1, duration: 0.6, ease: "back.out(2)", stagger: 0.04 }, "-=0.6")
        .to("[data-label]", { opacity: 1, duration: 0.4, stagger: 0.03 }, "-=0.4")
        .add(() => startAmbient());

      function startAmbient() {
        // gentle float per node
        gsap.utils.toArray<SVGGElement>("[data-float]").forEach((g, i) => {
          gsap.to(g, {
            y: i % 2 ? 6 : -6,
            x: i % 3 ? -4 : 4,
            duration: 2.4 + (i % 5) * 0.4,
            ease: "sine.inOut",
            yoyo: true,
            repeat: -1,
          });
        });
        // hub halo pulse
        gsap.to("[data-halo]", { scale: 1.18, opacity: 0.05, transformOrigin: "center", transformBox: "fill-box", duration: 1.8, ease: "sine.inOut", yoyo: true, repeat: -1 });
        // data pulses travelling outer -> hub
        const hub = NODES[0];
        PULSE_FROM.forEach((ni, k) => {
          const from = NODES[ni];
          const dot = el!.querySelector<SVGCircleElement>(`[data-pulse="${k}"]`);
          if (!dot) return;
          gsap.set(dot, { opacity: 1 });
          gsap.fromTo(
            dot,
            { attr: { cx: from.x, cy: from.y } },
            {
              attr: { cx: hub.x, cy: hub.y },
              duration: 1.6,
              ease: "power1.in",
              repeat: -1,
              delay: k * 0.5,
              repeatDelay: 1.6,
            },
          );
        });
      }
    }, el);
    return () => ctx.revert();
  }, []);

  const edgeColor = "rgba(255,182,214,0.22)";

  return (
    <svg ref={ref} viewBox="0 0 660 430" className={className} fill="none">
      {/* edges */}
      {EDGES.map(([a, b], i) => (
        <line
          key={i}
          data-edge
          x1={NODES[a].x}
          y1={NODES[a].y}
          x2={NODES[b].x}
          y2={NODES[b].y}
          stroke={edgeColor}
          strokeWidth={1}
        />
      ))}

      {/* travelling data pulses */}
      {PULSE_FROM.map((_, k) => (
        <circle key={k} data-pulse={k} r={3} fill="#FF5CAB" />
      ))}

      {/* nodes */}
      {NODES.map((n, i) => (
        <g key={i} data-float>
          {n.hub && (
            <circle data-halo cx={n.x} cy={n.y} r={n.r + 12} fill="#FF5CAB" opacity={0.12} />
          )}
          <circle
            data-node
            cx={n.x}
            cy={n.y}
            r={n.r}
            fill={n.hub ? "#FF5CAB" : "#1c1c1c"}
            stroke={n.hub ? "#FF5CAB" : "rgba(255,182,214,0.5)"}
            strokeWidth={n.hub ? 0 : 1.2}
          />
          {n.hub && (
            <text data-label x={n.x} y={n.y + 4} textAnchor="middle" fontSize="12" fontWeight="600" fill="#111111" fontFamily="var(--font-geist), sans-serif">
              brain
            </text>
          )}
          {!n.hub && (
            <text
              data-label
              x={n.x}
              y={n.y + n.r + 13}
              textAnchor="middle"
              fontSize="11"
              fill="rgba(243,239,243,0.7)"
              fontFamily="var(--font-mono), monospace"
            >
              {n.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
