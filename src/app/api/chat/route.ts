import { NextRequest, NextResponse } from "next/server";
import { runEmployee } from "@/lib/runtime/runtime";
import { getEmployee } from "@/lib/employees";
import { DEMO_ORG_ID } from "@/data/seed";
import { withSpan } from "@/lib/observability/sentry";
import { getRedis, metaKeys } from "@/lib/redis";
import { retrieveMemories } from "@/lib/brain";
import { complete, chatModel } from "@/lib/llm/anthropic";
import { buildAuditChatSystemPrompt } from "@/lib/runtime/prompts";
import type { AuditReport } from "@/lib/types";
import { getCachedReport } from "@/lib/runtime/reportCache";

export const runtime = "nodejs";

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
    // If there's a runId, try the audit-grounded path first.
    if (runId) {
      const report = await loadReport(runId);
      if (report) {
        const reply = await auditGroundedChat(text, orgId, employee, report);
        return NextResponse.json({ message: reply, intent: "audit_follow_up" });
      }
    }

    // Normal employee runtime path.
    const result = await runEmployee({
      orgId,
      employee,
      runId: runId || crypto.randomUUID(),
      text,
      pinnedUrl: body.pinnedUrl,
      hasActiveAudit: body.hasActiveAudit,
    });
    return NextResponse.json(result);
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
): Promise<string> {
  const brainContext = await retrieveMemories({ orgId, query: text, limit: 5 });

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
  });

  return reply ?? `Based on the audit of ${report.targetUrl}: ${report.summary}`;
}

async function loadReport(runId: string): Promise<AuditReport | null> {
  // Try Redis first, fall back to in-memory process cache.
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get<string>(metaKeys.auditRun(`${runId}:report`));
      if (raw) return JSON.parse(raw) as AuditReport;
    } catch {
      // Redis read failed — fall through to in-memory.
    }
  }
  return getCachedReport(runId);
}
