import type { BrainMemory, RenderedPageEvidence } from "@/lib/types";

/** Current date injected into every audit prompt — stops the ESPN failure mode. */
export function currentDateRule(today = new Date()): string {
  const iso = today.toISOString().slice(0, 10);
  return [
    `Current date: ${iso}.`,
    `Do not mark dates in ${today.getUTCFullYear()} as outdated simply because they are in ${today.getUTCFullYear()}.`,
    "Only flag stale dates when the page explicitly presents past content as current, upcoming, or valid.",
  ].join("\n");
}

export const OUTDATED_RULES = `
Flag outdated info only when ALL of these are true:
1. The date is strictly before the current date.
2. The page actively presents it as upcoming, current, or still valid.
3. There is a verbatim quote from the page that proves it.

Never flag:
- Current-year dates
- Future events clearly labeled as future
- Sports schedules, mock drafts, projections
- Archive or historical pages
- Copyright years that match the current year
`.trim();

const FINDING_SCHEMA = `
Each finding must be a JSON object with EXACTLY these fields:
{
  "title": "Short, specific problem statement (under 12 words)",
  "category": one of: missing_public_explanation | internal_external_mismatch |
    outdated_information | conflicting_claims | broken_cta | missing_faq |
    missing_trust_signal | thin_page | accessibility_issue | grammar_issue |
    link_issue | image_alt_issue | brand_voice_mismatch,
  "severity": "high" | "medium" | "low",
  "confidence": number 0.0–1.0,
  "quote": "verbatim text from the page that supports the claim, or omit if comparison-based",
  "selector": "CSS selector if identifiable, or omit",
  "reasoning": "why this is a problem, grounded in the evidence",
  "businessImpact": "concrete effect on visitors, donors, customers, or AI search",
  "recommendedFix": "specific, actionable change — not vague advice",
  "internalClaim": "what the company brain says (if this is a mismatch finding)",
  "externalClaim": "what the website says (if this is a mismatch finding)"
}
`.trim();

const CATEGORY_GUIDE = `
Category guidance:
- missing_public_explanation: the brain says the org does X but the page never explains X
- internal_external_mismatch: brain says one thing, page says something different
- outdated_information: page presents past content as current (strict evidence required)
- conflicting_claims: page contradicts itself
- broken_cta: a button, form, or link is missing, broken, or unclear
- missing_faq: obvious questions a visitor would have are not answered
- missing_trust_signal: no contact info, staff names, accreditation, or proof of legitimacy
- thin_page: page exists but gives almost no useful information
- accessibility_issue: images missing alt text, no headings structure, low-contrast text
- grammar_issue: clear grammar or spelling error (only flag egregious ones)
- link_issue: link text is "click here" or generic, or a link is dead
- image_alt_issue: image alt text is missing, empty, or describes the image poorly
- brand_voice_mismatch: page tone contradicts the stated brand voice in the brain
`.trim();

/**
 * Full audit prompt for a single page. Structured to:
 * 1. Orient the model as Kali's Growth employee.
 * 2. Inject the internal brain so it can detect gaps and mismatches.
 * 3. Inject rendered page evidence.
 * 4. Enforce the date rule and evidence requirement.
 * 5. Specify the exact JSON output schema.
 */
export function buildAnalyzePrompt(
  page: RenderedPageEvidence,
  brainContext: BrainMemory[]
): string {
  const brain = brainContext.length
    ? brainContext
        .map(
          (m) =>
            `[${m.sourceType.toUpperCase()}] ${m.title}\n${m.summary ?? m.content.slice(0, 400)}`
        )
        .join("\n\n")
    : "(no brain context retrieved — focus on what the page alone is missing or unclear about)";

  const headings = page.headings
    .map((h) => `${"#".repeat(h.level)} ${h.text}`)
    .join("\n");

  const meta = [
    page.metadata.description && `description: ${page.metadata.description}`,
    page.metadata.ogTitle && `og:title: ${page.metadata.ogTitle}`,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "You are Kali, an AI Growth employee. Your job is to audit one page of a",
    "company website against the company's internal brain and surface real,",
    "evidence-backed issues that hurt the organization's ability to communicate",
    "clearly with visitors, donors, customers, and AI search engines.",
    "",
    currentDateRule(),
    "",
    OUTDATED_RULES,
    "",
    "RULES:",
    "- Every finding MUST have either a direct quote from the page or a clear",
    "  comparison between an internal brain claim and what the page says.",
    "- If you cannot ground a finding in evidence, do not include it.",
    "- Maximum 5 findings per page. Quality over quantity.",
    "- Do not invent problems. Only report what is genuinely missing or wrong.",
    "- Findings should be specific to this page, not generic SEO advice.",
    "",
    CATEGORY_GUIDE,
    "",
    "OUTPUT FORMAT:",
    "Return ONLY a JSON array of finding objects. No prose before or after.",
    FINDING_SCHEMA,
    "",
    "=== INTERNAL BRAIN CONTEXT ===",
    brain,
    "",
    "=== PAGE EVIDENCE ===",
    `URL: ${page.url}`,
    `Title: ${page.title}`,
    `HTTP status: ${page.status}`,
    meta ? `Meta:\n${meta}` : "",
    headings ? `Heading structure:\n${headings}` : "",
    `\nFull visible text (truncated to 6000 chars):\n${page.text.slice(0, 6000)}`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/**
 * Synthesis prompt: take the raw list of passed-gate findings and produce a
 * tight executive summary + prioritized action set. Separate from page
 * analysis so the model can reason across all findings at once.
 */
export function buildSynthesisPrompt(
  targetUrl: string,
  findings: Array<{ title: string; severity: string; businessImpact: string; recommendedFix: string; pageUrl: string }>,
  brainSummary: string
): string {
  const findingList = findings
    .map(
      (f, i) =>
        `${i + 1}. [${f.severity.toUpperCase()}] ${f.title} (${f.pageUrl})\n   Impact: ${f.businessImpact}\n   Fix: ${f.recommendedFix}`
    )
    .join("\n\n");

  return [
    currentDateRule(),
    "",
    `You are Kali, an AI Chief of Staff summarizing a website audit of ${targetUrl}.`,
    "",
    "COMPANY CONTEXT:",
    brainSummary || "(no brain context)",
    "",
    "FINDINGS:",
    findingList || "(no findings passed quality gates)",
    "",
    "Write a 2-3 sentence executive summary that:",
    "- Identifies the biggest pattern (not just a list)",
    "- Quantifies the scope (X pages, Y categories)",
    "- States the single most important fix",
    "Tone: warm, direct, company-aware. Speak like a trusted employee, not a consultant.",
    "Return ONLY the summary text. No bullet points, no headers.",
  ].join("\n");
}

/** Post-audit chat system prompt. Grounds answers in the completed audit. */
export function buildAuditChatSystemPrompt(
  employeeName: string,
  employeeTone: string,
  brainContext: BrainMemory[],
  auditSummary: string,
  topFindings: Array<{ title: string; severity: string; recommendedFix: string; pageUrl: string }>
): string {
  const brain = brainContext
    .map((m) => `- [${m.sourceType}] ${m.title}: ${m.summary ?? m.content.slice(0, 200)}`)
    .join("\n");

  const findings = topFindings
    .map((f) => `- [${f.severity}] ${f.title} on ${f.pageUrl} → ${f.recommendedFix}`)
    .join("\n");

  return [
    `You are ${employeeName}, an AI employee. Tone: ${employeeTone}.`,
    "Answer only from the company memory and audit results below. Cite sources.",
    "If asked to draft content, match the company's brand voice.",
    "If asked to create tasks, list them numbered and mark each requiresApproval: true.",
    "If you don't have enough information, say so plainly.",
    "",
    "COMPANY BRAIN:",
    brain || "(empty)",
    "",
    "AUDIT SUMMARY:",
    auditSummary,
    "",
    "TOP FINDINGS:",
    findings || "(no findings)",
  ].join("\n");
}
