"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type MeetingStatus = "idle" | "joining" | "live" | "ended" | "failed";

type TranscriptLine = {
  id: string;
  speaker: string;
  text: string;
  ts: string;
};

type ThinkingStep = {
  id: string;
  type: string;
  label: string;
  detail: string;
  tone: "neutral" | "active" | "success" | "warning" | "error";
};

type LearnedFact = {
  id: string;
  claim: string;
  status: "learned" | "proposed" | "reused" | "rejected";
  confidence?: number;
};

type AgentverseState = {
  status: "idle" | "running" | "queued" | "failed";
  detail: string;
  targetUrl?: string;
  workflow?: string;
  queuedRunId?: string;
  jobId?: string;
  jobStatus?: string;
  selectedTools: string[];
  missingCapabilities: string[];
  quadChain?: {
    certificateId?: string;
    accepted?: boolean;
    type?: string;
  } | null;
};

const THINKING_META: Record<string, { label: string; tone: ThinkingStep["tone"] }> = {
  "meeting.started":    { label: "Meeting started",      tone: "active" },
  "meeting.session":    { label: "Session linked",       tone: "active" },
  "meeting.bot.created":{ label: "Bot created",          tone: "active" },
  "meeting.chat.sent":  { label: "Chat sent",            tone: "success" },
  "meeting.chat.failed":{ label: "Chat unavailable",     tone: "warning" },
  "meeting.no_redis":   { label: "Local stream",         tone: "warning" },
  "meeting.thinking":  { label: "Scanning…",             tone: "active" },
  "fact.extracted":    { label: "Fact found",            tone: "warning" },
  "fact.evaluated":    { label: "Verified",              tone: "success" },
  "fact.proposed":     { label: "Pending approval",      tone: "warning" },
  "fact.learned":      { label: "Brain updated",         tone: "success" },
  "fact.rejected":     { label: "Not durable",           tone: "error" },
  "meeting.summarized":{ label: "Summary ready",         tone: "success" },
  "meeting.ended":     { label: "Meeting ended",         tone: "success" },
  "meeting.agentverse.started": { label: "Agentverse handoff", tone: "active" },
  "meeting.agentverse.completed": { label: "Agentverse queued", tone: "success" },
  "meeting.agentverse.failed": { label: "Agentverse failed", tone: "error" },
  "meeting.failed":    { label: "Error",                 tone: "error" },
};

export type MeetingPanelProps = {
  /** Called when the meeting ends so the parent can update state if needed. */
  onEnded?: (learnedCount: number) => void;
};

export function MeetingPanel({ onEnded }: MeetingPanelProps) {
  const [status, setStatus]       = useState<MeetingStatus>("idle");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [mode, setMode]           = useState<"recall" | "scripted">("recall");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [thinking, setThinking]   = useState<ThinkingStep[]>([]);
  const [facts, setFacts]         = useState<LearnedFact[]>([]);
  const [summary, setSummary]     = useState<string | null>(null);
  const [learnedCount, setLearned] = useState(0);
  const [error, setError]         = useState<string | null>(null);
  const [agentverse, setAgentverse] = useState<AgentverseState>({
    status: "idle",
    detail: "",
    selectedTools: [],
    missingCapabilities: [],
  });

  const transcriptRef = useRef<HTMLDivElement>(null);
  const thinkingRef   = useRef<HTMLDivElement>(null);
  const abortRef      = useRef<AbortController | null>(null);

  useEffect(() => {
    transcriptRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    thinkingRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thinking]);

  const handleEvent = useCallback((raw: Record<string, unknown>) => {
    const type = String(raw.type ?? "");
    // Published events wrap data under `payload`; direct events are flat.
    const evt: Record<string, unknown> = (raw.payload && typeof raw.payload === "object")
      ? { ...raw, ...(raw.payload as Record<string, unknown>) }
      : raw;

    if (type === "meeting.started" || type === "meeting.session") setStatus("live");
    if (type === "meeting.ended")   { setStatus("ended"); }
    if (type === "meeting.failed")  { setError(String(evt.error ?? "Meeting failed")); setStatus("failed"); }
    if (type === "meeting.result")  { setSummary(String(evt.summary ?? "")); setLearned(Number(evt.learnedCount ?? 0)); }
    if (type === "meeting.agentverse.started") {
      setAgentverse({
        status: "running",
        detail: String(evt.detail ?? "Agentverse handoff started."),
        targetUrl: String(evt.targetUrl ?? ""),
        workflow: String(evt.workflow ?? ""),
        selectedTools: [],
        missingCapabilities: [],
      });
    }
    if (type === "meeting.agentverse.completed") {
      setAgentverse({
        status: "queued",
        detail: String(evt.detail ?? "Agentverse handoff queued."),
        targetUrl: String(evt.targetUrl ?? ""),
        workflow: String(evt.workflow ?? ""),
        queuedRunId: String(evt.queuedRunId ?? ""),
        jobId: String(evt.jobId ?? ""),
        jobStatus: String(evt.jobStatus ?? ""),
        selectedTools: stringList(evt.selectedTools),
        missingCapabilities: stringList(evt.missingCapabilities),
        quadChain: packetSummary(evt.quadChain),
      });
    }
    if (type === "meeting.agentverse.failed") {
      setAgentverse((current) => ({
        ...current,
        status: "failed",
        detail: String(evt.detail ?? "Agentverse handoff failed."),
        targetUrl: String(evt.targetUrl ?? current.targetUrl ?? ""),
        workflow: String(evt.workflow ?? current.workflow ?? ""),
      }));
    }

    if (type === "meeting.transcript") {
      const speaker = String(evt.speaker ?? "Speaker");
      const text    = String(evt.text ?? "");
      if (text) setTranscript((t) => [...t, { id: crypto.randomUUID(), speaker, text, ts: new Date().toLocaleTimeString() }]);
    }

    const meta = THINKING_META[type];
    if (meta && type !== "meeting.transcript") {
      const detail =
        type === "meeting.session"    ? String(evt.session ? "connected to live meeting session" : "") :
        type === "meeting.bot.created"? String(evt.detail ?? "") :
        type === "meeting.chat.sent"  ? String(evt.detail ?? "") :
        type === "meeting.chat.failed"? String(evt.detail ?? "") :
        type === "meeting.no_redis"   ? "redis is unavailable; live replay is limited" :
        type === "meeting.thinking"   ? String(evt.detail ?? "") :
        type === "fact.extracted"     ? String(evt.claim ?? "") :
        type === "fact.learned"       ? `${String(evt.claim ?? "")}` :
        type === "fact.rejected"      ? `${String(evt.claim ?? "")} — ${String(evt.reason ?? "")}` :
        type === "fact.evaluated"     ? `${String(evt.claim ?? "")} (${Math.round(Number(evt.confidence ?? 0) * 100)}% confidence)` :
        type === "meeting.summarized" ? String(evt.summary ?? "") :
        type === "meeting.agentverse.started" ? String(evt.detail ?? "external agent handoff started") :
        type === "meeting.agentverse.completed" ? String(evt.detail ?? "external agent handoff queued") :
        type === "meeting.agentverse.failed" ? String(evt.detail ?? "external agent handoff failed") :
        String(evt.error ?? "");
      setThinking((t) => [...t, { id: crypto.randomUUID(), type, label: meta.label, detail, tone: meta.tone }]);
    }

    if (type === "fact.proposed") {
      setFacts((f) => [...f, { id: crypto.randomUUID(), claim: String(evt.claim ?? ""), status: "proposed", confidence: typeof evt.confidence === "number" ? evt.confidence : undefined }]);
      setLearned((c) => c + 1);
    }
    if (type === "fact.learned") {
      const reused = Boolean(evt.reused);
      setFacts((f) => [...f, { id: crypto.randomUUID(), claim: String(evt.claim ?? ""), status: reused ? "reused" : "learned", confidence: typeof evt.confidence === "number" ? evt.confidence : undefined }]);
      if (!reused) setLearned((c) => c + 1);
    }
    if (type === "fact.rejected") {
      setFacts((f) => [...f, { id: crypto.randomUUID(), claim: String(evt.claim ?? ""), status: "rejected" }]);
    }
  }, []);

  const consumeStream = useCallback((url: string, method: "GET" | "POST", body?: object) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      try {
        const res = await fetch(url, {
          method, signal: controller.signal,
          headers: body ? { "Content-Type": "application/json" } : {},
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok || !res.body) { setError(`Failed (${res.status})`); setStatus("failed"); return; }

        const reader  = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            const line = chunk.replace(/^data: /, "").trim();
            if (!line) continue;
            try { handleEvent(JSON.parse(line)); } catch { /* skip */ }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") { setError((err as Error).message); setStatus("failed"); }
      }
    })();
  }, [handleEvent]);

  // Notify parent when meeting ends and a brain was updated
  useEffect(() => {
    if (status === "ended" && learnedCount > 0) onEnded?.(learnedCount);
  }, [status, learnedCount, onEnded]);

  async function handleJoin() {
    reset();
    setStatus("joining");
    setThinking([{
      id: crypto.randomUUID(),
      type: "meeting.thinking",
      label: "Creating bot",
      detail: "Sending Quad AI to the meeting through Recall.",
      tone: "active",
    }]);
    try {
      const res  = await fetch("/api/meeting/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ meetingUrl, orgId: "org_redcross" }) });
      const data = await res.json() as { runId?: string; error?: string };
      if (!res.ok || !data.runId) { setError(data.error ?? "Join failed"); setStatus("failed"); return; }
      consumeStream(`/api/meeting/stream/${data.runId}`, "GET");
    } catch (err) { setError((err as Error).message); setStatus("failed"); }
  }

  function handleScripted() {
    reset();
    setTimeout(() => setStatus("live"), 300);
    consumeStream("/api/meeting/scripted", "POST", { orgId: "org_redcross" });
  }

  function reset() {
    setError(null); setTranscript([]); setThinking([]); setFacts([]); setSummary(null); setLearned(0);
    setAgentverse({ status: "idle", detail: "", selectedTools: [], missingCapabilities: [] });
  }

  const isRunning = status === "joining" || status === "live";

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Mode tabs */}
        <div className="flex rounded border border-edge text-xs overflow-hidden">
          <button onClick={() => setMode("scripted")} className={`px-3 py-1.5 ${mode === "scripted" ? "bg-accent/20 text-accent" : "text-neutral-500 hover:text-neutral-300"}`}>
            Scripted demo
          </button>
          <button onClick={() => setMode("recall")} className={`px-3 py-1.5 ${mode === "recall" ? "bg-accent/20 text-accent" : "text-neutral-500 hover:text-neutral-300"}`}>
            Live (Recall)
          </button>
        </div>

        {mode === "recall" && (status === "idle" || status === "ended" || status === "failed") && (
          <input
            type="text"
            placeholder="https://meet.google.com/xxx-xxxx-xxx"
            value={meetingUrl}
            onChange={(e) => setMeetingUrl(e.target.value)}
            className="flex-1 rounded border border-edge bg-ink px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-accent/50"
          />
        )}

        {(status === "idle" || status === "ended" || status === "failed") && (
          <button
            onClick={mode === "scripted" ? handleScripted : handleJoin}
            disabled={mode === "recall" && !meetingUrl.trim()}
            className="rounded border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {mode === "scripted" ? "Run demo meeting" : "Send agent to meeting"}
          </button>
        )}

        {isRunning && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-red-400">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              {status === "joining" ? "Joining…" : "Live"}
            </span>
            <button onClick={() => { abortRef.current?.abort(); setStatus("ended"); }} className="text-xs text-neutral-500 hover:text-neutral-300">
              End
            </button>
          </div>
        )}

        {status === "ended" && (
          <span className="text-xs text-emerald-400">{learnedCount} fact{learnedCount !== 1 ? "s" : ""} learned</span>
        )}
      </div>

      {error && (
        <div className="rounded border border-red-800/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">{error}</div>
      )}

      {/* Content — only show once active */}
      {status !== "idle" && (
        <div className="grid grid-cols-2 gap-3" style={{ minHeight: "320px" }}>
          {/* Left — transcript */}
          <div className="flex flex-col rounded border border-edge bg-ink overflow-hidden">
            <div className="border-b border-edge px-3 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600">Transcript</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5" style={{ maxHeight: "300px" }}>
              {transcript.length === 0 && <p className="text-xs text-neutral-600">Waiting for speech…</p>}
              {transcript.map((line) => (
                <div key={line.id}>
                  <div className="flex items-baseline gap-1.5 mb-0.5">
                    <span className="text-[11px] font-semibold text-accent">{line.speaker}</span>
                    <span className="text-[9px] text-neutral-700">{line.ts}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-neutral-300">{line.text}</p>
                </div>
              ))}
              <div ref={transcriptRef} />
            </div>
          </div>

          {/* Right — thinking + brain */}
          <div className="flex flex-col gap-2">
            {/* Thinking log */}
            <div className="flex flex-col rounded border border-edge bg-ink overflow-hidden" style={{ flex: "1 1 auto" }}>
              <div className="border-b border-edge px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600">Agent thinking</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1" style={{ maxHeight: "150px" }}>
                {thinking.length === 0 && <p className="text-xs text-neutral-600">Reasoning will appear here…</p>}
                {thinking.map((step) => (
                  <div key={step.id} className="flex items-start gap-1.5 text-xs">
                    <span className="flex-shrink-0 mt-0.5">
                      {step.tone === "success" && <span className="text-emerald-400">✓</span>}
                      {step.tone === "error"   && <span className="text-red-400">✗</span>}
                      {step.tone === "warning" && <span className="text-yellow-400">◆</span>}
                      {step.tone === "active"  && <span className="text-blue-400 animate-pulse">◉</span>}
                      {step.tone === "neutral" && <span className="text-neutral-600">·</span>}
                    </span>
                    <span className={step.tone === "success" ? "text-emerald-300" : step.tone === "error" ? "text-red-300" : step.tone === "warning" ? "text-yellow-300" : step.tone === "active" ? "text-blue-300" : "text-neutral-500"}>
                      {step.label}
                    </span>
                    {step.detail && <span className="text-neutral-600 truncate">{step.detail}</span>}
                  </div>
                ))}
                <div ref={thinkingRef} />
              </div>
            </div>

            {/* Brain */}
            <div className="flex flex-col rounded border border-edge bg-ink overflow-hidden" style={{ flex: "1 1 auto" }}>
              <div className="border-b border-edge px-3 py-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600">Brain</span>
                {learnedCount > 0 && (
                  <span className="rounded-full bg-emerald-900/50 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">+{learnedCount} new</span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5" style={{ maxHeight: "150px" }}>
                {facts.length === 0 && <p className="text-xs text-neutral-600">Verified facts will appear here…</p>}
                {facts.map((fact) => (
                  <div key={fact.id} className={`rounded border px-2.5 py-1.5 text-xs ${
                    fact.status === "learned"  ? "border-emerald-800/50 bg-emerald-950/20" :
                    fact.status === "proposed" ? "border-yellow-800/50 bg-yellow-950/20" :
                    fact.status === "reused"   ? "border-blue-800/50 bg-blue-950/20" :
                                                  "border-neutral-800 opacity-40"
                  }`}>
                    <span className={`text-[10px] font-semibold ${
                      fact.status === "learned"  ? "text-emerald-400" :
                      fact.status === "proposed" ? "text-yellow-400" :
                      fact.status === "reused"   ? "text-blue-400" :
                                                    "text-neutral-600"
                    }`}>
                      {fact.status === "learned"  ? "✓ learned" :
                       fact.status === "proposed" ? "⏳ pending approval" :
                       fact.status === "reused"   ? "↩ already known" :
                                                     "✗ not durable"}
                      {fact.confidence !== undefined && ` · ${Math.round(fact.confidence * 100)}%`}
                    </span>
                    <p className="mt-0.5 text-neutral-300 leading-snug">{fact.claim}</p>
                  </div>
                ))}
              </div>
            </div>

            <AgentverseMeetingCard agentverse={agentverse} />
          </div>
        </div>
      )}

      {/* Summary */}
      {summary && (
        <div className="rounded border border-edge bg-ink px-3 py-2">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-600">Meeting summary</p>
          <p className="text-xs leading-relaxed text-neutral-400">{summary}</p>
        </div>
      )}
    </div>
  );
}

function AgentverseMeetingCard({ agentverse }: { agentverse: AgentverseState }) {
  const statusTone =
    agentverse.status === "queued"
      ? "border-accent/30 bg-accent/10 text-accent"
      : agentverse.status === "running"
        ? "border-sky-300/30 bg-sky-950/20 text-sky-200"
        : agentverse.status === "failed"
          ? "border-red-300/30 bg-red-950/20 text-red-200"
          : "border-edge bg-panel text-neutral-500";

  return (
    <div className="flex flex-col rounded border border-pink-300/25 bg-ink overflow-hidden" style={{ flex: "0 0 auto" }}>
      <div className="border-b border-edge px-3 py-1.5 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-600">Agentverse / ASI:One</span>
        <span className={`rounded-full border px-2 py-0.5 text-[9px] ${statusTone}`}>
          {agentverse.status === "idle" ? "waiting" : agentverse.status}
        </span>
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-xs leading-5 text-neutral-400">
          {agentverse.detail || "Meeting-derived context will hand off to the external agent surface after summary."}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
          <MeetingMetric label="tools" value={String(agentverse.selectedTools.length)} accent={agentverse.selectedTools.length > 0} />
          <MeetingMetric label="blocked" value={String(agentverse.missingCapabilities.length)} accent={agentverse.missingCapabilities.length === 0 && agentverse.status !== "idle"} />
          <MeetingMetric label="proof" value={agentverse.quadChain?.accepted ? "ok" : agentverse.quadChain ? "check" : "-"} accent={agentverse.quadChain?.accepted === true} />
        </div>
        {(agentverse.targetUrl || agentverse.queuedRunId || agentverse.jobId) && (
          <div className="mt-2 rounded border border-edge bg-panel px-2 py-1.5">
            {agentverse.targetUrl && (
              <div className="truncate font-mono text-[9px] text-neutral-600">target {agentverse.targetUrl}</div>
            )}
            {agentverse.queuedRunId && (
              <div className="mt-0.5 truncate font-mono text-[9px] text-neutral-600">run {agentverse.queuedRunId}</div>
            )}
            {agentverse.jobId && (
              <div className="mt-0.5 truncate font-mono text-[9px] text-neutral-600">job {agentverse.jobId} · {agentverse.jobStatus}</div>
            )}
          </div>
        )}
        {agentverse.selectedTools.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {agentverse.selectedTools.slice(0, 4).map((tool) => (
              <span key={tool} className="rounded-full border border-pink-300/25 bg-pink-950/20 px-1.5 py-0.5 text-[9px] text-pink-100">
                {tool}
              </span>
            ))}
          </div>
        )}
        {agentverse.missingCapabilities.length > 0 && (
          <div className="mt-2 truncate text-[10px] text-amber-100">
            blocked: {agentverse.missingCapabilities.join(", ")}
          </div>
        )}
        {agentverse.quadChain?.certificateId && (
          <div className="mt-2 truncate font-mono text-[9px] text-neutral-600">
            certificate {agentverse.quadChain.certificateId}
          </div>
        )}
      </div>
    </div>
  );
}

function MeetingMetric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded border border-edge bg-panel px-2 py-1.5">
      <div className={accent ? "text-xs font-semibold text-accent" : "text-xs font-semibold text-neutral-200"}>{value}</div>
      <div className="mt-0.5 text-[9px] text-neutral-600">{label}</div>
    </div>
  );
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function packetSummary(value: unknown): AgentverseState["quadChain"] {
  if (!value || typeof value !== "object") return null;
  const packet = value as Record<string, unknown>;
  return {
    certificateId: typeof packet.certificateId === "string" ? packet.certificateId : undefined,
    accepted: typeof packet.accepted === "boolean" ? packet.accepted : undefined,
    type: typeof packet.type === "string" ? packet.type : undefined,
  };
}
