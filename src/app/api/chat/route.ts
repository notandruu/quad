import { NextRequest, NextResponse } from "next/server";
import { runEmployee } from "@/lib/runtime/runtime";
import { getEmployee } from "@/lib/employees";
import { DEMO_ORG_ID } from "@/data/seed";
import { withSpan } from "@/lib/observability/sentry";
import { retrieveMemories } from "@/lib/brain";
import { complete, chatModel } from "@/lib/llm/anthropic";
import { buildAuditChatSystemPrompt } from "@/lib/runtime/prompts";
import type { AuditReport } from "@/lib/types";
import { loadCachedReport } from "@/lib/runtime/reportCache";
import { createQuadChainPacket, summarizeQuadChainPacket, type QuadChainPacketSummary } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";

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
    // If there's a runId, try the audit-grounded path first.
    if (runId) {
      const report = await loadCachedReport(runId);
      if (report) {
        const reply = await auditGroundedChat(text, orgId, employee, report);
        const quadChain = await saveChatPacket({
          orgId,
          runId,
          text,
          reply,
          producer: "quad.chat",
          consumer: "quad.dashboard",
          sources: [
            { id: `${runId}:audit_report`, kind: "artifact", content: { summary: report.summary, metrics: report.metrics } },
            ...report.topFindings.slice(0, 5).map((finding) => ({
              id: finding.id,
              kind: "finding" as const,
              content: {
                title: finding.title,
                quote: finding.evidence.quote,
                fix: finding.recommendedFix,
              },
            })),
          ],
        });
        return NextResponse.json({ message: reply, intent: "audit_follow_up", quadChain });
      }
    }

    // Normal employee runtime path.
    const effectiveRunId = runId || crypto.randomUUID();
    const result = await runEmployee({
      orgId,
      employee,
      runId: effectiveRunId,
      text,
      pinnedUrl: body.pinnedUrl,
      hasActiveAudit: body.hasActiveAudit,
    });
    const quadChain = await saveChatPacket({
      orgId,
      runId: effectiveRunId,
      text,
      reply: result.message,
      producer: `quad.${employee.id}`,
      consumer: "quad.dashboard",
      sources: [
        { id: "chat_input", kind: "event", content: { text } },
        ...result.context.slice(0, 6).map((memory) => ({
          id: memory.id,
          kind: "memory" as const,
          content: {
            title: memory.title,
            sourceType: memory.sourceType,
            summary: memory.summary,
            evidence: memory.evidence,
          },
        })),
      ],
    });
    return NextResponse.json({ ...result, quadChain });
  });
}

async function saveChatPacket(input: {
  orgId: string;
  runId: string;
  text: string;
  reply: string;
  producer: string;
  consumer: string;
  sources: Array<{ id: string; kind: "event" | "artifact" | "finding" | "memory"; content: unknown }>;
}): Promise<QuadChainPacketSummary | null> {
  try {
    const packet = createQuadChainPacket({
      type: "chat_answer",
      orgId: input.orgId,
      runId: input.runId,
      producer: input.producer,
      consumer: input.consumer,
      sources: input.sources,
      output: [
        `user: ${input.text}`,
        `answer: ${input.reply}`,
      ].join("\n"),
      answerConcepts: ["answer"],
      visibility: "internal",
    });
    const result = await saveQuadChainPacket(packet);
    return summarizeQuadChainPacket(packet) ?? result.summary;
  } catch {
    return null;
  }
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
    purpose: "chat",
  });

  return reply ?? `Based on the audit of ${report.targetUrl}: ${report.summary}`;
}
