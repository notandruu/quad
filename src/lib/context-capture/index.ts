import { createHash } from "crypto";
import { proposeMemoryWrite, type ProposeMemoryWriteResult } from "@/lib/brain";
import { appendTaskEvent, getRunSnapshot } from "@/lib/runs";
import type { SourceType } from "@/lib/types";

export type ContextCaptureEvent = {
  id: string;
  sourceType: SourceType;
  text: string;
  actor?: string;
  createdAt?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ContextCaptureSignal = {
  id: string;
  sourceEventId: string;
  sourceId: string;
  sourceType: SourceType;
  claim: string;
  category: "metric" | "decision" | "deadline" | "policy" | "program" | "customer" | "risk" | "other";
  sourceQuote: string;
  confidence: number;
  reason: string;
  suggestedVisibility: "company" | "team" | "personal";
};

export type ContextCaptureNoise = {
  id: string;
  sourceEventId: string;
  reason: "too_short" | "question" | "chit_chat" | "speculation" | "low_signal";
  textSummary: string;
};

export type ContextCaptureResult = {
  captureId: string;
  orgId: string;
  runId: string | null;
  sourceName: string;
  generatedAt: string;
  events: number;
  signals: ContextCaptureSignal[];
  noise: ContextCaptureNoise[];
  summary: {
    signalCount: number;
    noiseCount: number;
    averageConfidence: number;
    categories: Record<string, number>;
    suggestedWriteCount: number;
  };
};

export type ContextCaptureProposal = {
  signalId: string;
  sourceId: string;
  proposal: ProposeMemoryWriteResult;
};

export type ContextCaptureWithProposals = ContextCaptureResult & {
  proposals: ContextCaptureProposal[];
};

export function captureContextEvents(input: {
  orgId: string;
  runId?: string | null;
  sourceName?: string;
  events: ContextCaptureEvent[];
  now?: string;
}): ContextCaptureResult {
  const generatedAt = input.now ?? new Date().toISOString();
  const sourceName = input.sourceName ?? "runtime events";
  const signals: ContextCaptureSignal[] = [];
  const noise: ContextCaptureNoise[] = [];
  const seenClaims = new Set<string>();

  for (const event of input.events) {
    const text = normalizeText(event.text);
    const classification = classifyEventText(text);
    if (classification.kind === "noise") {
      noise.push({
        id: `noise_${shortHash(input.orgId, event.id, classification.reason, text)}`,
        sourceEventId: event.id,
        reason: classification.reason,
        textSummary: summarizeText(text),
      });
      continue;
    }

    const claim = toClaim(text);
    const key = claim.toLowerCase();
    if (seenClaims.has(key)) continue;
    seenClaims.add(key);
    const category = guessCategory(claim);
    const sourceId = `context_capture:${input.orgId}:${shortHash(sourceName, claim)}`;
    signals.push({
      id: `signal_${shortHash(input.orgId, event.id, claim)}`,
      sourceEventId: event.id,
      sourceId,
      sourceType: event.sourceType,
      claim,
      category,
      sourceQuote: text,
      confidence: classification.confidence,
      reason: classification.reason,
      suggestedVisibility: event.sourceType === "meeting" || event.sourceType === "slack" || event.sourceType === "email"
        ? "company"
        : "team",
    });
  }

  const result = {
    captureId: `capture_${shortHash(input.orgId, sourceName, generatedAt, signals.map((signal) => signal.id).join(","))}`,
    orgId: input.orgId,
    runId: input.runId ?? null,
    sourceName,
    generatedAt,
    events: input.events.length,
    signals,
    noise,
    summary: summarizeCapture(signals, noise),
  };

  recordCaptureTaskEvents(result);
  return result;
}

export async function proposeContextCaptureWrites(input: {
  capture: ContextCaptureResult;
  requestedBy?: "dashboard" | "agent" | "system";
  limit?: number;
}): Promise<ContextCaptureWithProposals> {
  const limit = Math.max(0, Math.min(input.limit ?? 5, 10));
  const proposals: ContextCaptureProposal[] = [];

  for (const signal of input.capture.signals.slice(0, limit)) {
    const proposal = await proposeMemoryWrite({
      orgId: input.capture.orgId,
      sourceId: signal.sourceId,
      sourceType: signal.sourceType,
      title: `Captured context: ${truncate(signal.claim, 72)}`,
      content: signal.claim,
      summary: signal.claim,
      entities: [signal.category, "context_capture"],
      confidence: signal.confidence,
      visibility: signal.suggestedVisibility,
      validationStatus: signal.confidence >= 0.82 ? "verified" : "unverified",
      sourceUpdatedAt: input.capture.generatedAt,
      evidence: [
        {
          quote: signal.sourceQuote,
          documentId: input.capture.runId ?? input.capture.captureId,
        },
      ],
      relatedSourceIds: [signal.sourceEventId],
      requestedBy: input.requestedBy ?? "agent",
      reason: `Context capture signal: ${signal.reason}`,
    });
    proposals.push({ signalId: signal.id, sourceId: signal.sourceId, proposal });
    recordProposalTaskEvent(input.capture, signal, proposal);
  }

  return { ...input.capture, proposals };
}

function recordProposalTaskEvent(
  capture: ContextCaptureResult,
  signal: ContextCaptureSignal,
  proposal: ProposeMemoryWriteResult
): void {
  if (!capture.runId || !getRunSnapshot(capture.runId)) return;
  appendTaskEvent({
    runId: capture.runId,
    kind: "memory.proposed",
    actor: "quad",
    message: `Staged captured memory for approval: ${truncate(signal.claim, 96)}`,
    approvalId: proposal.approvalId,
    artifactId: proposal.artifact.id,
    receiptId: proposal.receipt.id,
    status: proposal.approval.decision,
    payloadSummary: {
      sourceId: signal.sourceId,
      confidence: signal.confidence,
      visibility: signal.suggestedVisibility,
    },
  });
}

export function summarizeContextCapture(capture: ContextCaptureResult) {
  return {
    captureId: capture.captureId,
    orgId: capture.orgId,
    runId: capture.runId,
    sourceName: capture.sourceName,
    generatedAt: capture.generatedAt,
    events: capture.events,
    signalCount: capture.summary.signalCount,
    noiseCount: capture.summary.noiseCount,
    averageConfidence: capture.summary.averageConfidence,
    categories: capture.summary.categories,
    suggestedWriteCount: capture.summary.suggestedWriteCount,
    latestSignals: capture.signals.slice(0, 5).map((signal) => ({
      id: signal.id,
      sourceId: signal.sourceId,
      sourceType: signal.sourceType,
      claim: signal.claim,
      category: signal.category,
      confidence: signal.confidence,
      suggestedVisibility: signal.suggestedVisibility,
    })),
    noiseReasons: capture.noise.reduce<Record<string, number>>((acc, item) => {
      acc[item.reason] = (acc[item.reason] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

function classifyEventText(text: string):
  | { kind: "signal"; confidence: number; reason: string }
  | { kind: "noise"; reason: ContextCaptureNoise["reason"] } {
  if (text.length < 24) return { kind: "noise", reason: "too_short" };
  if (/^(hi|hello|hey|thanks|thank you|sounds good|ok|okay|cool|lol|lmao)[.! ]*$/i.test(text)) {
    return { kind: "noise", reason: "chit_chat" };
  }
  if (/\?$/.test(text) && !/\d|deadline|approved|policy|must|launch|signed|blocked/i.test(text)) {
    return { kind: "noise", reason: "question" };
  }
  if (/\b(maybe|might|could|i think|probably|possibly)\b/i.test(text) && !/\bapproved|decided|signed|deadline\b/i.test(text)) {
    return { kind: "noise", reason: "speculation" };
  }

  const score = [
    /\d|%|percent|kpi|sla|soc ?2|hipaa|gdpr/i,
    /\b(deadline|by [a-z]+ \d|launch|go live|ship|due)\b/i,
    /\b(approved|decided|signed|blocked|requires|must|policy)\b/i,
    /\b(customer|buyer|security|compliance|audit|questionnaire|trust)\b/i,
  ].reduce((sum, pattern) => sum + (pattern.test(text) ? 1 : 0), 0);

  if (score === 0) return { kind: "noise", reason: "low_signal" };
  return {
    kind: "signal",
    confidence: Math.min(0.96, 0.68 + score * 0.08),
    reason: score >= 3 ? "high-confidence durable company signal" : "durable company signal",
  };
}

function summarizeCapture(signals: ContextCaptureSignal[], noise: ContextCaptureNoise[]): ContextCaptureResult["summary"] {
  const averageConfidence = signals.length === 0
    ? 0
    : round(signals.reduce((sum, signal) => sum + signal.confidence, 0) / signals.length);
  const categories = signals.reduce<Record<string, number>>((acc, signal) => {
    acc[signal.category] = (acc[signal.category] ?? 0) + 1;
    return acc;
  }, {});
  return {
    signalCount: signals.length,
    noiseCount: noise.length,
    averageConfidence,
    categories,
    suggestedWriteCount: signals.filter((signal) => signal.confidence >= 0.76).length,
  };
}

function recordCaptureTaskEvents(capture: ContextCaptureResult): void {
  if (!capture.runId || !getRunSnapshot(capture.runId)) return;
  for (const signal of capture.signals.slice(0, 10)) {
    appendTaskEvent({
      runId: capture.runId,
      kind: "memory.candidate",
      actor: "quad",
      message: `Captured memory candidate: ${truncate(signal.claim, 96)}`,
      payloadSummary: {
        sourceId: signal.sourceId,
        category: signal.category,
        confidence: signal.confidence,
        visibility: signal.suggestedVisibility,
      },
    });
  }
  if (capture.noise.length > 0) {
    appendTaskEvent({
      runId: capture.runId,
      kind: "memory.noise",
      actor: "quad",
      message: `Filtered ${capture.noise.length} noisy context event${capture.noise.length === 1 ? "" : "s"}.`,
      payloadSummary: {
        noiseCount: capture.noise.length,
      },
    });
  }
}

function guessCategory(text: string): ContextCaptureSignal["category"] {
  if (/\bdeadline|due|go live|launch|ship\b/i.test(text)) return "deadline";
  if (/\d|%|percent|kpi|sla|latency|uptime|completion/i.test(text)) return "metric";
  if (/\bapproved|decided|signed|blocked\b/i.test(text)) return "decision";
  if (/\bpolicy|must|required|soc ?2|hipaa|gdpr|security|compliance\b/i.test(text)) return "policy";
  if (/\bcustomer|buyer|account|deal|renewal\b/i.test(text)) return "customer";
  if (/\brisk|incident|breach|failure|blocked\b/i.test(text)) return "risk";
  if (/\bprogram|project|initiative|course|training\b/i.test(text)) return "program";
  return "other";
}

function toClaim(text: string): string {
  const normalized = normalizeText(text.replace(/^[^:]{1,40}:\s*/, ""));
  return /[.!]$/.test(normalized) ? normalized : `${normalized}.`;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function summarizeText(text: string): string {
  return truncate(normalizeText(text), 120);
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function shortHash(...parts: unknown[]): string {
  const hash = createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex");
  return hash.slice(0, 16);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
