import { NextResponse } from "next/server";
import { getDeepgramSettings, transcribeWithDeepgram } from "@/lib/voice/deepgram";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  const settings = getDeepgramSettings();
  if (!settings.configured || !settings.apiKey) {
    return NextResponse.json({ error: "Deepgram is not configured." }, { status: 503 });
  }

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "Missing audio upload." }, { status: 400 });
  }
  if (audio.size <= 0 || audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "Audio upload is empty or too large." }, { status: 413 });
  }

  try {
    const result = await transcribeWithDeepgram({
      audio,
      mimeType: audio.type || "application/octet-stream",
      apiKey: settings.apiKey,
      model: settings.sttModel,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription failed." },
      { status: 502 }
    );
  }
}
