"use client";

import { useEffect, useRef } from "react";

/**
 * 3D company-brain graph (Obsidian 3D-graph style). Memory nodes sit on a
 * sphere around a central hub, perspective-projected and auto-rotating, with
 * drag-to-spin. Depth fades size + opacity so it reads as a real orb.
 * Pure SVG + rAF (no canvas gradients) so it stays cheap.
 */

const LABELS = [
  "SOC 2", "MFA", "Encryption", "Access reviews", "Tickets", "Macros", "SLAs",
  "Repos", "PRs", "Infra", "Policies", "Runbooks", "Wiki", "RFPs",
  "Trust center", "Prior Q&A", "Roadmap", "Decisions", "Incidents", "Audits",
];

const W = 660;
const H = 440;
const CX = W / 2;
const CY = H / 2;
const R = 158;
const PERSP = 560;

// base positions: hub at center (index 0) + fibonacci sphere for the rest
type V = { x: number; y: number; z: number; hub: boolean; label: string };
const BASE: V[] = (() => {
  const out: V[] = [{ x: 0, y: 0, z: 0, hub: true, label: "brain" }];
  const n = LABELS.length;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * golden;
    out.push({ x: Math.cos(th) * rad * R, y: y * R, z: Math.sin(th) * rad * R, hub: false, label: LABELS[i] });
  }
  return out;
})();

// edges: hub spokes + a woven surface web
const EDGES: [number, number][] = (() => {
  const e: [number, number][] = [];
  const n = LABELS.length;
  for (let i = 1; i <= n; i++) {
    if (i % 3 === 1) e.push([0, i]); // hub spokes
    e.push([i, (i % n) + 1]); // ring to next
    if (i + 6 <= n) e.push([i, i + 6]); // cross weave
  }
  return e;
})();

export default function MemoryGraph({ className = "" }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const nodeEls = BASE.map((_, i) => svg.querySelector<SVGGElement>(`[data-node="${i}"]`));
    const edgeEls = EDGES.map((_, i) => svg.querySelector<SVGLineElement>(`[data-edge="${i}"]`));

    let angleY = 0.4;
    let tilt = 0.5;
    let dragging = false;
    let lx = 0, ly = 0;

    const onDown = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; svg.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      angleY += (e.clientX - lx) * 0.006;
      tilt = Math.max(-1.1, Math.min(1.1, tilt + (e.clientY - ly) * 0.006));
      lx = e.clientX; ly = e.clientY;
    };
    const onUp = () => { dragging = false; };
    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onUp);
    svg.addEventListener("pointerleave", onUp);

    const proj = (v: V) => {
      const ca = Math.cos(angleY), sa = Math.sin(angleY);
      let x = v.x * ca + v.z * sa;
      const z1 = -v.x * sa + v.z * ca;
      const ct = Math.cos(tilt), st = Math.sin(tilt);
      const y = v.y * ct - z1 * st;
      const z = v.y * st + z1 * ct;
      const s = PERSP / (PERSP + z);
      return { sx: CX + x * s, sy: CY + y * s, s, depth: (z + R) / (2 * R) };
    };

    const render = () => {
      const pts = BASE.map(proj);
      edgeEls.forEach((el, i) => {
        if (!el) return;
        const [a, b] = EDGES[i];
        el.setAttribute("x1", pts[a].sx.toFixed(1));
        el.setAttribute("y1", pts[a].sy.toFixed(1));
        el.setAttribute("x2", pts[b].sx.toFixed(1));
        el.setAttribute("y2", pts[b].sy.toFixed(1));
        el.style.opacity = (0.06 + ((pts[a].depth + pts[b].depth) / 2) * 0.26).toFixed(2);
      });
      nodeEls.forEach((el, i) => {
        if (!el) return;
        const p = pts[i];
        el.setAttribute("transform", `translate(${p.sx.toFixed(1)} ${p.sy.toFixed(1)}) scale(${p.s.toFixed(3)})`);
        el.style.opacity = BASE[i].hub ? "1" : (0.25 + p.depth * 0.75).toFixed(2);
        const lbl = el.querySelector<SVGTextElement>("text");
        if (lbl && !BASE[i].hub) lbl.style.opacity = Math.max(0, p.depth * 1.4 - 0.4).toFixed(2);
      });
    };

    if (reduce) { angleY = 0.6; tilt = 0.5; render(); return; }

    let raf = 0;
    const loop = () => {
      if (!dragging) angleY += 0.0034;
      render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      svg.removeEventListener("pointerdown", onDown);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onUp);
      svg.removeEventListener("pointerleave", onUp);
    };
  }, []);

  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className={className} fill="none" style={{ cursor: "grab", touchAction: "none" }}>
      {EDGES.map((_, i) => (
        <line key={i} data-edge={i} x1={CX} y1={CY} x2={CX} y2={CY} stroke="#FF5CAB" strokeWidth={1} style={{ opacity: 0.15 }} />
      ))}
      {BASE.map((v, i) => (
        <g key={i} data-node={i} transform={`translate(${CX} ${CY})`}>
          {v.hub && <circle r={26} fill="#FF5CAB" opacity={0.14} />}
          <circle
            r={v.hub ? 15 : 4.6}
            fill={v.hub ? "#FF5CAB" : "#1c1c1c"}
            stroke={v.hub ? "#FF5CAB" : "rgba(255,182,214,0.7)"}
            strokeWidth={v.hub ? 0 : 1.2}
          />
          {v.hub ? (
            <text textAnchor="middle" y={3.5} fontSize="9" fontWeight="600" fill="#111111" fontFamily="var(--font-geist), sans-serif">
              brain
            </text>
          ) : (
            <text textAnchor="middle" y={13} fontSize="9" fill="rgba(243,239,243,0.85)" fontFamily="var(--font-mono), monospace">
              {v.label}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
