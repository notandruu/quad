import { NextResponse } from "next/server";
import { ingestMemoryWithReceipt } from "@/lib/brain";
import { buildQuadCoreContext, saveQuadCoreReceipt } from "@/lib/core";
import { runQuadCoreCommand } from "@/lib/core/run";
import { getEmployee } from "@/lib/employees";
import { getDeepgramSettings, transcribeWithDeepgram } from "@/lib/voice/deepgram";
import { createEvidenceBundle, summarizeEvidenceBundle } from "@/lib/storage/evidence";
import { DEMO_ORG_ID } from "@/data/seed";
import type { QuadChainPacketSummary } from "@/lib/quad-chain";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import {
  buildRequestFingerprint,
  checkMutationGuards,
  idempotencyReplayBody,
  mutationGuardError,
  saveIdempotentResult,
} from "@/lib/security/mutations";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const settings = getDeepgramSettings();
  if (!settings.configured || !settings.apiKey) {
    return NextResponse.json({ error: "Deepgram is not configured." }, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Invalid multipart upload." }, { status: 400 });
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "Missing audio upload." }, { status: 400 });
  }
  if (audio.size <= 0 || audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio upload is empty or too large." }, { status: 413 });
  }
  const orgId = typeof form.get("orgId") === "string" ? String(form.get("orgId")) : DEMO_ORG_ID;
  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: orgId,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }
  const runId = typeof form.get("runId") === "string" ? String(form.get("runId")) : `voice_${crypto.randomUUID()}`;
  const fingerprint = buildRequestFingerprint({
    runId,
    audioType: audio.type || "application/octet-stream",
    audioSize: audio.size,
  });
  const guard = await checkMutationGuards({
    orgId: auth.orgId,
    route: "voice.transcribe",
    headers: request.headers,
    fingerprint,
    limit: 10,
  });
  if (!guard.ok) {
    return NextResponse.json(mutationGuardError(guard), { status: guard.status });
  }
  if (guard.replay) {
    return NextResponse.json(idempotencyReplayBody(guard.replay), { status: guard.replay.status });
  }

  try {
    const audioBytes = await audio.arrayBuffer();
    const audioEvidence = summarizeEvidenceBundle(await createEvidenceBundle({
      orgId: auth.orgId,
      runId,
      kind: "voice_audio",
      storageMode: "external_provider",
      mimeType: audio.type || "application/octet-stream",
      byteLength: audio.size,
      bytes: audioBytes,
      visibility: "restricted",
      classification: "confidential",
      metadata: {
        provider: "deepgram",
        model: settings.sttModel,
      },
    }));
    const result = await transcribeWithDeepgram({
      audio,
      mimeType: audio.type || "application/octet-stream",
      apiKey: settings.apiKey,
      model: settings.sttModel,
    });

    const transcript = result.transcript.trim();
    const coreContext = await buildQuadCoreContext({
      orgId: auth.orgId,
      employee: getEmployee(),
      text: transcript || "voice transcript",
      surface: "voice",
      runId,
    });
    const transcriptPacket = await saveQuadCoreReceipt({
      context: coreContext,
      type: "voice_transcript",
      output: `voice transcript: ${result.transcript}`,
      producer: "quad.voice.deepgram",
      consumer: "quad.chat",
      sources: [
        {
          id: "voice_audio",
          kind: "transcript",
          content: {
            mimeType: audio.type || "application/octet-stream",
            size: audio.size,
            model: settings.sttModel,
            evidenceBundle: audioEvidence,
          },
        },
      ],
      answerConcepts: ["voice", "transcript"],
      visibility: "restricted",
    });
    const quadChain: QuadChainPacketSummary[] = [transcriptPacket];
    let memory: { id: string; title: string } | null = null;
    let assistant: {
      message: string;
      intent: string;
      requiresApproval: boolean;
      detectedUrl: string | null;
      quadChain: QuadChainPacketSummary;
      verifiedContext: QuadChainPacketSummary[];
    } | null = null;

    if (shouldRememberTranscript(form) && transcript) {
      const memoryResult = await ingestMemoryWithReceipt({
        orgId: auth.orgId,
        sourceId: runId,
        sourceType: "meeting",
        title: "Voice-captured company context",
        content: transcript,
        summary: transcript.slice(0, 240),
        entities: ["voice", "company_context"],
        confidence: normalizeConfidence(result.confidence),
        permissions: ["internal"],
        visibility: "company",
        evidence: [
          {
            quote: transcript,
          },
        ],
      });
      memory = { id: memoryResult.memory.id, title: memoryResult.memory.title };
      quadChain.push(memoryResult.quadChain);
    }

    if (transcript) {
      const coreResult = await runQuadCoreCommand({
        command: "chat",
        orgId: auth.orgId,
        runId,
        text: transcript,
        surface: "voice",
        hasActiveAudit: typeof form.get("runId") === "string",
      });
      if (coreResult.command !== "chat") {
        throw new Error("Voice runtime returned a non-chat result.");
      }
      assistant = {
        message: coreResult.message,
        intent: coreResult.intent,
        requiresApproval: coreResult.requiresApproval,
        detectedUrl: coreResult.detectedUrl,
        quadChain: coreResult.quadChain,
        verifiedContext: coreResult.verifiedContext,
      };
      quadChain.push(coreResult.quadChain);
    }

    const responseBody = { ...result, memory, assistant, quadChain, evidenceBundle: audioEvidence };
    await saveIdempotentResult({
      orgId: auth.orgId,
      route: "voice.transcribe",
      headers: request.headers,
      fingerprint,
      body: responseBody,
    });
    return NextResponse.json(responseBody);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription failed." },
      { status: 502 }
    );
  }
}

function shouldRememberTranscript(form: FormData): boolean {
  const raw = form.get("remember");
  if (raw === null) return true;
  return !["0", "false", "no", "off"].includes(String(raw).toLowerCase());
}

function normalizeConfidence(value: number | null): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0.72;
  return Math.max(0, Math.min(1, value));
}
