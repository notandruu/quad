export type RunStatus = "queued" | "running" | "completed" | "failed";

export type AuditRun = {
  id: string;
  orgId: string;
  targetUrl: string;
  status: RunStatus;
  limit: number;
  pagesDiscovered: number;
  pagesRendered: number;
  pagesAnalyzed: number;
  findingsCount: number;
  startedAt: string;
  completedAt?: string;
};

export type AuditEvent = {
  type: string;
  runId: string;
  sequence: number;
  createdAt: string;
  payload: unknown;
};

export type Severity = "low" | "medium" | "high";
export type HallucinationRisk = "low" | "medium" | "high";

export type AuditCategory =
  | "missing_public_explanation"
  | "internal_external_mismatch"
  | "outdated_information"
  | "conflicting_claims"
  | "broken_cta"
  | "missing_faq"
  | "missing_trust_signal"
  | "thin_page"
  | "accessibility_issue"
  | "grammar_issue"
  | "link_issue"
  | "image_alt_issue"
  | "brand_voice_mismatch";

export type FindingEval = {
  grounded: boolean;
  useful: boolean;
  duplicate: boolean;
  hallucinationRisk: HallucinationRisk;
};

export type AuditFinding = {
  id: string;
  runId: string;
  pageUrl: string;
  title: string;
  category: AuditCategory;
  severity: Severity;
  confidence: number;
  evidence: {
    quote?: string;
    selector?: string;
    screenshotUrl?: string;
    sourceType: "browser" | "brain" | "comparison";
  };
  reasoning: string;
  businessImpact: string;
  recommendedFix: string;
  sourceComparison?: {
    internalClaim?: string;
    externalClaim?: string;
    internalSourceId?: string;
    externalSourceUrl?: string;
  };
  eval?: FindingEval;
};

export type RecommendedAction = {
  id: string;
  type: "draft_faq" | "draft_page" | "create_task" | "draft_slack" | "save_memory";
  title: string;
  description: string;
  input: unknown;
  requiresApproval: boolean;
};

export type AuditReport = {
  runId: string;
  orgId: string;
  targetUrl: string;
  summary: string;
  topFindings: AuditFinding[];
  allFindings: AuditFinding[];
  recommendedActions: RecommendedAction[];
  metrics: {
    pagesAnalyzed: number;
    findingsShown: number;
    findingsFiltered: number;
    averageConfidence: number;
  };
};

/**
 * Browser-rendered evidence for a single page. Findings must trace back to one
 * of these; if we cannot produce evidence, the finding is not shown.
 */
export type RenderedPageEvidence = {
  url: string;
  title: string;
  status: number;
  screenshotUrl?: string;
  text: string;
  headings: Array<{ level: number; text: string }>;
  links: Array<{ text: string; href: string }>;
  buttons: Array<{ text: string; selector?: string }>;
  images: Array<{ src: string; alt?: string; selector?: string }>;
  forms: Array<{ selector?: string; labels: string[] }>;
  selectors: Array<{ selector: string; text: string }>;
  metadata: {
    description?: string;
    canonical?: string;
    ogTitle?: string;
    ogDescription?: string;
  };
};
