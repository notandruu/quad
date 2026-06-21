import { NextRequest, NextResponse } from "next/server";
import { runEmployee } from "@/lib/runtime/runtime";
import { getEmployee } from "@/lib/employees";
import { DEMO_ORG_ID } from "@/data/seed";
import { withSpan } from "@/lib/observability/sentry";
import { retrieveMemoriesWithPackets } from "@/lib/brain";
import { complete, chatModel } from "@/lib/llm/anthropic";
import { buildAuditChatSystemPrompt } from "@/lib/runtime/prompts";
import type { AuditReport, BrainMemory } from "@/lib/types";
import { loadCachedReport } from "@/lib/runtime/reportCache";
import { buildQuadCoreContext, saveQuadCoreReceipt } from "@/lib/core";
import type { QuadChainPacketSummary, QuadChainSource } from "@/lib/quad-chain";

export const runtime = "nodejs";
// Grounded chat makes a model call; give it headroom over the serverless default.
export const maxDuration = 60;

/**
 * Chat entrypoint. Two modes:
 *
 * 1. No active audit: classifyIntent -> retrieveMemories -> model reply.
 * 2. Active audit (runId present): load the persisted AuditReport from Redis,
 *    inject it into the system prompt, answer grounded in findings + brain.
 *
 * This is what makes post-audit follow-up ("what should I fix first?",
 * "draft the missing FAQ") actually useful rather than hallucinated.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text: string = body.text ?? "";
  const orgId: string = body.orgId ?? DEMO_ORG_ID;
  const runId: string = body.runId ?? "";
  const employee = getEmployee(body.employeeId);

  return withSpan("chat.request", { orgId, runId, employeeId: employee.id }, async () => {
    const effectiveRunId = runId || crypto.randomUUID();
    const coreContext = await buildQuadCoreContext({
      orgId,
      employee,
      runId: effectiveRunId,
      text,
      surface: "chat",
      pinnedUrl: body.pinnedUrl,
      hasActiveAudit: body.hasActiveAudit || Boolean(runId),
    });

    // If there's a runId, try the audit-grounded path first.
    if (runId) {
      const report = await loadCachedReport(runId);
      if (report) {
        const grounded = await auditGroundedChat(text, orgId, employee, report);
        const quadChain = await saveQuadCoreReceipt({
          context: coreContext,
          output: grounded.reply,
          producer: "quad.chat",
          consumer: "quad.dashboard",
          sources: [
            {
              id: `${runId}:audit_report`,
              kind: "artifact",
              content: { summary: report.summary, metrics: report.metrics },
            },
            ...report.topFindings.slice(0, 5).map((finding) => ({
              id: finding.id,
              kind: "finding" as const,
              content: {
                title: finding.title,
                quote: finding.evidence.quote,
                fix: finding.recommendedFix,
              },
            })),
            ...buildMemorySources(coreContext.memories),
          ] satisfies QuadChainSource[],
        });
        return NextResponse.json({
          message: grounded.reply,
          intent: "audit_follow_up",
          quadChain,
          verifiedContext: grounded.verifiedContext,
        });
      }
    }

    // Normal employee runtime path.
    const result = await runEmployee({
      orgId,
      employee,
      runId: effectiveRunId,
      text,
      pinnedUrl: body.pinnedUrl,
      hasActiveAudit: body.hasActiveAudit,
      surface: "chat",
      coreContext,
    });
    const quadChain = await saveQuadCoreReceipt({
      context: coreContext,
      output: result.message,
      producer: `quad.${employee.id}`,
      consumer: "quad.dashboard",
    });
    return NextResponse.json({ ...result, quadChain });
  });
}

/**
 * Answer a follow-up question grounded in the completed audit report and the
 * company brain. Falls back to a plain text acknowledgement if no model key.
 */
async function auditGroundedChat(
  text: string,
  orgId: string,
  employee: ReturnType<typeof getEmployee>,
  report: AuditReport
): Promise<{ reply: string; verifiedContext: QuadChainPacketSummary[] }> {
  const retrieved = await retrieveMemoriesWithPackets({ orgId, query: text, limit: 5 });
  const brainContext = retrieved.map((item) => item.memory);
  const verifiedContext = retrieved
    .map((item) => item.quadChain)
    .filter((item): item is QuadChainPacketSummary => Boolean(item));

  const system = buildAuditChatSystemPrompt(
    employee.name,
    employee.tone,
    brainContext,
    report.summary,
    report.topFindings.map((f) => ({
      title: f.title,
      severity: f.severity,
      recommendedFix: f.recommendedFix,
      pageUrl: f.pageUrl,
    }))
  );

  const reply = await complete({
    model: chatModel(),
    system,
    prompt: text,
    maxTokens: 1000,
    purpose: "chat",
  });

  return {
    reply: reply ?? `Based on the audit of ${report.targetUrl}: ${report.summary}`,
    verifiedContext,
  };
}

function buildMemorySources(memories: BrainMemory[]): QuadChainSource[] {
  return memories.slice(0, 6).map((item) => ({
    id: item.id,
    kind: "memory",
    content: {
      title: item.title,
      sourceType: item.sourceType,
      summary: item.summary,
      evidence: item.evidence,
    },
  }));
}
