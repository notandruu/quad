import type { BrainMemory, RenderedPageEvidence } from "@/lib/types";

/** Current date is injected into every audit prompt to stop stale-date errors. */
export function currentDateRule(today = new Date()): string {
  const iso = today.toISOString().slice(0, 10);
  return [
    `Current date: ${iso}.`,
    `Do not mark dates in ${today.getUTCFullYear()} as outdated only because they are in ${today.getUTCFullYear()}.`,
    "Only flag stale dates when the page clearly claims something old is current, expired, or no longer valid.",
  ].join("\n");
}

export const OUTDATED_RULES = `
Flag outdated info only if:
- a date is before the current date and the page presents it as upcoming
- an event already passed and the page says "coming soon"
- a copyright year is older than the current year
- staff/program info conflicts with the internal brain
- a deadline has passed
- the page references old pricing or old service names

Do not flag:
- current-year content
- future schedules
- sports/news headlines
- archive pages
- projections, mock drafts, or future events clearly labeled as future
`.trim();

/**
 * Build the page-analysis prompt. The model must ground every finding in the
 * supplied evidence and the internal brain context, and obey the date rules.
 */
export function buildAnalyzePrompt(
  page: RenderedPageEvidence,
  brainContext: BrainMemory[]
): string {
  const brain = brainContext
    .map((m) => `- [${m.sourceType}] ${m.title}: ${m.summary ?? m.content}`)
    .join("\n");

  return [
    currentDateRule(),
    "",
    "You are Kali's Growth employee auditing one page of a company website.",
    "Compare what the page says against what the company internally knows.",
    "Only report a finding when you can quote the page text or cite a selector as evidence.",
    "Every finding needs: category, severity, confidence, a quote or selector, business impact, and a concrete fix.",
    "",
    OUTDATED_RULES,
    "",
    "INTERNAL BRAIN CONTEXT:",
    brain || "(none retrieved)",
    "",
    `PAGE URL: ${page.url}`,
    `PAGE TITLE: ${page.title}`,
    "PAGE TEXT (truncated):",
    page.text.slice(0, 6000),
    "",
    "Return findings as JSON matching the AuditFinding schema.",
  ].join("\n");
}

/** Synthesis prompt: turn raw findings into a few prioritized business fixes. */
export function buildSynthesisPrompt(targetUrl: string): string {
  return [
    currentDateRule(),
    "",
    `Summarize the audit of ${targetUrl}.`,
    "Prioritize the top fixes by business impact, not by count.",
    "Be concise, company-aware, and specific. Speak like a trusted employee.",
  ].join("\n");
}
