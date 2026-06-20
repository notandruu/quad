import type { AuditFinding } from "@/lib/types";

export type GateResult = {
  pass: boolean;
  reasons: string[];
};

/**
 * Quality gates run before a finding is shown to the user. A finding that
 * fails any hard gate is hidden or pushed to a low-confidence review bucket.
 * Bad findings are worse than no findings.
 */
export function checkFinding(
  finding: AuditFinding,
  today = new Date()
): GateResult {
  const reasons: string[] = [];

  // 1. Must have evidence.
  if (!finding.evidence.quote && !finding.evidence.selector && !finding.evidence.screenshotUrl) {
    reasons.push("no_evidence");
  }

  // 2. Must not contradict the current date (the ESPN failure mode).
  if (contradictsCurrentDate(finding, today)) {
    reasons.push("contradicts_current_date");
  }

  // 3. Must not be flagged as a duplicate by the eval.
  if (finding.eval?.duplicate) reasons.push("duplicate");

  // 4. Must have clear business impact.
  if (!finding.businessImpact.trim()) reasons.push("no_business_impact");

  // 5. Must have an actionable fix.
  if (!finding.recommendedFix.trim()) reasons.push("no_fix");

  // 6 + 7. Must pass groundedness and usefulness evals when present.
  if (finding.eval && !finding.eval.grounded) reasons.push("not_grounded");
  if (finding.eval && !finding.eval.useful) reasons.push("not_useful");

  return { pass: reasons.length === 0, reasons };
}

/**
 * Reject "outdated" findings that flag the current year as stale, which is the
 * specific bug the plan calls out. We only trust an outdated-date finding if it
 * references a year strictly older than the current year.
 */
function contradictsCurrentDate(finding: AuditFinding, today: Date): boolean {
  if (finding.category !== "outdated_information") return false;
  const year = today.getUTCFullYear();
  const text = `${finding.title} ${finding.reasoning} ${finding.recommendedFix}`;
  const years = Array.from(text.matchAll(/\b(20\d{2})\b/g)).map((m) =>
    Number.parseInt(m[1], 10)
  );
  if (years.length === 0) return false;
  // A legitimate stale-date finding points at a year OLDER than now. If the
  // most recent year the finding references is the current year or later, it is
  // treating current/future content as outdated (the ESPN failure mode), even
  // when it also suggests downgrading to an older year.
  return Math.max(...years) >= year;
}

export function partitionFindings(findings: AuditFinding[], today = new Date()) {
  const shown: AuditFinding[] = [];
  const filtered: AuditFinding[] = [];
  for (const f of findings) {
    (checkFinding(f, today).pass ? shown : filtered).push(f);
  }
  return { shown, filtered };
}
