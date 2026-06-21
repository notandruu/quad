"use client";

import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";

const CARDS = [
  {
    n: "001",
    title: "Grounded in evidence",
    body: "Every answer traces back to the source it came from. 98% land with a citation on the first pass.",
    icon: "trail" as const,
  },
  {
    n: "002",
    title: "Validated, then learned",
    body: "Each draft is scored for grounding and hallucination risk. Only what passes, 96% of the time, is written back to memory.",
    icon: "gate" as const,
  },
  {
    n: "003",
    title: "Replayable receipts",
    body: "Every run leaves a receipt of sources, evals, and approvals. Replay any decision end to end.",
    icon: "receipt" as const,
  },
];

function ProofIcon({ kind }: { kind: "trail" | "gate" | "receipt" }) {
  const s = "#111111";
  return (
    <svg viewBox="0 0 200 150" className="h-full w-full" fill="none" stroke={s}>
      {kind === "trail" && (
        <g strokeWidth="1.1" opacity="0.85">
          <polyline points="34,112 74,84 110,96 146,54" />
          <circle cx="34" cy="112" r="3.4" fill={s} stroke="none" />
          <circle cx="74" cy="84" r="3.4" fill={s} stroke="none" />
          <circle cx="110" cy="96" r="3.4" fill={s} stroke="none" />
          <circle cx="146" cy="54" r="13" />
          <path d="M140 54 l4.5 5 8.5 -10.5" strokeWidth="1.5" />
        </g>
      )}
      {kind === "gate" && (
        <g strokeWidth="1.1" opacity="0.85">
          <circle cx="100" cy="75" r="42" />
          <path d="M100 33 a42 42 0 0 1 29.7 71.7" strokeWidth="2.2" />
          <path d="M85 75 l10 10 22 -27" strokeWidth="1.6" />
        </g>
      )}
      {kind === "receipt" && (
        <g strokeWidth="1.1" opacity="0.85">
          <path d="M64 30 H136 V100 l-6 6 -6 -6 -6 6 -6 -6 -6 6 -6 -6 -6 6 -6 -6 -6 6 -6 -6 H64 Z" />
          <path d="M76 50 H124 M76 64 H124 M76 78 H106" />
        </g>
      )}
    </svg>
  );
}

export default function Numbers() {
  return (
    <Panel
      id="numbers"
      label="Proof"
      desc="Every number here is backed by evidence Quad collected and validated during real runs. No vibes, receipts."
      title="The work, with receipts."
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
                <ProofIcon kind={c.icon} />
              </div>
            </div>
            <p className="mt-6 text-[13px] leading-relaxed text-ink-soft">{c.body}</p>
          </div>
        ))}
      </Reveal>
    </Panel>
  );
}
