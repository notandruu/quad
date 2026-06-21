"use client";

import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";

const CONTROLS = [
  {
    icon: "min" as const,
    title: "Data minimization",
    body: "Quad sends the smallest verified evidence packet, never your whole company brain.",
  },
  {
    icon: "isolate" as const,
    title: "Tenant isolation",
    body: "Every customer's context is isolated, encrypted, and access-scoped by default.",
  },
  {
    icon: "receipt" as const,
    title: "Proof on every call",
    body: "A receipt shows exactly what context each model call used, and why.",
  },
  {
    icon: "retain" as const,
    title: "You own the data",
    body: "Permission-aware retrieval, redaction, and tenant-scoped retention and deletion.",
  },
];

function Ctl({ kind }: { kind: "min" | "isolate" | "receipt" | "retain" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF5CAB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {kind === "min" && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8" />
        </>
      )}
      {kind === "isolate" && (
        <>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </>
      )}
      {kind === "receipt" && (
        <>
          <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
          <path d="M9 8h6M9 12h6" />
        </>
      )}
      {kind === "retain" && (
        <>
          <path d="M12 3l8 3v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
          <path d="M9 12l2 2 4-4" />
        </>
      )}
    </svg>
  );
}

const BADGES = ["SOC 2 Type II", "GDPR", "ISO 27001", "Tenant-isolated"];

export default function Security() {
  return (
    <Panel
      id="security"
      label="Security"
      desc="Enterprise AI deals are blocked by data security before model quality. Quad is built for the security review, not around it."
      title="Minimize what leaves the tenant. Prove what did."
    >
      <Reveal
        stagger
        className="mt-9 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-ink/12 bg-ink/12 sm:grid-cols-2 lg:grid-cols-4"
      >
        {CONTROLS.map((c) => (
          <div key={c.title} className="flex flex-col bg-paper p-6 transition-colors duration-200 hover:bg-cream">
            <span className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blush">
              <Ctl kind={c.icon} />
            </span>
            <h3 className="text-[16px] font-medium text-ink">{c.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{c.body}</p>
          </div>
        ))}
      </Reveal>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {BADGES.map((b) => (
          <span
            key={b}
            className="flex items-center gap-2 rounded-full border border-ink/15 bg-paper px-4 py-2 font-mono text-[12px] tracking-[0.02em] text-ink/70"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-flame" />
            {b}
          </span>
        ))}
      </div>
    </Panel>
  );
}
