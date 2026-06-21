import { NextResponse } from "next/server";
import { ingestMemoryWithReceipt } from "@/lib/brain";
import { buildQuadCoreContext, saveQuadCoreReceipt } from "@/lib/core";
import { getEmployee } from "@/lib/employees";
import { getDeepgramSettings, transcribeWithDeepgram } from "@/lib/voice/deepgram";
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
          },
        },
      ],
      answerConcepts: ["voice", "transcript"],
      visibility: "restricted",
    });
    const quadChain: QuadChainPacketSummary[] = [transcriptPacket];
    let memory: { id: string; title: string } | null = null;

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
        evidence: [
          {
            quote: transcript,
          },
        ],
      });
      memory = { id: memoryResult.memory.id, title: memoryResult.memory.title };
      quadChain.push(memoryResult.quadChain);
    }

    const responseBody = { ...result, memory, quadChain };
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
