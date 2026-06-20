"use client";

import { useState } from "react";
import type { AuditReport } from "@/lib/types";
import {
  buildAuditBrief,
  summarizeDecisionQueue,
  type AuditBrief,
  type DecisionSummary,
} from "@/lib/debug/reportDecision";
import { FindingCard } from "./FindingCard";

/** Findings list. Only grounded, gated findings reach this panel. */
export function FindingsPanel({ report }: { report: AuditReport | null }) {
  if (!report) {
    return (
      <div className="rounded-lg border border-dashed border-edge p-6 text-center text-xs text-neutral-600">
        Findings appear here after an audit completes.
      </div>
    );
  }

  const decision = summarizeDecisionQueue(report);
  const brief = buildAuditBrief(report);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span>{report.summary}</span>
        <span className="text-neutral-600">
          {report.metrics.findingsShown} shown · {report.metrics.findingsFiltered} filtered
        </span>
      </div>
      <DecisionStrip decision={decision} />
      <AuditBriefCard brief={brief} />
      {report.topFindings.map((f) => (
        <FindingCard key={f.id} finding={f} />
      ))}
    </div>
  );
}

function AuditBriefCard({ brief }: { brief: AuditBrief }) {
  const [copied, setCopied] = useState(false);

  async function copyBrief() {
    if (!navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(brief.copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-lg border border-edge bg-panel p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-neutral-100">Audit brief</div>
          <div className="mt-1 text-xs text-neutral-500">{brief.headline}</div>
        </div>
        <button
          type="button"
          onClick={copyBrief}
          className="rounded-md border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition hover:border-accent/60"
        >
          {copied ? "Copied" : "Copy brief"}
        </button>
      </div>
      <div className="mt-3 grid gap-2 text-[11px] text-neutral-400 sm:grid-cols-2">
        {brief.lines.map((line) => (
          <div key={line} className="rounded border border-edge bg-ink/50 px-2 py-1.5">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionStrip({ decision }: { decision: DecisionSummary }) {
  return (
    <div className={`rounded-lg border p-3 ${decisionColor(decision.tone)}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{decision.label}</div>
          <div className="mt-1 text-xs opacity-80">{decision.nextAction}</div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <Metric label="Ready" value={decision.ready} />
          <Metric label="Review" value={decision.needsReview} />
          <Metric label="Proof" value={`${decision.averageProofScore}/100`} />
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-20 rounded border border-current px-2 py-1">
      <div className="opacity-70">{label}</div>
      <div className="mt-1 text-base font-semibold leading-none">{value}</div>
    </div>
  );
}

function decisionColor(tone: DecisionSummary["tone"]): string {
  return {
    ready: "border-accent/30 bg-accent/10 text-accent",
    review: "border-amber-300/50 bg-amber-100 text-amber-700",
    empty: "border-edge bg-panel text-neutral-500",
  }[tone];
}
