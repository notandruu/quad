"use client";

import { useMemo, useRef, useState } from "react";
import { buildVoiceSurfaceCapability } from "@/lib/voice/surface";
import { appendVoiceTranscriptContext } from "@/lib/voice/upload";
import type { QuadChainPacketSummary } from "@/lib/quad-chain";

type VoiceStatus = "idle" | "listening" | "recording" | "blocked" | "error";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<{ transcript: string; isFinal?: boolean }>>;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export type VoiceStoredResult = {
  transcript?: string;
  memory: { id: string; title: string } | null;
  quadChain: QuadChainPacketSummary[];
  assistant?: {
    message: string;
    quadChain: QuadChainPacketSummary;
    verifiedContext?: QuadChainPacketSummary[];
  } | null;
};

export function VoiceButton({
  enabled,
  clientUrl,
  deepgramEnabled = false,
  orgId = null,
  runId = null,
  rememberTranscripts = true,
  onTranscript,
  onTranscriptStored,
}: {
  enabled: boolean;
  clientUrl: string | null;
  deepgramEnabled?: boolean;
  orgId?: string | null;
  runId?: string | null;
  rememberTranscripts?: boolean;
  onTranscript: (text: string) => void;
  onTranscriptStored?: (input: VoiceStoredResult) => void;
}) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [message, setMessage] = useState("Voice mode");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const capability = useMemo(() => {
    if (typeof window === "undefined") {
      return buildVoiceSurfaceCapability({
        deepgramConfigured: false,
        moshiConfigured: false,
        browserSpeechSupported: false,
        secureContext: false,
      });
    }
    const speechWindow = window as SpeechWindow;
    return buildVoiceSurfaceCapability({
      deepgramConfigured: deepgramEnabled,
      moshiConfigured: enabled && Boolean(clientUrl),
      browserSpeechSupported: Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition),
      secureContext: window.isSecureContext || window.location.hostname === "localhost",
    });
  }, [clientUrl, deepgramEnabled, enabled]);

  async function start() {
    if (!capability.canListen || status === "recording" || status === "listening") return;

    if (capability.mode === "browser_speech_fallback") {
      startBrowserSpeech();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const socket =
        capability.mode === "moshi_full_duplex" && clientUrl ? new WebSocket(clientUrl) : null;
      if (socket) socket.binaryType = "arraybuffer";
      socketRef.current = socket;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: preferredMimeType() });
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          if (socket?.readyState === WebSocket.OPEN) socket.send(event.data);
        }
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (socket?.readyState === WebSocket.OPEN) socket.close(1000, "Push-to-talk complete");
        if (capability.mode === "deepgram_stt") await submitDeepgramAudio();
      };
      if (socket) {
        socket.onerror = () => {
          setStatus("error");
          setMessage("Voice transport failed");
        };
      }

      recorder.start(250);
      setStatus("recording");
      setMessage("Listening...");
    } catch {
      setStatus("blocked");
      setMessage("Microphone blocked");
    }
  }

  async function submitDeepgramAudio() {
    const audio = new Blob(chunksRef.current, { type: preferredMimeType() ?? "audio/webm" });
    if (audio.size === 0) {
      setMessage("Voice mode");
      return;
    }

    setMessage("Transcribing...");
    try {
      const form = new FormData();
      form.append("audio", audio, `quad-voice.${audio.type.includes("mp4") ? "mp4" : "webm"}`);
      appendVoiceTranscriptContext(form, { orgId, runId, remember: rememberTranscripts });
      const response = await fetch("/api/voice/transcribe", { method: "POST", body: form });
      const data = (await response.json()) as {
        transcript?: string;
        memory?: { id: string; title: string } | null;
        assistant?: VoiceStoredResult["assistant"];
        quadChain?: QuadChainPacketSummary[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Transcription failed");
      const transcript = data.transcript?.trim();
      if (transcript) {
        onTranscriptStored?.({
          transcript,
          memory: data.memory ?? null,
          assistant: data.assistant ?? null,
          quadChain: Array.isArray(data.quadChain) ? data.quadChain : [],
        });
        if (!data.assistant?.message) onTranscript(transcript);
        setMessage(data.assistant?.message ? "Answered" : data.memory ? "Memory saved" : "Voice mode");
      } else {
        setMessage("No speech heard");
      }
    } catch {
      setStatus("error");
      setMessage("Voice failed");
    }
  }

  function stop() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;
    setStatus("idle");
    setMessage(chunksRef.current.length > 0 ? "Audio sent" : "Voice mode");
  }

  function startBrowserSpeech() {
    const speechWindow = window as SpeechWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus("blocked");
      setMessage("Speech unsupported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      let finalText = "";
      let partialText = "";
      for (let i = 0; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim() ?? "";
        if (!text) continue;
        if (result[0]?.isFinal || (result as unknown as { isFinal?: boolean }).isFinal) finalText += `${text} `;
        else partialText = text;
      }
      setMessage(finalText.trim() || partialText || "Listening...");
      if (finalText.trim()) onTranscript(finalText.trim());
    };
    recognition.onerror = () => {
      setStatus("error");
      setMessage("Voice failed");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setStatus("idle");
      setMessage("Voice mode");
    };
    recognition.start();
    setStatus("listening");
    setMessage("Listening...");
  }

  return (
    <button
      type="button"
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={() => (status === "recording" || status === "listening") && stop()}
      onTouchStart={(event) => {
        event.preventDefault();
        start();
      }}
      onTouchEnd={(event) => {
        event.preventDefault();
        stop();
      }}
      disabled={!capability.canListen}
      title={capability.detail}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
        status === "recording" || status === "listening"
          ? "border-accent bg-accent/15 text-accent"
          : "border-edge bg-panel text-neutral-300 hover:border-accent/40 hover:text-accent"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {!capability.canListen ? capability.label : message}
    </button>
  );
}

function preferredMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported(type));
}
