"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";

gsap.registerPlugin(ScrollTrigger);

const CARDS = [
  { n: "001", title: "Data minimization", body: "Quad sends the smallest verified evidence packet, never your whole company brain.", shape: "octa" as const },
  { n: "002", title: "Tenant isolation", body: "Every customer's context is isolated, encrypted, and access-scoped by default.", shape: "sphere" as const },
  { n: "003", title: "Proof on every call", body: "A receipt shows exactly what context each model call used, and why.", shape: "hex" as const },
  { n: "004", title: "You own the data", body: "Permission-aware retrieval, redaction, and tenant-scoped retention and deletion.", shape: "pyramid" as const },
];

function ShapeIcon({ kind }: { kind: "octa" | "sphere" | "hex" | "pyramid" }) {
  const ref = useRef<SVGSVGElement>(null);
  const s = "rgba(250,251,246,0.92)";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      const draws = gsap.utils.toArray<SVGGeometryElement>("[data-draw]");
      draws.forEach((d) => {
        const len = d.getTotalLength();
        d.style.strokeDasharray = `${len}`;
        d.style.strokeDashoffset = `${len}`;
      });
      gsap.set("[data-fill]", { opacity: 0 });
      if (reduce) {
        gsap.set(draws, { strokeDashoffset: 0 });
        gsap.set("[data-fill]", { opacity: 1 });
        return;
      }
      gsap.timeline({ scrollTrigger: { trigger: el, start: "top 84%", once: true } })
        .to(draws, { strokeDashoffset: 0, duration: 1.0, ease: "power2.inOut", stagger: 0.12 })
        .to("[data-fill]", { opacity: 1, duration: 0.5, ease: "power2.out" }, "-=0.4");
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <svg ref={ref} viewBox="0 0 200 150" className="h-full w-full" fill="none" stroke={s}>
      {kind === "octa" && (
        <g strokeWidth="1.1" opacity="0.85">
          <path data-draw d="M100 26 L148 75 L100 124 L52 75 Z" />
          <path data-draw d="M52 75 L100 58 L148 75" />
          <path data-draw d="M52 75 L100 92 L148 75" />
          <circle data-fill cx="100" cy="75" r="2.4" fill={s} stroke="none" />
        </g>
      )}
      {kind === "sphere" && (
        <g strokeWidth="1.1" opacity="0.85">
          <circle data-draw cx="100" cy="75" r="46" />
          <ellipse data-draw cx="100" cy="75" rx="46" ry="15" />
          <ellipse data-draw cx="100" cy="75" rx="15" ry="46" />
          <circle data-fill cx="84" cy="60" r="2.4" fill={s} stroke="none" />
        </g>
      )}
      {kind === "hex" && (
        <g strokeWidth="1.1" opacity="0.85">
          <path data-draw d="M58 58 L79 44 L121 44 L142 58 L121 72 L79 72 Z" />
          <path data-draw d="M58 58 L58 86" />
          <path data-draw d="M79 72 L79 100" />
          <path data-draw d="M121 72 L121 100" />
          <path data-draw d="M142 58 L142 86" />
          <path data-draw d="M58 86 L79 100 L121 100 L142 86" />
          <ellipse data-draw cx="100" cy="58" rx="16" ry="8" />
        </g>
      )}
      {kind === "pyramid" && (
        <g strokeWidth="1.1" opacity="0.85">
          <path data-draw d="M54 100 L100 80 L146 100 L100 120 Z" />
          <path data-draw d="M68 78 L100 64 L132 78 L100 92 Z" />
          <path data-draw d="M82 58 L100 50 L118 58 L100 66 Z" />
          <circle data-fill cx="100" cy="38" r="2.4" fill={s} stroke="none" />
        </g>
      )}
    </svg>
  );
}

export default function Security() {
  return (
    <Panel
      id="security"
      label="Security"
      desc="Enterprise AI deals are blocked by data security before model quality. Quad is built for the security review, not around it."
      title="Send less. Prove everything."
    >
      <Reveal
        stagger
        className="mt-9 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-white/[0.1] bg-white/[0.08] sm:grid-cols-2 lg:grid-cols-4"
      >
        {CARDS.map((c) => (
          <div key={c.n} className="relative flex flex-col bg-ink px-6 py-7">
            <span
              className="absolute left-1/2 top-0 h-2.5 w-4 -translate-x-1/2 bg-bone/80"
              style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
            />
            <div className="flex items-start justify-between">
              <h3 className="text-[18px] font-normal text-bone">{c.title}</h3>
              <span className="font-mono text-[12px] text-tan/40">{c.n}</span>
            </div>
            <div
              className="relative mt-6 aspect-[4/3] w-full"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 7px)",
              }}
            >
              {[
                "left-0 top-0 border-l border-t",
                "right-0 top-0 border-r border-t",
                "left-0 bottom-0 border-l border-b",
                "right-0 bottom-0 border-r border-b",
              ].map((p) => (
                <span key={p} className={`pointer-events-none absolute h-3 w-3 border-white/30 ${p}`} />
              ))}
              <div className="absolute inset-0 grid place-items-center p-6">
                <ShapeIcon kind={c.shape} />
              </div>
            </div>
            <p className="mt-6 text-[13px] leading-relaxed text-tan/65">{c.body}</p>
          </div>
        ))}
      </Reveal>
    </Panel>
  );
}
