import type { AuditFinding, FindingEval, RenderedPageEvidence } from "@/lib/types";
import { traced, SPAN } from "./phoenix";
import { complete, auditModel, extractJsonObject } from "@/lib/llm/anthropic";

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
 * Evaluate a single finding for groundedness, usefulness, citation
 * correctness, and duplication. Uses an LLM-as-judge when a model is
 * configured; otherwise a deterministic heuristic. Either way the result is
 * emitted as Phoenix span attributes so the eval is visible in the dashboard.
 *
 * Duplication is always decided deterministically against titles seen earlier
 * in the run, since that is cheaper and more reliable than asking a model.
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
      const duplicate = seenTitles.has(finding.title.toLowerCase());

      const judged =
        (await llmJudge(finding, evidence)) ?? heuristicJudge(finding, evidence);

      const result: FindingEval = { ...judged, duplicate };
      span.setAttributes({
        "eval.grounded": result.grounded,
        "eval.useful": result.useful,
        "eval.duplicate": result.duplicate,
        "eval.hallucination_risk": result.hallucinationRisk,
        "eval.method": judged === null ? "heuristic" : "llm",
      });
      return result;
    }
  );
}

type JudgeResult = Omit<FindingEval, "duplicate">;

/**
 * Ask the audit model to judge a finding against the rendered page evidence.
 * Returns null when no model is configured so the caller can fall back.
 */
async function llmJudge(
  finding: AuditFinding,
  evidence: RenderedPageEvidence | undefined
): Promise<JudgeResult | null> {
  const raw = await complete({
    model: auditModel(),
    system:
      "You are a strict evaluator of website-audit findings. Judge only against the evidence given. Output a single JSON object.",
    prompt: [
      "Evaluate this finding and return JSON with boolean `grounded`, boolean `useful`,",
      "boolean `citation_correct`, and `hallucination_risk` of low|medium|high.",
      "- grounded: the cited quote/selector genuinely supports the claim and appears in the page text.",
      "- useful: the business impact and fix are concrete and actionable.",
      "- citation_correct: the quote is verbatim from the page text (or no quote was needed).",
      "",
      `FINDING: ${JSON.stringify({
        title: finding.title,
        category: finding.category,
        reasoning: finding.reasoning,
        businessImpact: finding.businessImpact,
        recommendedFix: finding.recommendedFix,
        quote: finding.evidence.quote,
      })}`,
      "",
      `PAGE TEXT (truncated): ${(evidence?.text ?? "").slice(0, 4000)}`,
    ].join("\n"),
    maxTokens: 400,
  });

  if (raw === null) return null;
  const obj = extractJsonObject(raw);
  if (!obj) return heuristicJudge(finding, evidence);

  const grounded = obj.grounded === true;
  const risk = obj.hallucination_risk;
  return {
    grounded,
    useful: obj.useful === true,
    hallucinationRisk: risk === "high" || risk === "medium" ? risk : "low",
  };
}

/**
 * Deterministic fallback judge. Pure and exported so the gate behavior is
 * unit-testable without a model.
 */
export function heuristicJudge(
  finding: AuditFinding,
  evidence: RenderedPageEvidence | undefined
): JudgeResult {
  const hasCitation = Boolean(finding.evidence.quote || finding.evidence.selector);
  const quoteInPage =
    !finding.evidence.quote ||
    !evidence ||
    evidence.text.includes(finding.evidence.quote);

  const grounded = hasCitation && quoteInPage;
  const useful =
    finding.businessImpact.trim().length > 0 &&
    finding.recommendedFix.trim().length > 0;

  const hallucinationRisk: FindingEval["hallucinationRisk"] = grounded
    ? "low"
    : hasCitation
      ? "medium"
      : "high";

  return { grounded, useful, hallucinationRisk };
}
