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
  ts: string;
};

type LearnedFact = {
  id: string;
  claim: string;
  category: string;
  status: "learned" | "proposed" | "reused" | "rejected";
  confidence?: number;
};

type MeetingWorkflow = {
  runId: string;
  status: string;
  nextAction: string;
  approval?: {
    id: string;
    decision: string;
    reason: string;
    evidenceVisible: boolean;
  };
  receipt?: {
    id: string;
    status: string;
    summary: string;
    artifactHash: string;
  };
  artifacts?: Array<{ id: string; kind: string; title: string; hash: string }>;
  packets?: Array<{ id: string; type: string; accepted: boolean; evidencePreserved: number; tokensSaved: number }>;
  followups?: Array<{ id: string; title: string; status: string; reason: string }>;
};

const THINKING_LABELS: Record<string, { label: string; tone: ThinkingStep["tone"] }> = {
  "meeting.started":    { label: "Meeting started",         tone: "active" },
  "meeting.transcript": { label: "Transcript received",     tone: "neutral" },
  "meeting.thinking":   { label: "Scanning…",               tone: "active" },
  "fact.extracted":     { label: "Fact extracted",          tone: "warning" },
  "fact.evaluated":     { label: "Verified",                tone: "success" },
  "fact.proposed":      { label: "Approval staged",         tone: "warning" },
  "fact.learned":       { label: "Brain updated",           tone: "success" },
  "fact.rejected":      { label: "Rejected",                tone: "error" },
  "meeting.summarized": { label: "Summary complete",        tone: "success" },
  "meeting.ended":      { label: "Meeting ended",           tone: "success" },
  "meeting.failed":     { label: "Error",                   tone: "error" },
};

export default function MeetingPage() {
  const [status, setStatus] = useState<MeetingStatus>("idle");
  const [runId, setRunId]   = useState<string | null>(null);
  const [meetingUrl, setMeetingUrl] = useState("");
  const [mode, setMode] = useState<"recall" | "scripted">("recall");

  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [thinking, setThinking]     = useState<ThinkingStep[]>([]);
  const [facts, setFacts]           = useState<LearnedFact[]>([]);
  const [summary, setSummary]       = useState<string | null>(null);
  const [workflow, setWorkflow]     = useState<MeetingWorkflow | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [learnedCount, setLearnedCount] = useState(0);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const thinkingEndRef   = useRef<HTMLDivElement>(null);
  const abortRef         = useRef<AbortController | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  useEffect(() => {
    thinkingEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thinking]);

  // Consume SSE from either /api/meeting/stream/[runId] or /api/meeting/scripted
  const consumeStream = useCallback((url: string, method: "GET" | "POST", body?: object) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const doFetch = async () => {
      try {
        const res = await fetch(url, {
          method,
          signal: controller.signal,
          headers: body ? { "Content-Type": "application/json" } : {},
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!res.ok || !res.body) {
          const txt = await res.text().catch(() => "unknown error");
          setError(txt);
          setStatus("failed");
          return;
        }

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
            let evt: Record<string, unknown>;
            try { evt = JSON.parse(line); } catch { continue; }
            handleEvent(evt);
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError((err as Error).message);
          setStatus("failed");
        }
      }
    };

    void doFetch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleEvent(evt: Record<string, unknown>) {
    const type = String(evt.type ?? "");

    if (type === "meeting.started" || type === "meeting.session") {
      setStatus("live");
    }
    if (type === "meeting.ended") {
      setStatus("ended");
    }
    if (type === "meeting.failed") {
      setError(String(evt.error ?? "Meeting failed"));
      setStatus("failed");
    }
    if (type === "meeting.result") {
      setSummary(String(evt.summary ?? ""));
      setLearnedCount(Number(evt.learnedCount ?? 0));
      setWorkflow(isMeetingWorkflow(evt.workflow) ? evt.workflow : null);
    }

    if (type === "meeting.transcript") {
      const speaker = String(evt.speaker ?? "Speaker");
      const text    = String(evt.text ?? "");
      if (text) {
        setTranscript((t) => [
          ...t,
          { id: crypto.randomUUID(), speaker, text, ts: new Date().toLocaleTimeString() },
        ]);
      }
    }

    // Thinking log
    if (THINKING_LABELS[type]) {
      const { label, tone } = THINKING_LABELS[type];
      const detail =
        type === "meeting.thinking"  ? String(evt.detail ?? "") :
        type === "fact.extracted"    ? String(evt.claim ?? "") :
        type === "fact.learned"      ? String(evt.claim ?? "") :
        type === "fact.proposed"     ? `${String(evt.claim ?? "")} - approval required` :
        type === "fact.rejected"     ? `${String(evt.claim ?? "")} — ${String(evt.reason ?? "")}` :
        type === "fact.evaluated"    ? `${String(evt.claim ?? "")} (${Math.round(Number(evt.confidence ?? 0) * 100)}%)` :
        type === "meeting.summarized"? String(evt.summary ?? "") :
        String(evt.detail ?? evt.error ?? "");

      if (type !== "meeting.transcript") {
        setThinking((t) => [
          ...t,
          { id: crypto.randomUUID(), type, label, detail, tone, ts: new Date().toLocaleTimeString() },
        ]);
      }
    }

    // Facts panel
    if (type === "fact.learned") {
      const reused = Boolean(evt.reused);
      setFacts((f) => [
        ...f,
        {
          id: crypto.randomUUID(),
          claim: String(evt.claim ?? ""),
          category: String(evt.category ?? "fact"),
          status: reused ? "reused" : "learned",
          confidence: typeof evt.confidence === "number" ? evt.confidence : undefined,
        },
      ]);
      if (!reused) setLearnedCount((c) => c + 1);
    }
    if (type === "fact.proposed") {
      setFacts((f) => [
        ...f,
        {
          id: crypto.randomUUID(),
          claim: String(evt.claim ?? ""),
          category: String(evt.category ?? "fact"),
          status: "proposed",
          confidence: typeof evt.confidence === "number" ? evt.confidence : undefined,
        },
      ]);
    }
    if (type === "fact.rejected") {
      setFacts((f) => [
        ...f,
        {
          id: crypto.randomUUID(),
          claim: String(evt.claim ?? ""),
          category: "rejected",
          status: "rejected",
        },
      ]);
    }
  }

  async function handleJoin() {
    setError(null);
    setTranscript([]);
    setThinking([]);
    setFacts([]);
    setSummary(null);
    setWorkflow(null);
    setLearnedCount(0);
    setStatus("joining");

    try {
      const res = await fetch("/api/meeting/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingUrl, orgId: "org_redcross" }),
      });
      const data = await res.json() as { runId?: string; error?: string; streamUrl?: string };
      if (!res.ok || !data.runId) {
        setError(data.error ?? `Join failed (${res.status})`);
        setStatus("failed");
        return;
      }
      setRunId(data.runId);
      consumeStream(`/api/meeting/stream/${data.runId}`, "GET");
    } catch (err) {
      setError((err as Error).message);
      setStatus("failed");
    }
  }

  async function handleScripted() {
    setError(null);
    setTranscript([]);
    setThinking([]);
    setFacts([]);
    setSummary(null);
    setWorkflow(null);
    setLearnedCount(0);
    setStatus("joining");

    setTimeout(() => setStatus("live"), 500);
    consumeStream("/api/meeting/scripted", "POST", { orgId: "org_redcross" });
  }

  function handleEnd() {
    abortRef.current?.abort();
    setStatus("ended");
  }

  const isRunning = status === "joining" || status === "live";

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100" style={{ fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <a href="/" className="text-xs text-neutral-500 hover:text-neutral-300">← Dashboard</a>
          <span className="text-neutral-700">|</span>
          <span className="text-sm font-semibold text-neutral-200">Quad - meeting agent</span>
          {status === "live" && (
            <span className="flex items-center gap-1.5 text-xs text-red-400">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500" style={{ animation: "pulse 1.2s infinite" }} />
              Live
            </span>
          )}
          {status === "joining" && (
            <span className="text-xs text-yellow-400 animate-pulse">Joining…</span>
          )}
          {status === "ended" && (
            <span className="text-xs text-emerald-400">Meeting ended · {learnedCount} facts learned</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          {status === "idle" && (
            <div className="flex rounded border border-neutral-700 text-xs overflow-hidden">
              <button
                onClick={() => setMode("recall")}
                className={`px-3 py-1.5 ${mode === "recall" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"}`}
              >
                Live (Recall)
              </button>
              <button
                onClick={() => setMode("scripted")}
                className={`px-3 py-1.5 ${mode === "scripted" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white"}`}
              >
                Scripted demo
              </button>
            </div>
          )}

          {status === "idle" && mode === "recall" && (
            <input
              type="text"
              placeholder="https://meet.google.com/xxx-xxxx-xxx"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              className="w-72 rounded border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-neutral-500"
            />
          )}

          {status === "idle" && (
            <button
              onClick={mode === "recall" ? handleJoin : handleScripted}
              disabled={mode === "recall" && !meetingUrl}
              className="rounded bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {mode === "recall" ? "Send agent to meeting" : "Run scripted demo"}
            </button>
          )}

          {isRunning && (
            <button
              onClick={handleEnd}
              className="rounded border border-neutral-600 px-4 py-1.5 text-xs font-semibold text-neutral-300 hover:border-neutral-400"
            >
              End meeting
            </button>
          )}

          {(status === "ended" || status === "failed") && (
            <button
              onClick={() => { setStatus("idle"); setRunId(null); }}
              className="rounded border border-neutral-600 px-4 py-1.5 text-xs font-semibold text-neutral-300 hover:border-neutral-400"
            >
              New meeting
            </button>
          )}
        </div>
      </header>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-3 rounded border border-red-800 bg-red-950/40 px-4 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Idle state */}
      {status === "idle" && (
        <div className="flex flex-1 items-center justify-center">
          <div className="max-w-sm text-center">
            <div className="mb-4 text-5xl">[rec]</div>
            <h2 className="mb-2 text-lg font-semibold">Meeting agent</h2>
            <p className="mb-6 text-sm text-neutral-400">
              {mode === "recall"
                ? "Paste a Google Meet URL and send Quad AI to the meeting. The agent joins as a participant, listens, and stages verified facts for approval."
                : "Run the scripted Red Cross staff sync demo. The agent processes each utterance live, builds a governed memory proposal, and leaves a trust trail."}
            </p>
            <p className="text-xs text-neutral-600">
              {mode === "recall"
                ? "Requires RECALL_API_KEY and a public RECALL_WEBHOOK_URL."
                : "No external services required — uses the scripted meeting fixture."}
            </p>
          </div>
        </div>
      )}

      {/* Live 3-panel layout */}
      {status !== "idle" && (
        <div className="flex flex-1 gap-0 overflow-hidden">

          {/* Left — Transcript */}
          <div className="flex w-2/5 flex-col border-r border-neutral-800">
            <div className="border-b border-neutral-800 px-4 py-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Transcript</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {transcript.length === 0 && (
                <p className="text-xs text-neutral-600">Waiting for speech…</p>
              )}
              {transcript.map((line) => (
                <div key={line.id}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-red-400">{line.speaker}</span>
                    <span className="text-[10px] text-neutral-600">{line.ts}</span>
                  </div>
                  <p className="mt-0.5 text-sm leading-relaxed text-neutral-200">{line.text}</p>
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>

          {/* Right — Thinking + Brain */}
          <div className="flex w-3/5 flex-col">

            {/* Thinking log */}
            <div className="flex flex-1 flex-col border-b border-neutral-800" style={{ maxHeight: "55%" }}>
              <div className="border-b border-neutral-800 px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Agent thinking</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-1.5">
                {thinking.length === 0 && (
                  <p className="text-xs text-neutral-600">Agent will log its reasoning here…</p>
                )}
                {thinking.map((step) => (
                  <div key={step.id} className="flex items-start gap-2 text-xs">
                    <span className="mt-0.5 flex-shrink-0">
                      {step.tone === "success" && <span className="text-emerald-400">✓</span>}
                      {step.tone === "error"   && <span className="text-red-400">✗</span>}
                      {step.tone === "warning" && <span className="text-yellow-400">◆</span>}
                      {step.tone === "active"  && <span className="text-blue-400 animate-pulse">◉</span>}
                      {step.tone === "neutral" && <span className="text-neutral-600">·</span>}
                    </span>
                    <div>
                      <span className={`font-medium ${
                        step.tone === "success" ? "text-emerald-300" :
                        step.tone === "error"   ? "text-red-300" :
                        step.tone === "warning" ? "text-yellow-300" :
                        step.tone === "active"  ? "text-blue-300" :
                        "text-neutral-400"
                      }`}>
                        {step.label}
                      </span>
                      {step.detail && (
                        <span className="ml-1.5 text-neutral-500">{step.detail}</span>
                      )}
                      <span className="ml-2 text-[10px] text-neutral-700">{step.ts}</span>
                    </div>
                  </div>
                ))}
                <div ref={thinkingEndRef} />
              </div>
            </div>

            {/* Brain growth */}
            <div className="flex flex-col" style={{ maxHeight: "45%" }}>
              <div className="border-b border-neutral-800 px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Brain</span>
                {learnedCount > 0 && (
                  <span className="rounded-full bg-emerald-900/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                    +{learnedCount} learned
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {facts.length === 0 && (
                  <p className="text-xs text-neutral-600">Verified facts will appear here as the agent stages them for approval…</p>
                )}
                {facts.map((fact) => (
                  <div
                    key={fact.id}
                    className={`rounded border px-3 py-2 text-xs ${
                      fact.status === "learned"  ? "border-emerald-800 bg-emerald-950/30" :
                      fact.status === "proposed" ? "border-yellow-800 bg-yellow-950/25" :
                      fact.status === "reused"   ? "border-blue-800 bg-blue-950/30" :
                                                   "border-neutral-800 bg-neutral-900/40 opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-semibold ${
                        fact.status === "learned"  ? "text-emerald-400" :
                        fact.status === "proposed" ? "text-yellow-400" :
                        fact.status === "reused"   ? "text-blue-400" :
                                                     "text-neutral-600"
                      }`}>
                        {fact.status === "learned" ? "✓ Learned" :
                         fact.status === "proposed" ? "Approval staged" :
                         fact.status === "reused"  ? "↩ Already known" :
                                                      "✗ Not verified"}
                      </span>
                      {fact.confidence !== undefined && (
                        <span className="text-neutral-600">{Math.round(fact.confidence * 100)}% confidence</span>
                      )}
                    </div>
                    <p className="text-neutral-300 leading-relaxed">{fact.claim}</p>
                  </div>
                ))}
              </div>

              {/* Summary */}
              {summary && (
                <div className="border-t border-neutral-800 bg-neutral-900/60 p-4">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Meeting summary</p>
                  <p className="text-xs leading-relaxed text-neutral-300">{summary}</p>
                  {workflow && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded border border-yellow-800/70 bg-yellow-950/20 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-yellow-500">Approval</p>
                        <p className="mt-1 text-xs text-yellow-100">{workflow.approval?.decision ?? workflow.status}</p>
                      </div>
                      <div className="rounded border border-neutral-700 bg-neutral-950/60 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">Artifacts</p>
                        <p className="mt-1 text-xs text-neutral-200">{workflow.artifacts?.length ?? 0} created</p>
                      </div>
                      <div className="rounded border border-emerald-800/70 bg-emerald-950/20 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-500">Packets</p>
                        <p className="mt-1 text-xs text-emerald-100">{workflow.packets?.filter((p) => p.accepted).length ?? 0} accepted</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function isMeetingWorkflow(value: unknown): value is MeetingWorkflow {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<MeetingWorkflow>;
  return typeof item.runId === "string" && typeof item.status === "string";
}
