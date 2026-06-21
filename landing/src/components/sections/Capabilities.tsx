"use client";

import Panel from "@/components/Panel";

const CARDS = [
  { t: "Connect", b: "Plug into your helpdesk, CRM, docs, and code in minutes." },
  { t: "Collect", b: "Pull the exact evidence each task needs, on demand." },
  { t: "Validate", b: "Evaluate every answer for grounding before it ships." },
  { t: "Ship", b: "Execute through approval, then verify the result." },
];

export default function Capabilities() {
  return (
    <Panel
      id="capabilities"
      label="How it works"
      desc="Quad is a four-layer runtime: it retrieves company evidence, grounds and validates each answer, and ships real actions through approval."
      title="Context in. Verified work out."
    >
      <div className="mt-9 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-ink/10 bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c) => (
          <div key={c.t} className="bg-paper p-6 transition-colors duration-200 hover:bg-cream">
            <h3 className="text-[16px] font-medium text-ink">{c.t}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{c.b}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
