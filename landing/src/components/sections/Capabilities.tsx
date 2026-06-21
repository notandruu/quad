"use client";

import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";

const CARDS = [
  { t: "Connect", b: "Plug into your helpdesk, CRM, docs, and code in minutes." },
  { t: "Collect", b: "Pull the exact evidence each task needs, on demand." },
  { t: "Validate", b: "Evaluate every answer for grounding before it ships." },
  { t: "Ship", b: "Execute through approval, then verify the result." },
];

type Ev = { e: string; d: string; tag?: string; ok?: boolean };
const STREAM: Ev[] = [
  { e: "run.started", d: "Security questionnaire — 24 questions" },
  { e: "brain.retrieved", d: "6 verified memories", tag: "context" },
  { e: "context.collected", d: "SOC 2 Type II report v3.2", tag: "source" },
  { e: "answer.drafted", d: "“MFA is enforced org-wide”" },
  { e: "answer.evaluated", d: "grounded 0.96 · hallucination low", ok: true },
  { e: "brain.learned", d: "control: mfa_enforced", tag: "memory" },
  { e: "approval.requested", d: "→ Security lead" },
  { e: "action.executed", d: "Trust packet exported" },
  { e: "action.verified", d: "receipt qc_1f93a4", ok: true },
];

function RunStream() {
  return (
    <div className="overflow-hidden rounded-xl border border-ink/12 bg-ink">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-flame" />
          <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-bone">Live run</span>
        </div>
        <span className="font-mono text-[11px] text-tan/50">replayable · streamed</span>
      </div>
      <div className="divide-y divide-white/[0.05]">
        {STREAM.map((ev) => (
          <div key={ev.e} className="flex items-center gap-4 px-5 py-2.5 font-mono text-[12px]">
            <span className="w-[150px] shrink-0 text-flame/90">{ev.e}</span>
            <span className="flex-1 truncate text-tan">{ev.d}</span>
            {ev.tag && (
              <span className="rounded-full border border-white/[0.1] px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-tan/55">
                {ev.tag}
              </span>
            )}
            {ev.ok && <span className="text-[13px] text-flame">✓</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Capabilities() {
  return (
    <Panel
      id="capabilities"
      label="How it works"
      desc="Quad is a four-layer runtime: it retrieves company evidence, grounds and validates each answer, and ships real actions through approval."
      title="Context in. Verified work out."
    >
      <Reveal className="mt-9">
        <RunStream />
      </Reveal>

      <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-ink/10 bg-ink/10 sm:grid-cols-2 lg:grid-cols-4">
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
