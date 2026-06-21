import type {
  AuditFinding,
  AuditReport,
  RecommendedAction,
  RenderedPageEvidence,
} from "@/lib/types";
import { publishAuditEvent, bumpCounter, writeRunMeta, getRedis, metaKeys, eventTtlSeconds } from "@/lib/redis";
import type { PublishedEvent } from "@/lib/redis";
import { traced, SPAN, evaluateFinding } from "@/lib/observability";
import { captureHandled, withSpan } from "@/lib/observability/sentry";
import { retrieveMemories } from "@/lib/brain";
import { partitionFindings } from "@/lib/runtime/quality";
import { buildAnalyzePrompt, buildSynthesisPrompt } from "@/lib/runtime/prompts";
import { complete, auditModel, extractJsonArray } from "@/lib/llm/anthropic";
import { createQuadChainPacket, summarizeQuadChainPacket, type QuadChainPacketSummary } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
import { discoverPages } from "./discover";
import { renderPage } from "./browserbase";

export type RunAuditInput = {
  orgId: string;
  runId: string;
  targetUrl: string;
  limit?: number;
  onEvent?: (event: PublishedEvent) => void;
};

/**
 * The audit worker. Discovers pages, renders each through Browserbase (with a
 * static fallback), analyzes them against the company brain, evaluates and
 * gates the findings, then synthesizes a report. Emits real Redis events and
 * counters at every step so the live log is never faked.
 */
export async function runAudit(input: RunAuditInput): Promise<AuditReport> {
  const { orgId, runId, targetUrl, limit = 12 } = input;

  // Local emit: publishes to Redis and immediately forwards to the SSE
  // caller via onEvent so the client sees events as they happen.
  const emit = async (type: string, payload: Record<string, unknown> = {}) => {
    const event = await publishAuditEvent(runId, type, payload);
    if (event && input.onEvent) input.onEvent(event);
  };

  return withSpan("audit.run", { orgId, runId, auditLimit: limit }, async () => {
    await writeRunMeta({
      id: runId,
      orgId,
      targetUrl,
      status: "running",
      limit,
      pagesDiscovered: 0,
      pagesRendered: 0,
      pagesAnalyzed: 0,
      findingsCount: 0,
      startedAt: new Date().toISOString(),
    });
    await emit("audit.started", { targetUrl, limit });

    const pages = await discoverPages(targetUrl, limit);
    await bumpCounter(runId, "pagesDiscovered", pages.length);
    await emit("audit.pages_discovered", { count: pages.length });

    const rawFindings: AuditFinding[] = [];
    const evidenceByUrl = new Map<string, RenderedPageEvidence>();
    const seenTitles = new Set<string>();

    for (const url of pages) {
      await emit("page.queued", { url });
      try {
        await emit("page.rendering", { url });
        const evidence = await renderPage(url, runId);
        evidenceByUrl.set(url, evidence);
        await bumpCounter(runId, "pagesFetched");
        await emit("page.rendered", {
          url,
          status: evidence.status,
          // Keep the (potentially large) screenshot data URI out of the stream;
          // findings reference it directly. TODO: upload to object storage and
          // emit a stable URL instead.
          hasScreenshot: Boolean(evidence.screenshotUrl),
        });
        await saveAuditPacket({
          orgId,
          runId,
          type: "audit_event",
          producer: "quad.audit_worker",
          consumer: "quad.audit_analyzer",
          sourceId: `page:${url}`,
          sourceKind: "tool_result",
          sourceContent: {
            url,
            status: evidence.status,
            title: evidence.title,
            headings: evidence.headings.slice(0, 8),
            hasScreenshot: Boolean(evidence.screenshotUrl),
          },
          output: [
            `rendered ${url}`,
            `status ${evidence.status}`,
            `title ${evidence.title || "untitled page"}`,
          ].join("\n"),
          evidenceQuote: evidence.title || url,
          answerConcepts: ["rendered", "status"],
        });

        await emit("page.analyzing", { url });
        const brain = await retrieveMemories({ orgId, query: evidence.text.slice(0, 500), scope: "internal" });
        const findings = await analyzePage(evidence, brain, runId);

        for (const f of findings) {
          f.eval = await evaluateFinding(f, evidence, seenTitles);
          seenTitles.add(f.title.toLowerCase());
          rawFindings.push(f);
          await bumpCounter(runId, "findingsCreated");
          await emit("finding.created", { id: f.id, title: f.title });
          await emit("finding.evaluated", { id: f.id, eval: f.eval });
          await saveFindingPacket(orgId, f);
        }

        await bumpCounter(runId, "pagesAnalyzed");
        await emit("page.analyzed", { url, findings: findings.length });
      } catch (err) {
        await bumpCounter(runId, "failures");
        captureHandled(err, { runId, orgId, toolName: "audit.page" });
        await emit("page.failed", {
          url,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await emit("audit.synthesizing", {});
    const report = await synthesize(runId, orgId, targetUrl, rawFindings, evidenceByUrl);

    await writeRunMeta({
      id: runId,
      orgId,
      targetUrl,
      status: "completed",
      limit,
      pagesDiscovered: pages.length,
      pagesRendered: evidenceByUrl.size,
      pagesAnalyzed: evidenceByUrl.size,
      findingsCount: report.topFindings.length,
      startedAt: report.runId ? new Date().toISOString() : new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    await emit("audit.complete", {
      findingsShown: report.metrics.findingsShown,
      findingsFiltered: report.metrics.findingsFiltered,
    });

    return report;
  });
}

/**
 * Analyze one rendered page against brain context. Calls the audit model with
 * buildAnalyzePrompt and parses JSON findings; when no API key is configured it
 * falls back to a deterministic comparison so the pipeline still runs.
 *
 * Every model finding is grounded before it is kept: if it cites a quote that
 * does not appear in the page text, the quote is dropped so the quality gate
 * filters it as ungrounded rather than trusting a hallucinated citation.
 */
async function analyzePage(
  page: RenderedPageEvidence,
  brain: Awaited<ReturnType<typeof retrieveMemories>>,
  runId: string
): Promise<AuditFinding[]> {
  return traced(SPAN.analyzePage, { "page.url": page.url }, async () => {
    const prompt = buildAnalyzePrompt(page, brain);
    const raw = await complete({
      model: auditModel(),
      system: "You are a precise website auditor. Output only a JSON array of findings.",
      prompt,
      maxTokens: 3000,
      purpose: "audit",
    });

    if (raw === null) {
      // No model configured: deterministic internal-vs-external comparison.
      return heuristicFindings(page, brain, runId);
    }

    const parsed = extractJsonArray(raw);
    return parsed
      .map((item) => coerceFinding(item, page, runId))
      .filter((f): f is AuditFinding => f !== null)
      .slice(0, 5);
  });
}

/** Map a loosely-typed model object onto a grounded AuditFinding. */
function coerceFinding(
  item: unknown,
  page: RenderedPageEvidence,
  runId: string
): AuditFinding | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : "");

  const title = str(o.title);
  if (!title) return null;

  const quote = str(o.quote || (o.evidence as Record<string, unknown>)?.quote);
  // Grounding check: only keep a quote that actually appears on the page.
  const groundedQuote = quote && page.text.includes(quote) ? quote : undefined;

  const severity: AuditFinding["severity"] =
    o.severity === "high" || o.severity === "low" ? o.severity : "medium";

  return {
    id: crypto.randomUUID(),
    runId,
    pageUrl: page.url,
    title,
    category: (str(o.category) || "missing_public_explanation") as AuditFinding["category"],
    severity,
    confidence: typeof o.confidence === "number" ? o.confidence : 0.6,
    evidence: {
      quote: groundedQuote,
      selector: str((o.evidence as Record<string, unknown>)?.selector) || undefined,
      screenshotUrl: page.screenshotUrl,
      sourceType: groundedQuote ? "browser" : "comparison",
    },
    reasoning: str(o.reasoning),
    businessImpact: str(o.businessImpact || o.business_impact),
    recommendedFix: str(o.recommendedFix || o.recommended_fix),
  };
}

/** Deterministic fallback: internal program present in brain but absent from page. */
function heuristicFindings(
  page: RenderedPageEvidence,
  brain: Awaited<ReturnType<typeof retrieveMemories>>,
  runId: string
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const mem of brain) {
    for (const entity of mem.entities) {
      if (entity.length > 4 && !page.text.toLowerCase().includes(entity.toLowerCase())) {
        findings.push({
          id: crypto.randomUUID(),
          runId,
          pageUrl: page.url,
          title: `Page does not mention "${entity}"`,
          category: "missing_public_explanation",
          severity: "medium",
          confidence: 0.7,
          evidence: { quote: page.title, sourceType: "comparison" },
          reasoning: `The internal brain references "${entity}" but this page never explains it.`,
          businessImpact: "Visitors and AI search engines cannot learn that the organization offers this.",
          recommendedFix: `Add a clear section or page describing "${entity}".`,
          sourceComparison: {
            internalClaim: mem.summary ?? mem.content,
            externalClaim: "(absent from page)",
            internalSourceId: mem.id,
            externalSourceUrl: page.url,
          },
        });
        break;
      }
    }
  }
  return findings.slice(0, 3);
}

async function synthesize(
  runId: string,
  orgId: string,
  targetUrl: string,
  rawFindings: AuditFinding[],
  evidenceByUrl: Map<string, RenderedPageEvidence>
): Promise<AuditReport> {
  return traced(SPAN.synthesize, { "target.url": targetUrl }, async () => {
    const { shown, filtered } = partitionFindings(rawFindings);
    const top = [...shown]
      .sort((a, b) => severityRank(b) - severityRank(a) || b.confidence - a.confidence)
      .slice(0, 5);

    const avg =
      shown.length > 0
        ? shown.reduce((s, f) => s + f.confidence, 0) / shown.length
        : 0;

    // Pull brain context for the synthesis summary.
    const brainContext = await retrieveMemories({ orgId, query: targetUrl, limit: 4 });
    const brainSummary = brainContext
      .map((m) => `${m.title}: ${m.summary ?? m.content.slice(0, 200)}`)
      .join(" | ");

    // Ask the model for an executive summary grounded in the findings.
    const summaryText =
      (await complete({
        model: auditModel(),
        system: "You are a concise, company-aware AI employee. Output only plain text.",
        prompt: buildSynthesisPrompt(targetUrl, shown, brainSummary),
        maxTokens: 300,
        purpose: "audit",
      })) ??
      `Found ${shown.length} grounded issues across ${evidenceByUrl.size} pages. ${filtered.length} low-quality findings were filtered out.`;

    // Derive recommended actions from the top findings. One action per
    // unique category so the list stays actionable, not overwhelming.
    const actions = deriveActions(top);

    const report: AuditReport & { quadChain?: QuadChainPacketSummary } = {
      runId,
      orgId,
      targetUrl,
      summary: summaryText,
      topFindings: top,
      allFindings: shown,
      recommendedActions: actions,
      metrics: {
        pagesAnalyzed: evidenceByUrl.size,
        findingsShown: shown.length,
        findingsFiltered: filtered.length,
        averageConfidence: Number(avg.toFixed(2)),
      },
    };
    const reportPacket = await saveAuditPacket({
      orgId,
      runId,
      type: "audit_report",
      producer: "quad.audit_worker",
      consumer: "quad.dashboard",
      sourceId: `${runId}:audit_report`,
      sourceKind: "artifact",
      sourceContent: {
        summary: summaryText,
        metrics: report.metrics,
        findingIds: top.map((finding) => finding.id),
      },
      output: [
        `audit report for ${targetUrl}`,
        summaryText,
        `findings shown ${shown.length}`,
        `findings filtered ${filtered.length}`,
      ].join("\n"),
      evidenceQuote: summaryText,
      answerConcepts: ["audit", "report"],
    });
    if (reportPacket) report.quadChain = reportPacket;

    // Persist the full report in Redis so post-audit chat can load it by runId.
    const redis = getRedis();
    if (redis) {
      await redis.set(
        metaKeys.auditRun(`${runId}:report`),
        JSON.stringify(report),
        { ex: eventTtlSeconds() }
      );
    }

    return report;
  });
}

async function saveFindingPacket(orgId: string, finding: AuditFinding): Promise<QuadChainPacketSummary | null> {
  return saveAuditPacket({
    orgId,
    runId: finding.runId,
    type: "finding",
    producer: "quad.audit_analyzer",
    consumer: "quad.findings_panel",
    sourceId: finding.id,
    sourceKind: "finding",
    sourceContent: finding,
    output: [
      `finding: ${finding.title}`,
      `fix: ${finding.recommendedFix}`,
      finding.evidence.quote ? `evidence: ${finding.evidence.quote}` : "evidence: needs human review",
    ].join("\n"),
    evidenceQuote: finding.evidence.quote,
    answerConcepts: ["finding", "fix"],
  });
}

async function saveAuditPacket(input: {
  orgId: string;
  runId: string;
  type: "audit_event" | "audit_report" | "finding";
  producer: string;
  consumer: string;
  sourceId: string;
  sourceKind: "event" | "artifact" | "finding" | "tool_result";
  sourceContent: unknown;
  output: string;
  evidenceQuote?: string;
  answerConcepts: string[];
}): Promise<QuadChainPacketSummary | null> {
  try {
    const packet = createQuadChainPacket({
      type: input.type,
      orgId: input.orgId,
      runId: input.runId,
      producer: input.producer,
      consumer: input.consumer,
      sources: [{ id: input.sourceId, kind: input.sourceKind, content: input.sourceContent }],
      evidence: input.evidenceQuote
        ? [{ id: `${input.sourceId}:quote`, sourceId: input.sourceId, quote: input.evidenceQuote, required: true }]
        : [],
      output: input.output,
      answerConcepts: input.answerConcepts,
      visibility: "internal",
    });
    const result = await saveQuadChainPacket(packet);
    return result.summary;
  } catch (err) {
    captureHandled(err, { runId: input.runId, orgId: input.orgId, toolName: "quadchain.audit_packet" });
    return null;
  }
}

/** Derive one RecommendedAction per unique finding category (max 5). */
function deriveActions(findings: AuditFinding[]): RecommendedAction[] {
  const seen = new Set<string>();
  const actions: RecommendedAction[] = [];

  for (const f of findings) {
    if (seen.has(f.category)) continue;
    seen.add(f.category);

    const type = categoryToActionType(f.category);
    actions.push({
      id: crypto.randomUUID(),
      type,
      title: f.title,
      description: f.recommendedFix,
      input: { findingId: f.id, pageUrl: f.pageUrl, fix: f.recommendedFix },
      requiresApproval: true,
    });

    if (actions.length >= 5) break;
  }

  return actions;
}

function categoryToActionType(category: string): RecommendedAction["type"] {
  if (category === "missing_faq") return "draft_faq";
  if (category === "thin_page" || category === "missing_public_explanation") return "draft_page";
  if (category === "internal_external_mismatch") return "save_memory";
  return "create_task";
}

function severityRank(f: AuditFinding): number {
  return f.severity === "high" ? 3 : f.severity === "medium" ? 2 : 1;
}
