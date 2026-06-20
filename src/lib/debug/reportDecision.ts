import type { AuditReport } from "@/lib/types";
import { buildEvidenceView } from "./findingEvidence";

export type DecisionSummary = {
  total: number;
  ready: number;
  needsReview: number;
  averageProofScore: number;
  label: string;
  nextAction: string;
  tone: "ready" | "review" | "empty";
};

export function summarizeDecisionQueue(report: AuditReport): DecisionSummary {
  const findings = report.topFindings;

  if (findings.length === 0) {
    return {
      total: 0,
      ready: 0,
      needsReview: 0,
      averageProofScore: 0,
      label: "No findings ready",
      nextAction: "Run a broader audit or add more company-brain sources.",
      tone: "empty",
    };
  }

  const views = findings.map(buildEvidenceView);
  const ready = views.filter((view) => view.approvalGate.canApprove).length;
  const needsReview = views.length - ready;
  const averageProofScore = Math.round(
    views.reduce((sum, view) => sum + view.proofScore, 0) / views.length
  );

  if (needsReview > 0) {
    return {
      total: views.length,
      ready,
      needsReview,
      averageProofScore,
      label: "Review queue active",
      nextAction: "Review blocked findings before approving external work.",
      tone: "review",
    };
  }

  return {
    total: views.length,
    ready,
    needsReview,
    averageProofScore,
    label: "Approval queue ready",
    nextAction: "Approve or edit the drafted fixes.",
    tone: "ready",
  };
}
