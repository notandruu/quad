"use client";

import type { AuditFinding } from "@/lib/types";
import { ApprovalButtons } from "./ApprovalButtons";

const severityColor: Record<AuditFinding["severity"], string> = {
  high: "text-red-400 border-red-400/30",
  medium: "text-amber-300 border-amber-300/30",
  low: "text-neutral-400 border-edge",
};

/** A single finding with evidence, impact, fix, and approval actions. */
export function FindingCard({ finding }: { finding: AuditFinding }) {
  return (
    <div className="animate-fade-in space-y-2 rounded-lg border border-edge bg-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-neutral-100">{finding.title}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${severityColor[finding.severity]}`}>
          {finding.severity}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-neutral-500">
        <span>{finding.category}</span>
        <span>·</span>
        <span className="truncate">{finding.pageUrl}</span>
        <span>·</span>
        <span>confidence {Math.round(finding.confidence * 100)}%</span>
      </div>

      {finding.evidence.quote && (
        <blockquote className="border-l-2 border-edge pl-2 text-xs italic text-neutral-400">
          “{finding.evidence.quote}”
        </blockquote>
      )}

      <p className="text-xs text-neutral-300">
        <span className="text-neutral-500">Why it matters: </span>
        {finding.businessImpact}
      </p>
      <p className="text-xs text-neutral-300">
        <span className="text-neutral-500">Fix: </span>
        {finding.recommendedFix}
      </p>

      {finding.sourceComparison && (
        <div className="rounded bg-ink/60 p-2 text-[11px] text-neutral-400">
          <div><span className="text-neutral-500">Internal: </span>{finding.sourceComparison.internalClaim}</div>
          <div><span className="text-neutral-500">External: </span>{finding.sourceComparison.externalClaim}</div>
        </div>
      )}

      <ApprovalButtons />
    </div>
  );
}
