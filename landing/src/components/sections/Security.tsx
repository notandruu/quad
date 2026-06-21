"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";
import SecurityViz from "@/components/SecurityViz";
import { QuadMark } from "@/components/Header";

const CONTROLS = [
  { kind: "minimize" as const, title: "Data minimization", body: "Quad sends the smallest verified evidence packet, never your whole company brain." },
  { kind: "isolate" as const, title: "Tenant isolation", body: "Every customer's context is isolated, encrypted, and access-scoped by default." },
  { kind: "proof" as const, title: "Proof on every call", body: "A receipt shows exactly what context each model call used, and why." },
  { kind: "own" as const, title: "You own the data", body: "Permission-aware retrieval, redaction, and tenant-scoped retention and deletion." },
];

const PERIOD = 5600;

export default function Security() {
  const [active, setActive] = useState(0);

  // auto-advance; re-arms whenever active changes (incl. on click)
  useEffect(() => {
    const id = setTimeout(() => setActive((a) => (a + 1) % CONTROLS.length), PERIOD);
    return () => clearTimeout(id);
  }, [active]);

  const c = CONTROLS[active];

  return (
    <Panel
      id="security"
      label="Security"
      desc="Enterprise AI deals are blocked by data security before model quality. Quad is built for the security review, not around it."
      title="Send less. Prove everything."
    >
      <Reveal className="mt-9">
        <div className="overflow-hidden rounded-xl border border-ink/12 bg-ink">
          {/* tabs with progress underline */}
          <div className="grid grid-cols-2 border-b border-white/[0.07] sm:grid-cols-4">
            {CONTROLS.map((t, i) => (
              <button
                key={t.title}
                onClick={() => setActive(i)}
                className="relative flex items-center gap-2.5 border-r border-white/[0.07] px-4 py-3.5 text-left last:border-r-0"
              >
                <span className={`font-mono text-[11px] ${active === i ? "text-flame" : "text-tan/40"}`}>0{i + 1}</span>
                <span className={`text-[12.5px] transition-colors ${active === i ? "text-bone" : "text-tan/45"}`}>{t.title}</span>
                {active === i && (
                  <span
                    key={active}
                    className="sec-progress absolute bottom-0 left-0 h-[2px] w-full bg-flame"
                    style={{ animationDuration: `${PERIOD}ms` }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* stage: animation + description */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
            <div className="border-b border-white/[0.07] lg:border-b-0">
              <SecurityViz key={active} kind={c.kind} className="h-[300px] w-full md:h-[340px]" />
            </div>
            <div className="flex flex-col justify-center gap-4 p-7 lg:border-l lg:border-white/[0.07]">
              <QuadMark size={26} strokeWidth={2.4} />
              <div>
                <h3 className="text-[19px] font-medium text-bone">{c.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-tan/70">{c.body}</p>
              </div>
              <span className="font-mono text-[11px] text-tan/40">
                {active + 1} / {CONTROLS.length}
              </span>
            </div>
          </div>
        </div>
      </Reveal>
    </Panel>
  );
}
