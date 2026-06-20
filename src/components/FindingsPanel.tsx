"use client";

import type { AuditReport } from "@/lib/types";
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-neutral-400">
        <span>{report.summary}</span>
        <span className="text-neutral-600">
          {report.metrics.findingsShown} shown · {report.metrics.findingsFiltered} filtered
        </span>
      </div>
      {report.topFindings.map((f) => (
        <FindingCard key={f.id} finding={f} />
      ))}
    </div>
  );
}
