import type { VoiceSession, VoiceTurn } from "@/lib/types";

export type MoshiDeployment = "self_hosted" | "unconfigured";

export type MoshiSettings = {
  configured: boolean;
  deployment: MoshiDeployment;
  serverUrl: string | null;
  publicClientUrl: string | null;
  mode: "push_to_talk";
  decision: string;
  nextAction: string;
};

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

/**
 * Product decision: use a self-hosted Moshi websocket. Kyutai's official path
 * is open-source/self-host; public demos are not a stable production backend.
 */
export function getMoshiSettings(env: Partial<NodeJS.ProcessEnv> = process.env): MoshiSettings {
  const serverUrl = normalizeWsUrl(env.MOSHI_SERVER_URL);
  const publicClientUrl = normalizeWsUrl(env.NEXT_PUBLIC_MOSHI_SERVER_URL);
  const configured = Boolean(serverUrl);

  return {
    configured,
    deployment: configured ? "self_hosted" : "unconfigured",
    serverUrl,
    publicClientUrl,
    mode: "push_to_talk",
    decision: configured
      ? "Self-hosted Moshi is configured for push-to-talk."
      : "Moshi should be self-hosted behind a websocket endpoint before voice is enabled.",
    nextAction: configured
      ? "Verify mic capture, websocket streaming, transcript events, and playback latency."
      : "Provision a Moshi server and set MOSHI_SERVER_URL. Add NEXT_PUBLIC_MOSHI_SERVER_URL only if the browser can connect directly.",
  };
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

export function buildVoiceTurn(
  speaker: VoiceTurn["speaker"],
  text: string,
  confidence?: number
): VoiceTurn {
  return {
    id: crypto.randomUUID(),
    speaker,
    text,
    confidence,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
  };
}

function normalizeWsUrl(value?: string): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "ws:" && url.protocol !== "wss:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Transport boundary. The browser PTT control streams audio to the configured
 * public websocket when available; server-side callers fail fast until the
 * Moshi endpoint is provisioned.
 */
export async function connectMoshi(_session: VoiceSession): Promise<void> {
  const settings = getMoshiSettings();
  if (!settings.configured) {
    throw new Error(settings.nextAction);
  }

  throw new Error(
    "Moshi server is configured, but the binary websocket audio protocol still needs integration."
  );
}
