"use client";

import Panel from "@/components/Panel";
import Reveal from "@/components/Reveal";

type Sev = "Critical" | "Warning" | "Info";
const SEV: Record<Sev, string> = {
  Critical: "text-flame border-flame/40 bg-flame/10",
  Warning: "text-[#c98a2b] border-[#c98a2b]/40 bg-[#c98a2b]/10",
  Info: "text-ink/55 border-ink/20 bg-ink/[0.04]",
};

const GAPS: {
  claim: string;
  truth: string;
  src1: string;
  src2: string;
  kind: string;
  sev: Sev;
}[] = [
  {
    claim: "“SSO is available on all plans”",
    truth: "“SSO is Enterprise-only”",
    src1: "Marketing site / Features",
    src2: "Billing / Plan matrix",
    kind: "pricing mismatch",
    sev: "Critical",
  },
  {
    claim: "“SOC 2 Type I”",
    truth: "“SOC 2 Type II — Mar 2026”",
    src1: "Security page",
    src2: "Audit report v4",
    kind: "outdated cert",
    sev: "Critical",
  },
  {
    claim: "“Data stored in the US only”",
    truth: "“EU region available”",
    src1: "Trust center",
    src2: "Infra config / regions",
    kind: "stale claim",
    sev: "Warning",
  },
  {
    claim: "“24/7 support for all customers”",
    truth: "“Business hours, Mon–Fri”",
    src1: "Homepage",
    src2: "Support policy v2",
    kind: "support hours",
    sev: "Warning",
  },
  {
    claim: "“99.9% uptime”",
    truth: "“99.95% over last 90 days”",
    src1: "Sales deck",
    src2: "Status page",
    kind: "understated",
    sev: "Info",
  },
];

export default function TrustGaps() {
  return (
    <Panel
      id="trustgaps"
      label="Trust gaps"
      desc="One pass compares every public claim against your internal source of truth, and shows the exact page that caused each gap."
      title="See where trust breaks."
    >
      <Reveal className="mt-9 overflow-hidden rounded-xl border border-ink/12 bg-paper">
        {/* scan header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-flame" />
            <span className="font-mono text-[13px] text-ink">quad.dev</span>
            <span className="font-mono text-[12px] text-ink/45">184 pages · scanned today</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[12px] uppercase tracking-[0.06em] text-ink/45">Trust score</span>
            <span className="tnum font-medium text-[26px] leading-none text-ink">78</span>
            <span className="font-mono text-[12px] text-ink/40">/ 100</span>
          </div>
        </div>

        {/* findings */}
        <div className="divide-y divide-ink/8">
          {GAPS.map((g) => (
            <div key={g.claim} className="flex flex-col gap-3 px-6 py-5 transition-colors hover:bg-cream md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-ink">
                  <span className="text-ink">{g.claim}</span>
                  <span className="font-mono text-[12px] text-ink/35">vs</span>
                  <span className="text-ink/70">{g.truth}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink/40">
                  <span>{g.src1}</span>
                  <span>·</span>
                  <span>{g.src2}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-[11px] lowercase tracking-[0.02em] text-ink/45">{g.kind}</span>
                <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] ${SEV[g.sev]}`}>
                  {g.sev}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </Panel>
  );
}
