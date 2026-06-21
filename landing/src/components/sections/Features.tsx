"use client";

import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";

const CARDS = [
  {
    n: "001",
    title: "Company Brain",
    body: "Durable, org-scoped memory that holds only verified facts, with the source behind each one.",
    icon: "venn" as const,
  },
  {
    n: "002",
    title: "Approval Gates",
    body: "Every write action runs through a tier. Sensitive steps wait for the right human.",
    icon: "triangle" as const,
  },
  {
    n: "003",
    title: "QuadChain",
    body: "Proof-carrying compression. Every handoff ships with a tamper-evident receipt.",
    icon: "arcs" as const,
  },
];

function FeatureIcon({ kind }: { kind: "venn" | "triangle" | "arcs" }) {
  const s = "#1d1d1d";
  return (
    <svg viewBox="0 0 200 150" className="h-full w-full" fill="none" stroke={s}>
      {kind === "venn" && (
        <g strokeWidth="1.1" opacity="0.85">
          <circle cx="100" cy="62" r="34" />
          <circle cx="80" cy="92" r="34" />
          <circle cx="120" cy="92" r="34" />
        </g>
      )}
      {kind === "triangle" && (
        <g strokeWidth="1.1" opacity="0.85">
          <path d="M100 38 L150 112 L50 112 Z" />
          <path d="M100 62 L132 110 L68 110 Z" />
          <path d="M100 86 L116 110 L84 110 Z" />
        </g>
      )}
      {kind === "arcs" && (
        <g strokeWidth="1.1" opacity="0.85">
          <path d="M44 112 A56 56 0 0 1 156 112" />
          <path d="M58 112 A42 42 0 0 1 142 112" />
          <path d="M72 112 A28 28 0 0 1 128 112" />
          <path d="M86 112 A14 14 0 0 1 114 112" />
          <circle cx="100" cy="112" r="2.5" fill={s} stroke="none" />
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
                <span
                  key={p}
                  className={`pointer-events-none absolute h-3 w-3 border-ink/40 ${p}`}
                />
              ))}
              <div className="absolute inset-0 grid place-items-center p-6">
                <FeatureIcon kind={c.icon} />
              </div>
            </div>
            <p className="mt-6 text-[13px] leading-relaxed text-ink-soft">
              {c.body}
            </p>
          </div>
        ))}
      </Reveal>
    </Panel>
  );
}
