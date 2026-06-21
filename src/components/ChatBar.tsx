"use client";

import { useState } from "react";
import { UrlChip } from "./UrlChip";
import { VoiceButton } from "./VoiceButton";

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
}: {
  onSend: (text: string, url: string | null) => void;
  disabled?: boolean;
  voiceEnabled?: boolean;
  voiceClientUrl?: string | null;
}) {
  const [value, setValue] = useState("");
  const detectedUrl = value.match(URL_RE)?.[0] ?? null;

  function submit() {
    if (!value.trim()) return;
    onSend(value.trim(), detectedUrl);
    setValue("");
  }

  return (
    <div className="space-y-2">
      <UrlChip url={detectedUrl} />
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
        <VoiceButton enabled={voiceEnabled} clientUrl={voiceClientUrl} />
      </div>
    </div>
  );
}
