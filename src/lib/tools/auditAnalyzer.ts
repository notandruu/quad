import type {
  AuditFinding,
  AuditReport,
  RenderedPageEvidence,
} from "@/lib/types";
import { publishAuditEvent, bumpCounter, writeRunMeta } from "@/lib/redis";
import { traced, SPAN, evaluateFinding } from "@/lib/observability";
import { captureHandled, withSpan } from "@/lib/observability/sentry";
import { retrieveMemories } from "@/lib/brain";
import { partitionFindings } from "@/lib/runtime/quality";
import { buildAnalyzePrompt } from "@/lib/runtime/prompts";
import { discoverPages } from "./discover";
import { renderPage } from "./browserbase";

export type RunAuditInput = {
  orgId: string;
  runId: string;
  targetUrl: string;
  limit?: number;
};

/**
 * The audit worker. Discovers pages, renders each through Browserbase (with a
 * static fallback), analyzes them against the company brain, evaluates and
 * gates the findings, then synthesizes a report. Emits real Redis events and
 * counters at every step so the live log is never faked.
 */
export async function runAudit(input: RunAuditInput): Promise<AuditReport> {
  const { orgId, runId, targetUrl, limit = 12 } = input;

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
    await publishAuditEvent(runId, "audit.started", { targetUrl, limit });

    const pages = await discoverPages(targetUrl, limit);
    await bumpCounter(runId, "pagesDiscovered", pages.length);
    await publishAuditEvent(runId, "audit.pages_discovered", { count: pages.length });

    const rawFindings: AuditFinding[] = [];
    const evidenceByUrl = new Map<string, RenderedPageEvidence>();
    const seenTitles = new Set<string>();

    for (const url of pages) {
      await publishAuditEvent(runId, "page.queued", { url });
      try {
        await publishAuditEvent(runId, "page.rendering", { url });
        const evidence = await renderPage(url);
        evidenceByUrl.set(url, evidence);
        await bumpCounter(runId, "pagesFetched");
        await publishAuditEvent(runId, "page.rendered", {
          url,
          status: evidence.status,
          screenshotUrl: evidence.screenshotUrl,
        });

        await publishAuditEvent(runId, "page.analyzing", { url });
        const brain = await retrieveMemories({ orgId, query: evidence.text.slice(0, 500), scope: "internal" });
        const findings = await analyzePage(evidence, brain, runId);

        for (const f of findings) {
          f.eval = await evaluateFinding(f, evidence, seenTitles);
          seenTitles.add(f.title.toLowerCase());
          rawFindings.push(f);
          await bumpCounter(runId, "findingsCreated");
          await publishAuditEvent(runId, "finding.created", { id: f.id, title: f.title });
          await publishAuditEvent(runId, "finding.evaluated", { id: f.id, eval: f.eval });
        }

        await bumpCounter(runId, "pagesAnalyzed");
        await publishAuditEvent(runId, "page.analyzed", { url, findings: findings.length });
      } catch (err) {
        await bumpCounter(runId, "failures");
        captureHandled(err, { runId, orgId, toolName: "audit.page" });
        await publishAuditEvent(runId, "page.failed", {
          url,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await publishAuditEvent(runId, "audit.synthesizing", {});
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
    await publishAuditEvent(runId, "audit.complete", {
      findingsShown: report.metrics.findingsShown,
      findingsFiltered: report.metrics.findingsFiltered,
    });

    return report;
  });
}

/**
 * Analyze one rendered page against brain context.
 *
 * TODO: call the audit model (KALI_AUDIT_MODEL) with buildAnalyzePrompt and
 * parse JSON findings. The deterministic stub below derives a couple of
 * grounded findings so the pipeline, evals, and gates run without a model.
 */
async function analyzePage(
  page: RenderedPageEvidence,
  brain: Awaited<ReturnType<typeof retrieveMemories>>,
  runId: string
): Promise<AuditFinding[]> {
  return traced(SPAN.analyzePage, { "page.url": page.url }, async () => {
    const _prompt = buildAnalyzePrompt(page, brain);
    const findings: AuditFinding[] = [];

    // Heuristic 1: internal program mentioned in brain but absent from page.
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
  });
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

    return {
      runId,
      orgId,
      targetUrl,
      summary: `Found ${shown.length} grounded issues across ${evidenceByUrl.size} pages. ${filtered.length} low-quality findings were filtered out.`,
      topFindings: top,
      allFindings: shown,
      recommendedActions: [],
      metrics: {
        pagesAnalyzed: evidenceByUrl.size,
        findingsShown: shown.length,
        findingsFiltered: filtered.length,
        averageConfidence: Number(avg.toFixed(2)),
      },
    };
  });
}

function severityRank(f: AuditFinding): number {
  return f.severity === "high" ? 3 : f.severity === "medium" ? 2 : 1;
}
