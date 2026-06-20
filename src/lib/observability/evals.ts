import type { AuditFinding, FindingEval, RenderedPageEvidence } from "@/lib/types";
import { traced, SPAN } from "./phoenix";

/**
 * Eval labels we attach to findings. These also drive the quality gates: a
 * finding that fails groundedness or usefulness is hidden from the user.
 */
export type EvalLabel =
  | "grounded"
  | "useful"
  | "citation_correct"
  | "hallucination_risk";

/**
 * Evaluate a single finding for groundedness, usefulness, and duplication.
 *
 * The heuristic below is a deterministic placeholder so the pipeline runs
 * end to end without model access. Swap the body for an LLM-as-judge call and
 * keep emitting the result as a Phoenix span attribute.
 */
export async function evaluateFinding(
  finding: AuditFinding,
  evidence: RenderedPageEvidence | undefined,
  seenTitles: Set<string>
): Promise<FindingEval> {
  return traced(
    SPAN.evaluateFinding,
    { "finding.category": finding.category, "finding.severity": finding.severity },
    async (span) => {
      const hasQuote = Boolean(finding.evidence.quote || finding.evidence.selector);
      const quoteInPage =
        !finding.evidence.quote ||
        !evidence ||
        evidence.text.includes(finding.evidence.quote);

      const grounded = hasQuote && quoteInPage;
      const useful =
        finding.businessImpact.trim().length > 0 &&
        finding.recommendedFix.trim().length > 0;
      const duplicate = seenTitles.has(finding.title.toLowerCase());

      const hallucinationRisk: FindingEval["hallucinationRisk"] = grounded
        ? "low"
        : hasQuote
          ? "medium"
          : "high";

      const result: FindingEval = { grounded, useful, duplicate, hallucinationRisk };
      span.setAttributes({
        "eval.grounded": grounded,
        "eval.useful": useful,
        "eval.duplicate": duplicate,
        "eval.hallucination_risk": hallucinationRisk,
      });
      return result;
    }
  );
}
