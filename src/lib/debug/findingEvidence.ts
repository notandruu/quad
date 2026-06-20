import type { AuditFinding } from "@/lib/types";

export type EvidenceViewModel = {
  sourceLabel: string;
  selectorLabel: string | null;
  screenshotUrl: string | null;
  pageHost: string;
  categoryLabel: string;
  severityLabel: string;
  proofScore: number;
  proofLabel: string;
  proofTone: "strong" | "medium" | "weak";
  proofReasons: string[];
  approvalGate: ApprovalGateViewModel;
  traceSummary: string;
  traceSteps: TraceStepViewModel[];
  evalSignals: EvalSignalViewModel[];
};

export type TraceStepViewModel = {
  id: string;
  label: string;
  detail: string;
  status: "passed" | "warning" | "missing" | "pending";
};

export type EvalSignalViewModel = {
  label: string;
  value: string;
  status: "passed" | "warning" | "missing";
};

export type ApprovalGateViewModel = {
  canApprove: boolean;
  label: string;
  detail: string;
  reasons: string[];
  tone: "ready" | "review";
};

const SOURCE_LABELS: Record<AuditFinding["evidence"]["sourceType"], string> = {
  browser: "Browser evidence",
  brain: "Brain memory",
  comparison: "Brain vs website",
};

export function buildEvidenceView(finding: AuditFinding): EvidenceViewModel {
  const proof = scoreEvidence(finding);
  const approvalGate = buildApprovalGate(finding, proof);
  const traceSteps = buildTraceSteps(finding);

  return {
    sourceLabel: SOURCE_LABELS[finding.evidence.sourceType],
    selectorLabel: normalizeSelector(finding.evidence.selector),
    screenshotUrl: finding.evidence.screenshotUrl || null,
    pageHost: compactPageUrl(finding.pageUrl),
    categoryLabel: sentenceCase(finding.category.replaceAll("_", " ")),
    severityLabel: sentenceCase(finding.severity),
    approvalGate,
    traceSummary: summarizeTrace(traceSteps),
    traceSteps,
    evalSignals: buildEvalSignals(finding),
    ...proof,
  };
}

export function buildApprovalGate(
  finding: AuditFinding,
  proof: Pick<EvidenceViewModel, "proofScore" | "proofTone"> = scoreEvidence(finding)
): ApprovalGateViewModel {
  const reasons: string[] = [];

  if (proof.proofTone === "weak") {
    reasons.push("Weak evidence");
  }
  if (!finding.eval) {
    reasons.push("Eval missing");
  } else {
    if (!finding.eval.grounded) reasons.push("Grounding failed");
    if (!finding.eval.useful) reasons.push("Usefulness failed");
    if (finding.eval.duplicate) reasons.push("Duplicate flagged");
    if (finding.eval.hallucinationRisk === "high") reasons.push("High hallucination risk");
  }

  if (reasons.length > 0) {
    return {
      canApprove: false,
      label: "Needs review before approval",
      detail: "Approval is held until evidence and eval checks are clean.",
      reasons,
      tone: "review",
    };
  }

  return {
    canApprove: true,
    label: "Ready for human approval",
    detail: `Evidence score ${proof.proofScore}/100 with no blocking eval issues.`,
    reasons: ["Evidence and eval checks passed"],
    tone: "ready",
  };
}

export function hasScreenshot(finding: AuditFinding): boolean {
  return Boolean(finding.evidence.screenshotUrl);
}

export function scoreEvidence(finding: AuditFinding): Pick<
  EvidenceViewModel,
  "proofScore" | "proofLabel" | "proofTone" | "proofReasons"
> {
  let score = 0;
  const reasons: string[] = [];

  if (finding.evidence.sourceType === "browser") {
    score += 18;
    reasons.push("Browser source");
  }
  if (finding.evidence.quote) {
    score += 18;
    reasons.push("Quoted evidence");
  }
  if (finding.evidence.selector) {
    score += 12;
    reasons.push("Selector");
  }
  if (finding.evidence.screenshotUrl) {
    score += 16;
    reasons.push("Screenshot");
  }
  if (finding.sourceComparison?.internalClaim || finding.sourceComparison?.externalClaim) {
    score += 14;
    reasons.push("Brain comparison");
  }
  if (finding.eval?.grounded) {
    score += 10;
    reasons.push("Grounded eval");
  }
  if (finding.eval?.useful) {
    score += 6;
    reasons.push("Useful eval");
  }

  score += Math.round(Math.max(0, Math.min(1, finding.confidence)) * 6);

  const proofScore = Math.min(100, score);
  if (proofScore >= 76) {
    return {
      proofScore,
      proofLabel: "Strong proof",
      proofTone: "strong",
      proofReasons: reasons,
    };
  }
  if (proofScore >= 45) {
    return {
      proofScore,
      proofLabel: "Medium proof",
      proofTone: "medium",
      proofReasons: reasons,
    };
  }
  return {
    proofScore,
    proofLabel: "Weak proof",
    proofTone: "weak",
    proofReasons: reasons,
  };
}

export function buildTraceSteps(finding: AuditFinding): TraceStepViewModel[] {
  const hasBrowserEvidence = finding.evidence.sourceType === "browser";
  const hasGroundedEvidence = Boolean(
    finding.evidence.quote || finding.evidence.selector || finding.evidence.screenshotUrl
  );
  const hasBrainComparison = Boolean(
    finding.sourceComparison?.internalClaim || finding.sourceComparison?.externalClaim
  );
  const approvalGate = buildApprovalGate(finding);

  return [
    {
      id: "browserbase.render_page",
      label: "Render page",
      detail: hasBrowserEvidence
        ? "Browser evidence is attached to this finding."
        : "No rendered browser evidence attached.",
      status: hasBrowserEvidence && hasGroundedEvidence ? "passed" : "missing",
    },
    {
      id: "brain.retrieve",
      label: "Retrieve brain",
      detail: hasBrainComparison
        ? "Company-brain comparison is available."
        : "No company-brain comparison attached.",
      status: hasBrainComparison ? "passed" : "warning",
    },
    {
      id: "llm.analyze_page",
      label: "Analyze page",
      detail: finding.reasoning ? "Reasoning is captured for replay." : "Reasoning is missing.",
      status: finding.reasoning ? "passed" : "missing",
    },
    {
      id: "llm.evaluate_finding",
      label: "Evaluate finding",
      detail: finding.eval
        ? "Grounding, usefulness, duplicate, and risk checks are captured."
        : "Local eval result is not attached yet.",
      status: finding.eval
        ? finding.eval.grounded && finding.eval.useful && finding.eval.hallucinationRisk !== "high"
          ? "passed"
          : "warning"
        : "missing",
    },
    {
      id: "approval.gate",
      label: "Approval gate",
      detail: approvalGate.detail,
      status: approvalGate.canApprove ? "pending" : "warning",
    },
  ];
}

export function buildEvalSignals(finding: AuditFinding): EvalSignalViewModel[] {
  if (!finding.eval) {
    return [
      {
        label: "Eval status",
        value: "Not attached",
        status: "missing",
      },
    ];
  }

  return [
    {
      label: "Grounded",
      value: finding.eval.grounded ? "Pass" : "Fail",
      status: finding.eval.grounded ? "passed" : "warning",
    },
    {
      label: "Useful",
      value: finding.eval.useful ? "Pass" : "Fail",
      status: finding.eval.useful ? "passed" : "warning",
    },
    {
      label: "Duplicate",
      value: finding.eval.duplicate ? "Flagged" : "Clear",
      status: finding.eval.duplicate ? "warning" : "passed",
    },
    {
      label: "Risk",
      value: sentenceCase(finding.eval.hallucinationRisk),
      status: finding.eval.hallucinationRisk === "high" ? "warning" : "passed",
    },
  ];
}

function summarizeTrace(steps: TraceStepViewModel[]): string {
  const ready = steps.filter((step) => step.status === "passed").length;
  const needsAttention = steps.filter((step) => step.status === "warning" || step.status === "missing").length;

  if (needsAttention === 0) {
    return `${ready}/${steps.length} checks passed`;
  }

  return `${ready}/${steps.length} checks passed · ${needsAttention} need attention`;
}

function normalizeSelector(selector?: string): string | null {
  if (!selector?.trim()) return null;
  return selector.trim();
}

function compactPageUrl(value: string): string {
  try {
    const url = new URL(value);
    const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
    return `${url.hostname}${path}`;
  } catch {
    return value;
  }
}

function sentenceCase(value: string): string {
  if (!value) return value;
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
