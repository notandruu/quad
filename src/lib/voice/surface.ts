export type VoiceSurfaceMode =
  | "deepgram_stt"
  | "moshi_full_duplex"
  | "browser_speech_fallback"
  | "unavailable";

export type VoiceSurfaceCapability = {
  mode: VoiceSurfaceMode;
  label: string;
  detail: string;
  canListen: boolean;
  canSpeak: boolean;
};

export function buildVoiceSurfaceCapability(input: {
  deepgramConfigured: boolean;
  moshiConfigured: boolean;
  browserSpeechSupported: boolean;
  secureContext: boolean;
}): VoiceSurfaceCapability {
  if (!input.secureContext) {
    return {
      mode: "unavailable",
      label: "Voice unavailable",
      detail: "Microphone access requires HTTPS or localhost.",
      canListen: false,
      canSpeak: false,
    };
  }

  if (input.deepgramConfigured) {
    return {
      mode: "deepgram_stt",
      label: "Voice mode",
      detail: "Deepgram speech-to-text is configured for push-to-talk commands.",
      canListen: true,
      canSpeak: false,
    };
  }

  if (input.moshiConfigured) {
    return {
      mode: "moshi_full_duplex",
      label: "Voice mode",
      detail: "Moshi websocket configured for full-duplex voice transport.",
      canListen: true,
      canSpeak: true,
    };
  }

  if (input.browserSpeechSupported) {
    return {
      mode: "browser_speech_fallback",
      label: "Voice mode",
      detail: "Browser speech recognition is active while Moshi is unconfigured.",
      canListen: true,
      canSpeak: false,
    };
  }

  return {
    mode: "unavailable",
    label: "Voice unavailable",
    detail: "Configure Moshi or use a browser with speech recognition.",
    canListen: false,
    canSpeak: false,
  };
}
