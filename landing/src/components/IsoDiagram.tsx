"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Isometric exploded-stack diagram (hero).
 * CONNECT octahedron · RESOLVE sphere · CONTROL holed hex · ANALYZE stepped
 * pyramid, on rounded diamond platforms, joined by a dotted spine + labels.
 */

const CX = 210;
const PW = 150;
const PH = 74;
const labelX = 372;
const LY = [165, 330, 486, 622];

const edge = "rgba(255,182,214,0.55)";
const faint = "rgba(255,182,214,0.14)";
const topFill = "rgba(250,251,246,0.13)";
const topFill2 = "rgba(250,251,246,0.07)";
const sideA = "#232321";
const sideB = "#161614";
const tan = "#FFB6D6";

const rhom = (cx: number, cy: number, w: number, h: number) =>
  `${cx},${cy - h} ${cx + w},${cy} ${cx},${cy + h} ${cx - w},${cy}`;

// rounded-corner rhombus path
function roundRhom(cx: number, cy: number, w: number, h: number, r = 0.12) {
  const pts: [number, number][] = [
    [cx, cy - h],
    [cx + w, cy],
    [cx, cy + h],
    [cx - w, cy],
  ];
  const lerp = (a: [number, number], b: [number, number], t: number): [number, number] => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ];
  let d = "";
  for (let i = 0; i < 4; i++) {
    const cur = pts[i],
      prev = pts[(i + 3) % 4],
      next = pts[(i + 1) % 4];
    const p1 = lerp(cur, prev, r),
      p2 = lerp(cur, next, r);
    d += i === 0 ? `M ${p1[0]},${p1[1]} ` : `L ${p1[0]},${p1[1]} `;
    d += `Q ${cur[0]},${cur[1]} ${p2[0]},${p2[1]} `;
  }
  return d + "Z";
}

export default function IsoDiagram({ className = "" }: { className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const labels = ["FIND", "GATHER", "VALIDATE", "SHIP"];

  useIso(() => {
    const el = ref.current;
    if (!el) return;

    // respect reduced-motion: render the diagram fully, no draw-on
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      const geom = Array.from(
        el.querySelectorAll<SVGGeometryElement>(
          "path, line, polygon, polyline, ellipse, circle, rect",
        ),
      );

      const draw: SVGGeometryElement[] = [];
      const fills: SVGGeometryElement[] = [];

      geom.forEach((s) => {
        const cs = getComputedStyle(s);
        const hasStroke =
          cs.stroke && cs.stroke !== "none" && parseFloat(cs.strokeWidth) > 0;
        const hasFill =
          cs.fill && cs.fill !== "none" && cs.fill !== "rgba(0, 0, 0, 0)";

        let len = 0;
        try {
          len = s.getTotalLength();
        } catch {
          len = 0;
        }

        if (hasStroke && len > 0) {
          s.style.strokeDasharray = `${len}`;
          s.style.strokeDashoffset = `${len}`;
          draw.push(s);
        }
        if (hasFill) {
          s.style.fillOpacity = "0";
          fills.push(s);
        }
      });

      // cascade top-to-bottom along the spine
      const byY = (a: SVGGeometryElement, b: SVGGeometryElement) => {
        try {
          return a.getBBox().y - b.getBBox().y;
        } catch {
          return 0;
        }
      };
      draw.sort(byY);
      fills.sort(byY);

      const texts = Array.from(el.querySelectorAll("text"));
      gsap.set(texts, { opacity: 0 });

      const tl = gsap.timeline({ delay: 0.2 });
      tl.to(draw, {
        strokeDashoffset: 0,
        duration: 1.05,
        ease: "power2.inOut",
        stagger: 0.022,
      });
      tl.to(
        fills,
        { fillOpacity: 1, duration: 0.55, ease: "power1.out", stagger: 0.012 },
        "-=0.6",
      );
      tl.to(
        texts,
        { opacity: 1, duration: 0.4, ease: "power1.out", stagger: 0.06 },
        "-=0.45",
      );
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <svg ref={ref} viewBox="0 0 482 740" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="sphere" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="rgba(250,251,246,0.22)" />
          <stop offset="45%" stopColor="#26241f" />
          <stop offset="100%" stopColor="#0c0b0a" />
        </radialGradient>
      </defs>

      {/* dotted spine */}
      <line x1={CX} y1={70} x2={CX} y2={712} stroke={edge} strokeWidth={1} strokeDasharray="2 5" />
      <circle cx={CX} cy={70} r={4} fill={tan} />
      <circle cx={CX} cy={712} r={4} fill={tan} />

      {/* rounded platforms */}
      {LY.map((cy) => (
        <path key={cy} d={roundRhom(CX, cy, PW, PH, 0.14)} fill="rgba(255,182,214,0.035)" stroke={faint} strokeWidth={1} />
      ))}

      {/* ── 1. CONNECT — balanced octahedron ── */}
      <g data-layer>
        {(() => {
          const cy = LY[0];
          const tw = 80, th = 44;
          const apexTop = cy - 56, apexBot = cy + 64;
          return (
            <>
              <polygon points={`${CX - tw},${cy} ${CX},${apexBot} ${CX + tw},${cy}`} fill={sideB} stroke={edge} />
              <polygon points={`${CX},${cy - th} ${CX + tw},${cy} ${CX},${apexBot}`} fill={sideA} stroke={edge} />
              <polygon points={`${CX - tw},${cy} ${CX},${apexTop} ${CX},${cy + th}`} fill={topFill2} stroke={edge} />
              <polygon points={`${CX + tw},${cy} ${CX},${apexTop} ${CX},${cy + th}`} fill={topFill} stroke={edge} />
              <polygon points={`${CX - tw},${cy} ${CX},${apexTop} ${CX + tw},${cy}`} fill={topFill} stroke={edge} />
            </>
          );
        })()}
      </g>

      {/* ── 2. RESOLVE — sphere ── */}
      <g data-layer>
        {(() => {
          const cy = LY[1];
          const r = 84;
          return (
            <>
              <ellipse cx={CX} cy={cy} rx={r * 1.32} ry={r * 0.62} fill="none" stroke={faint} strokeWidth={1.2} />
              <circle cx={CX} cy={cy} r={r} fill="url(#sphere)" stroke={edge} strokeWidth={1.1} />
              <ellipse cx={CX} cy={cy} rx={r} ry={r * 0.34} fill="none" stroke="rgba(255,182,214,0.22)" />
              <ellipse cx={CX} cy={cy} rx={28} ry={11} fill={topFill} stroke="rgba(255,182,214,0.3)" />
            </>
          );
        })()}
      </g>

      {/* ── 3. CONTROL — hex prism with hole ── */}
      <g data-layer>
        {(() => {
          const cy = LY[2] - 8;
          const r = 84, ry = 26, depth = 34;
          const pts = [
            [CX - r, cy],
            [CX - r / 2, cy - ry],
            [CX + r / 2, cy - ry],
            [CX + r, cy],
            [CX + r / 2, cy + ry],
            [CX - r / 2, cy + ry],
          ];
          const top = pts.map((p) => p.join(",")).join(" ");
          return (
            <>
              <polygon points={`${CX + r},${cy} ${CX + r / 2},${cy + ry} ${CX + r / 2},${cy + ry + depth} ${CX + r},${cy + depth}`} fill={sideA} stroke={edge} />
              <polygon points={`${CX - r / 2},${cy + ry} ${CX - r},${cy} ${CX - r},${cy + depth} ${CX - r / 2},${cy + ry + depth}`} fill={sideB} stroke={edge} />
              <polygon points={`${CX - r / 2},${cy + ry} ${CX + r / 2},${cy + ry} ${CX + r / 2},${cy + ry + depth} ${CX - r / 2},${cy + ry + depth}`} fill={sideA} stroke={edge} />
              <polygon points={top} fill={topFill} stroke={edge} />
              <ellipse cx={CX} cy={cy} rx={26} ry={11} fill={sideB} stroke={edge} />
            </>
          );
        })()}
      </g>

      {/* ── 4. ANALYZE — stepped pyramid ── */}
      <g data-layer>
        {[
          { w: 92, h: 46, dy: 0, d: 22 },
          { w: 62, h: 31, dy: -22, d: 18 },
          { w: 34, h: 17, dy: -40, d: 15 },
        ].map((s, i) => {
          const cy = LY[3] + 6 + s.dy;
          return (
            <g key={i}>
              <polygon points={`${CX + s.w},${cy} ${CX},${cy + s.h} ${CX},${cy + s.h + s.d} ${CX + s.w},${cy + s.d}`} fill={sideA} stroke={edge} />
              <polygon points={`${CX},${cy + s.h} ${CX - s.w},${cy} ${CX - s.w},${cy + s.d} ${CX},${cy + s.h + s.d}`} fill={sideB} stroke={edge} />
              <path d={roundRhom(CX, cy, s.w, s.h, 0.1)} fill={topFill} stroke={edge} />
            </g>
          );
        })}
      </g>

      {/* connector nodes + labels */}
      {LY.map((cy, i) => {
        const ny = cy;
        return (
          <g key={i} data-conn>
            <circle cx={CX} cy={ny} r={4} fill={tan} />
            <line x1={CX} y1={ny} x2={labelX - 10} y2={ny} stroke={edge} strokeWidth={1} />
            <circle cx={labelX - 6} cy={ny} r={3} fill={tan} />
            <text x={labelX + 4} y={ny + 4} fill={tan} fontSize={12} fontFamily="var(--font-mono), monospace" letterSpacing="1">
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
