"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";

gsap.registerPlugin(ScrollTrigger);

const CARDS = [
  {
    n: "001",
    title: "Company Brain",
    body: "Durable, org-scoped memory that holds only verified facts, with the source behind each one.",
    icon: "brain" as const,
  },
  {
    n: "002",
    title: "Approval Gates",
    body: "Every write action runs through a tier. Sensitive steps wait for the right human.",
    icon: "gate" as const,
  },
  {
    n: "003",
    title: "QuadChain",
    body: "Proof-carrying compression. Every handoff ships with a tamper-evident receipt.",
    icon: "chain" as const,
  },
];

function FeatureIcon({ kind }: { kind: "brain" | "gate" | "chain" }) {
  const ref = useRef<SVGSVGElement>(null);
  const s = "#111111";

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
      gsap.set("[data-fill]", { scale: 0, transformOrigin: "center", transformBox: "fill-box" } as gsap.TweenVars);

      if (reduce) {
        gsap.set(draws, { strokeDashoffset: 0 });
        gsap.set("[data-fill]", { scale: 1 });
        return;
      }

      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top 84%", once: true } });
      tl.to(draws, { strokeDashoffset: 0, duration: 0.9, ease: "power2.inOut", stagger: 0.1 })
        .to("[data-fill]", { scale: 1, duration: 0.45, ease: "back.out(2)", stagger: 0.06 }, "-=0.5");
    }, el);
    return () => ctx.revert();
  }, []);

  return (
    <svg ref={ref} viewBox="0 0 200 150" className="h-full w-full" fill="none" stroke={s}>
      {kind === "brain" && (
        <g strokeWidth="1.4" opacity="0.9">
          {/* connections */}
          <line data-draw x1="100" y1="75" x2="60" y2="46" />
          <line data-draw x1="100" y1="75" x2="142" y2="48" />
          <line data-draw x1="100" y1="75" x2="150" y2="96" />
          <line data-draw x1="100" y1="75" x2="98" y2="116" />
          <line data-draw x1="100" y1="75" x2="52" y2="98" />
          <line data-draw x1="60" y1="46" x2="142" y2="48" />
          <line data-draw x1="52" y1="98" x2="98" y2="116" />
          <line data-draw x1="150" y1="96" x2="98" y2="116" />
          {/* hub */}
          <circle data-draw cx="100" cy="75" r="13" />
          {/* nodes */}
          {[[60, 46], [142, 48], [150, 96], [98, 116], [52, 98]].map(([x, y], i) => (
            <circle key={i} data-fill cx={x} cy={y} r="4.5" fill={s} stroke="none" />
          ))}
          <circle data-fill cx="100" cy="75" r="3.4" fill={s} stroke="none" />
        </g>
      )}

      {kind === "gate" && (
        <g strokeWidth="1.4" opacity="0.9">
          <path data-draw d="M100 26 L150 45 V84 C150 109 128 124 100 132 C72 124 50 109 50 84 V45 Z" />
          <path data-draw d="M50 70 H150" strokeOpacity="0.45" />
          <path data-draw d="M81 80 l13 13 27 -33" strokeWidth="1.7" />
          <circle data-fill cx="63" cy="58" r="2.6" fill={s} stroke="none" />
          <circle data-fill cx="137" cy="58" r="2.6" fill={s} stroke="none" />
        </g>
      )}

      {kind === "chain" && (
        <g strokeWidth="1.4" opacity="0.9">
          <rect data-draw x="30" y="58" width="54" height="34" rx="17" />
          <rect data-draw x="73" y="58" width="54" height="34" rx="17" />
          <rect data-draw x="116" y="58" width="54" height="34" rx="17" />
          {/* link joints */}
          <circle data-fill cx="78.5" cy="75" r="3" fill={s} stroke="none" />
          <circle data-fill cx="121.5" cy="75" r="3" fill={s} stroke="none" />
        </g>
      )}
    </svg>
  );
}

export default function Features() {
  return (
    <Panel
      id="features"
      label="Platform"
      desc="The same runtime underneath every workflow: verified memory, tiered approvals, and proof-carrying handoffs."
      title="The runtime underneath every AI employee"
    >
      <Reveal
        stagger
        className="mt-9 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-ink/15 bg-ink/15 md:grid-cols-3"
      >
        {CARDS.map((c) => (
          <div key={c.n} className="relative flex flex-col bg-paper px-6 py-7 transition-colors duration-200 hover:bg-cream/60">
            {/* top-center notch */}
            <span
              className="absolute left-1/2 top-0 h-2.5 w-4 -translate-x-1/2 bg-ink/85"
              style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
            />
            <div className="flex items-start justify-between">
              <h3 className="text-[20px] font-normal text-ink">{c.title}</h3>
              <span className="font-mono text-[12px] text-ink/35">{c.n}</span>
            </div>
            {/* line-art illustration on hatched ground, corner-bracketed */}
            <div
              className="relative mt-6 aspect-[4/3] w-full"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(135deg, rgba(74,72,68,0.13) 0 1px, transparent 1px 7px)",
              }}
            >
              {[
                "left-0 top-0 border-l border-t",
                "right-0 top-0 border-r border-t",
                "left-0 bottom-0 border-l border-b",
                "right-0 bottom-0 border-r border-b",
              ].map((p) => (
                <span key={p} className={`pointer-events-none absolute h-3 w-3 border-ink/40 ${p}`} />
              ))}
              <div className="absolute inset-0 grid place-items-center p-6">
                <FeatureIcon kind={c.icon} />
              </div>
            </div>
            <p className="mt-6 text-[13px] leading-relaxed text-ink-soft">{c.body}</p>
          </div>
        ))}
      </Reveal>
    </Panel>
  );
}
