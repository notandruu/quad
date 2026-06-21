"use client";

import { useMemo, useRef, useState } from "react";

type VoiceStatus = "idle" | "recording" | "blocked" | "error";

export function VoiceButton({
  enabled,
  clientUrl,
}: {
  enabled: boolean;
  clientUrl: string | null;
}) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [message, setMessage] = useState("Push to talk");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const disabledReason = useMemo(() => {
    if (!enabled) return "Moshi is not configured.";
    if (!clientUrl) return "Voice needs a browser-reachable Moshi websocket.";
    if (typeof window !== "undefined" && !window.isSecureContext && window.location.hostname !== "localhost") {
      return "Microphone access requires HTTPS.";
    }
    return null;
  }, [clientUrl, enabled]);

  async function start() {
    if (disabledReason || status === "recording") return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const socket = new WebSocket(clientUrl!);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: preferredMimeType() });
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          if (socket.readyState === WebSocket.OPEN) socket.send(event.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (socket.readyState === WebSocket.OPEN) socket.close(1000, "Push-to-talk complete");
      };
      socket.onerror = () => {
        setStatus("error");
        setMessage("Voice transport failed");
      };

      recorder.start(250);
      setStatus("recording");
      setMessage("Listening...");
    } catch {
      setStatus("blocked");
      setMessage("Microphone blocked");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setStatus("idle");
    setMessage(chunksRef.current.length > 0 ? "Audio sent" : "Push to talk");
  }

  return (
    <button
      type="button"
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={() => status === "recording" && stop()}
      onTouchStart={(event) => {
        event.preventDefault();
        start();
      }}
      onTouchEnd={(event) => {
        event.preventDefault();
        stop();
      }}
      disabled={Boolean(disabledReason)}
      title={disabledReason ?? "Hold to talk to Quad"}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
        status === "recording"
          ? "border-accent bg-accent/15 text-accent"
          : "border-edge bg-panel text-neutral-300 hover:border-accent/40 hover:text-accent"
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {disabledReason ? "Voice unavailable" : message}
    </button>
  );
}

function preferredMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((type) => MediaRecorder.isTypeSupported(type));
}
