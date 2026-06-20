import type { VoiceSession, VoiceTurn } from "@/lib/types";

/**
 * Kyutai Moshi voice layer (future-facing). Moshi is the speech interface, not
 * the brain: it handles low-latency full-duplex audio while the employee
 * runtime stays the reasoning and tool layer.
 *
 * MVP path is push-to-talk. Full duplex is a stretch.
 * Docs: https://github.com/kyutai-labs/moshi
 */
export function isVoiceConfigured(): boolean {
  return Boolean(process.env.MOSHI_SERVER_URL);
}

export function newVoiceSession(
  orgId: string,
  employeeId: string,
  mode: VoiceSession["mode"] = "assistant"
): VoiceSession {
  return {
    id: crypto.randomUUID(),
    orgId,
    employeeId,
    status: "starting",
    mode,
    transcript: [],
    startedAt: new Date().toISOString(),
  };
}

export function appendTurn(session: VoiceSession, turn: VoiceTurn): VoiceSession {
  return { ...session, transcript: [...session.transcript, turn] };
}

/**
 * TODO(jake): open a websocket to MOSHI_SERVER_URL, stream mic audio, emit
 * voice.* events to Redis, forward final transcripts to the employee runtime,
 * and play back the spoken response. Enforce the voice safety rules: never
 * auto-send external messages, confirm high-impact actions, support
 * "save that", "forget that", "pause", and "stop listening".
 */
export async function connectMoshi(_session: VoiceSession): Promise<void> {
  throw new Error("Moshi voice transport not yet implemented");
}
