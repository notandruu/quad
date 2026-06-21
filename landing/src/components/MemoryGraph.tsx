"use client";

import { useEffect, useRef } from "react";

/**
 * Force-directed company-brain graph (Obsidian graph-view style).
 * Nodes start collapsed at the hub and self-organize via repulsion + edge
 * springs + center gravity, then idle with gentle drift. Hover a node to
 * highlight it and its neighbors.
 */

type Node = { label: string; type: "hub" | "anchor" | "leaf"; group: number };

const NODES: Node[] = [
  { label: "Company brain", type: "hub", group: 0 }, // 0
  { label: "Security", type: "anchor", group: 1 }, // 1
  { label: "Support", type: "anchor", group: 2 }, // 2
  { label: "Code", type: "anchor", group: 3 }, // 3
  { label: "Docs", type: "anchor", group: 4 }, // 4
  { label: "Sales", type: "anchor", group: 5 }, // 5
  { label: "SOC 2", type: "leaf", group: 1 },
  { label: "MFA", type: "leaf", group: 1 },
  { label: "Encryption", type: "leaf", group: 1 },
  { label: "Access reviews", type: "leaf", group: 1 },
  { label: "Tickets", type: "leaf", group: 2 },
  { label: "Macros", type: "leaf", group: 2 },
  { label: "SLAs", type: "leaf", group: 2 },
  { label: "Repos", type: "leaf", group: 3 },
  { label: "PRs", type: "leaf", group: 3 },
  { label: "Infra", type: "leaf", group: 3 },
  { label: "Policies", type: "leaf", group: 4 },
  { label: "Runbooks", type: "leaf", group: 4 },
  { label: "Wiki", type: "leaf", group: 4 },
  { label: "RFPs", type: "leaf", group: 5 },
  { label: "Trust center", type: "leaf", group: 5 },
  { label: "Prior Q&A", type: "leaf", group: 5 },
];

type Edge = { a: number; b: number; l: number };
const EDGES: Edge[] = [
  { a: 0, b: 1, l: 120 }, { a: 0, b: 2, l: 120 }, { a: 0, b: 3, l: 120 }, { a: 0, b: 4, l: 120 }, { a: 0, b: 5, l: 120 },
  { a: 1, b: 6, l: 60 }, { a: 1, b: 7, l: 60 }, { a: 1, b: 8, l: 60 }, { a: 1, b: 9, l: 60 },
  { a: 2, b: 10, l: 60 }, { a: 2, b: 11, l: 60 }, { a: 2, b: 12, l: 60 },
  { a: 3, b: 13, l: 60 }, { a: 3, b: 14, l: 60 }, { a: 3, b: 15, l: 60 },
  { a: 4, b: 16, l: 60 }, { a: 4, b: 17, l: 60 }, { a: 4, b: 18, l: 60 },
  { a: 5, b: 19, l: 60 }, { a: 5, b: 20, l: 60 }, { a: 5, b: 21, l: 60 },
  { a: 1, b: 3, l: 150 }, { a: 4, b: 2, l: 150 }, { a: 5, b: 4, l: 150 }, { a: 8, b: 15, l: 150 },
];

const W = 660;
const H = 440;
const CX = W / 2;
const CY = H / 2;

function radius(t: Node["type"]) {
  return t === "hub" ? 22 : t === "anchor" ? 9 : 5.5;
}

export default function MemoryGraph({ className = "" }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const nodeEls = NODES.map((_, i) => svg.querySelector<SVGGElement>(`[data-node="${i}"]`));
    const edgeEls = EDGES.map((_, i) => svg.querySelector<SVGLineElement>(`[data-edge="${i}"]`));

    // neighbor map for hover highlight
    const nbr: number[][] = NODES.map(() => []);
    EDGES.forEach((e) => { nbr[e.a].push(e.b); nbr[e.b].push(e.a); });

    // start collapsed near the hub with a tiny deterministic offset
    const P = NODES.map((_, i) => ({
      x: CX + ((i * 37) % 13) - 6,
      y: CY + ((i * 53) % 13) - 6,
      vx: 0,
      vy: 0,
    }));

    let hovered = -1;
    const setHover = (i: number) => () => (hovered = i);
    const clearHover = () => (hovered = -1);
    nodeEls.forEach((el, i) => {
      el?.addEventListener("mouseenter", setHover(i));
      el?.addEventListener("mouseleave", clearHover);
    });

    const step = () => {
      const REP = 1500;
      const SPRING = 0.045;
      const GRAV = 0.006;
      const DAMP = 0.86;
      for (let i = 0; i < P.length; i++) {
        let fx = (CX - P[i].x) * GRAV;
        let fy = (CY - P[i].y) * GRAV;
        for (let j = 0; j < P.length; j++) {
          if (i === j) continue;
          const dx = P[i].x - P[j].x;
          const dy = P[i].y - P[j].y;
          const d2 = dx * dx + dy * dy + 0.01;
          const f = REP / d2;
          fx += (dx / Math.sqrt(d2)) * f;
          fy += (dy / Math.sqrt(d2)) * f;
        }
        P[i].vx = (P[i].vx + fx) * DAMP;
        P[i].vy = (P[i].vy + fy) * DAMP;
      }
      for (const e of EDGES) {
        const dx = P[e.b].x - P[e.a].x;
        const dy = P[e.b].y - P[e.a].y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const diff = ((d - e.l) / d) * SPRING;
        P[e.a].vx += dx * diff; P[e.a].vy += dy * diff;
        P[e.b].vx -= dx * diff; P[e.b].vy -= dy * diff;
      }
      for (let i = 0; i < P.length; i++) {
        if (i === 0) { P[i].x = CX; P[i].y = CY; P[i].vx = 0; P[i].vy = 0; continue; }
        P[i].x = Math.max(16, Math.min(W - 16, P[i].x + P[i].vx));
        P[i].y = Math.max(16, Math.min(H - 16, P[i].y + P[i].vy));
      }
    };

    const draw = () => {
      const active = hovered >= 0;
      const lit = (i: number) => !active || i === hovered || nbr[hovered].includes(i);
      nodeEls.forEach((el, i) => {
        if (!el) return;
        el.setAttribute("transform", `translate(${P[i].x.toFixed(1)} ${P[i].y.toFixed(1)})`);
        el.style.opacity = lit(i) ? "1" : "0.18";
      });
      edgeEls.forEach((el, i) => {
        if (!el) return;
        const e = EDGES[i];
        el.setAttribute("x1", P[e.a].x.toFixed(1));
        el.setAttribute("y1", P[e.a].y.toFixed(1));
        el.setAttribute("x2", P[e.b].x.toFixed(1));
        el.setAttribute("y2", P[e.b].y.toFixed(1));
        const on = !active || e.a === hovered || e.b === hovered;
        el.style.opacity = on ? "1" : "0.08";
      });
    };

    if (reduce) {
      for (let k = 0; k < 400; k++) step();
      draw();
      return;
    }

    let raf = 0;
    let frame = 0;
    const loop = () => {
      step();
      // tiny perpetual drift so it stays alive after settling
      if (frame > 200) for (let i = 1; i < P.length; i++) {
        P[i].vx += Math.sin(frame * 0.01 + i) * 0.06;
        P[i].vy += Math.cos(frame * 0.013 + i) * 0.06;
      }
      draw();
      frame++;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      nodeEls.forEach((el, i) => {
        el?.removeEventListener("mouseenter", setHover(i));
        el?.removeEventListener("mouseleave", clearHover);
      });
    };
  }, []);

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className={className} fill="none">
      {EDGES.map((_, i) => (
        <line key={i} data-edge={i} x1={CX} y1={CY} x2={CX} y2={CY} stroke="rgba(255,182,214,0.2)" strokeWidth={1} />
      ))}
      {NODES.map((n, i) => {
        const r = radius(n.type);
        return (
          <g key={i} data-node={i} transform={`translate(${CX} ${CY})`} style={{ cursor: "pointer" }}>
            {n.type === "hub" && <circle r={r + 12} fill="#FF5CAB" opacity={0.12} />}
            <circle
              r={r}
              fill={n.type === "hub" ? "#FF5CAB" : "#1c1c1c"}
              stroke={n.type === "hub" ? "#FF5CAB" : "rgba(255,182,214,0.6)"}
              strokeWidth={n.type === "hub" ? 0 : 1.3}
            />
            {n.type === "hub" && (
              <text textAnchor="middle" y={4} fontSize="11" fontWeight="600" fill="#111111" fontFamily="var(--font-geist), sans-serif">
                brain
              </text>
            )}
            {n.type === "anchor" && (
              <text textAnchor="middle" y={r + 14} fontSize="11" fill="rgba(243,239,243,0.85)" fontFamily="var(--font-mono), monospace">
                {n.label}
              </text>
            )}
            {n.type === "leaf" && (
              <text textAnchor="middle" y={r + 12} fontSize="9.5" fill="rgba(243,239,243,0.5)" fontFamily="var(--font-mono), monospace">
                {n.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
