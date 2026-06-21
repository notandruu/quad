"use client";

import { useState } from "react";
import { UrlChip } from "./UrlChip";
import { VoiceButton, type VoiceStoredResult } from "./VoiceButton";
import type { VoiceInterviewQuestion } from "@/lib/voice/interview";

const URL_RE = /https?:\/\/[^\s]+/i;

/**
 * Compact chat input. A pasted URL auto-detects and pins into the chip above
 * the input; the input stays usable during an audit.
 */
export function ChatBar({
  onSend,
  disabled,
  voiceEnabled = false,
  voiceClientUrl = null,
  deepgramEnabled = false,
  orgId = null,
  runId = null,
  voicePrompt = null,
  onNextVoicePrompt,
  onVoiceStored,
}: {
  onSend: (text: string, url: string | null) => void;
  disabled?: boolean;
  voiceEnabled?: boolean;
  voiceClientUrl?: string | null;
  deepgramEnabled?: boolean;
  orgId?: string | null;
  runId?: string | null;
  voicePrompt?: VoiceInterviewQuestion | null;
  onNextVoicePrompt?: () => void;
  onVoiceStored?: (input: VoiceStoredResult) => void;
}) {
  const [value, setValue] = useState("");
  const detectedUrl = value.match(URL_RE)?.[0] ?? null;

  function submit() {
    if (!value.trim()) return;
    onSend(value.trim(), detectedUrl);
    setValue("");
  }

  function submitVoice(text: string) {
    const url = text.match(URL_RE)?.[0] ?? detectedUrl;
    onSend(text, url);
  }

  return (
    <div className="space-y-2">
      <UrlChip url={detectedUrl} />
      {voiceEnabled && voicePrompt && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2">
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-wide text-accent/80">Voice prompt</div>
            <div className="text-xs text-neutral-200">{voicePrompt.question}</div>
            <div className="mt-1 text-[11px] text-neutral-500">{voicePrompt.evidenceHint}</div>
          </div>
          <button
            type="button"
            onClick={onNextVoicePrompt}
            className="shrink-0 rounded-md border border-edge bg-panel px-2 py-1 text-xs text-neutral-300 hover:border-accent/40 hover:text-accent"
          >
            Next
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-xl border border-edge bg-panel p-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Ask Quad, or paste a URL and say 'start an audit'"
          className="flex-1 bg-transparent px-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
        />
        <button
          onClick={submit}
          disabled={disabled}
          className="rounded-lg bg-accent/90 px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-40"
        >
          Send
        </button>
        <VoiceButton
          enabled={voiceEnabled}
          clientUrl={voiceClientUrl}
          deepgramEnabled={deepgramEnabled}
          orgId={orgId}
          runId={runId}
          rememberTranscripts
          onTranscript={submitVoice}
          onTranscriptStored={onVoiceStored}
        />
      </div>
    </div>
  );
}
