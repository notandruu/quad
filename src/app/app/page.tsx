"use client";

import { useEffect, useState } from "react";
import { ChatBar } from "@/components/ChatBar";
import { LiveLogs } from "@/components/LiveLogs";
import { FindingsPanel } from "@/components/FindingsPanel";
import { DebugDrawer } from "@/components/DebugDrawer";
import { AsciiBlossoms } from "@/components/AsciiBlossoms";
import { TrustTrail } from "@/components/TrustTrail";
import { TrustPacketPanel } from "@/components/TrustPacketPanel";
import { OperatorConsole } from "@/components/OperatorConsole";
import type { VoiceStoredResult } from "@/components/VoiceButton";
import type { AuditReport } from "@/lib/types";
import type { PublishedEvent } from "@/lib/redis/publisher";
import type { BackendSettings } from "@/lib/debug/status";
import type { QuadCoreAgentLoopTrace } from "@/lib/core";
import type { QuadChainPacketSummary } from "@/lib/quad-chain";
import type { VoiceInterviewQuestion } from "@/lib/voice/interview";
import { classifyEnterpriseProofPrompt, formatEnterpriseProofMessage } from "@/lib/runtime/enterpriseProof";

type Message = {
  role: "user" | "quad";
  text: string;
  quadChain?: QuadChainPacketSummary | null;
  verifiedContext?: QuadChainPacketSummary[];
  agentLoop?: QuadCoreAgentLoopTrace | null;
  action?: {
    label: string;
    targetUrl: string;
    orgId: string;
  };
};
type DemoState = "idle" | "loading" | "done";

type EnterpriseProofResponse = {
  ok?: boolean;
  result?: {
    status?: "answered" | "needs_human";
    answer?: string;
    confidence?: number;
    wasReused?: boolean;
    sources?: unknown[];
    quadChain?: QuadChainPacketSummary | null;
  };
  brainGrowth?: {
    status: "learned" | "reused" | "needs_human";
    memoryId: string | null;
    title: string | null;
    visibility: "company" | "team" | "personal";
    approvalRequired: boolean;
  } | null;
  error?: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<PublishedEvent[]>([]);
  const [counters, setCounters] = useState<Record<string, number>>({});
  const [report, setReport] = useState<AuditReport | null>(null);
  const [active, setActive] = useState(false);
  const [logsOpen, setLogsOpen] = useState(true);
  const [settings, setSettings] = useState<BackendSettings | null>(null);
  const [demoState, setDemoState] = useState<DemoState>("idle");
  const [voicePrompt, setVoicePrompt] = useState<VoiceInterviewQuestion | null>(null);
  const [voicePromptCursor, setVoicePromptCursor] = useState(0);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setSettings(data))
      .catch(() => setSettings(null));
  }, []);

  useEffect(() => {
    if (!settings?.voice) return;
    void loadVoicePrompt(voicePromptCursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.voice, report?.orgId, report?.runId, voicePromptCursor]);

  async function handleLoadDemo() {
    if (demoState === "loading" || active) return;
    setDemoState("loading");
    setMessages([]);
    setEvents([]);
    setReport(null);
    setCounters({});

    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "reset failed");

      setDemoState("done");
      setMessages([
        {
          role: "quad",
          text: `Red Cross brain loaded (${json.memoriesLoaded} internal documents). Auditing their public site now...`,
        },
      ]);

      const demoUrl = `${window.location.origin}/demo`;
      await startAudit(demoUrl, "org_redcross");
    } catch (err) {
      setDemoState("idle");
      setMessages((m) => [
        ...m,
        { role: "quad", text: `Demo reset failed: ${err instanceof Error ? err.message : String(err)}` },
      ]);
    }
  }

  async function handleSend(text: string, url: string | null) {
    setMessages((m) => [...m, { role: "user", text }]);

    const wantsAudit = /audit|crawl|scan/i.test(text) && url;
    if (wantsAudit) {
      await startAudit(url!);
      return;
    }

    if (classifyEnterpriseProofPrompt(text) === "trust_question") {
      await answerEnterpriseProofQuestion(text);
      return;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          pinnedUrl: url,
          hasActiveAudit: Boolean(report),
          runId: report?.runId ?? undefined,
          orgId: report?.orgId ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      const message =
        typeof data.message === "string" && data.message.trim()
          ? data.message
          : "I hit an error answering that. Try again in a moment.";
      setMessages((m) => [
        ...m,
        {
          role: "quad",
          text: message,
          quadChain: data.quadChain ?? null,
          verifiedContext: Array.isArray(data.verifiedContext) ? data.verifiedContext : [],
          agentLoop: data.agentLoop ?? null,
        },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "quad", text: "I could not reach the server. Check the connection and try again." },
      ]);
    }
  }

  async function answerEnterpriseProofQuestion(question: string) {
    try {
      const res = await fetch("/api/enterprise-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: "org_acme",
          question,
          targetVisibility: "company",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as EnterpriseProofResponse;
      if (!res.ok || !data.result) {
        throw new Error(data.error ?? `enterprise proof failed with status ${res.status}`);
      }
      const result = data.result;
      setMessages((m) => [
        ...m,
        {
          role: "quad",
          text: formatEnterpriseProofMessage({
            status: result.status ?? "needs_human",
            answer: result.answer,
            confidence: result.confidence,
            wasReused: result.wasReused,
            sourceCount: Array.isArray(result.sources) ? result.sources.length : 0,
            brainGrowth: data.brainGrowth ?? null,
          }),
          quadChain: result.quadChain ?? null,
        },
      ]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "quad", text: `Enterprise proof failed: ${err instanceof Error ? err.message : String(err)}.` },
      ]);
    }
  }

  function handleVoiceStored(input: VoiceStoredResult) {
    if (input.transcript && input.assistant?.message) {
      setMessages((m) => [
        ...m,
        { role: "user", text: input.transcript ?? "" },
        {
          role: "quad",
          text: input.assistant?.message ?? "",
          quadChain: input.assistant?.quadChain ?? input.quadChain[0] ?? null,
          verifiedContext: input.assistant?.verifiedContext ?? [],
          agentLoop: input.assistant?.agentLoop ?? null,
        },
      ]);
      return;
    }

    const memory = input.memory;
    if (!memory) return;
    const currentReport = report;
    setMessages((m) => [
      ...m,
      {
        role: "quad",
        text: `Saved that as company memory: ${memory.title}.`,
        quadChain: input.quadChain.find((packet) => packet.type === "brain_memory_write") ?? input.quadChain[0] ?? null,
        action: currentReport
          ? {
              label: "Rerun audit",
              targetUrl: currentReport.targetUrl,
              orgId: currentReport.orgId,
            }
          : undefined,
      },
    ]);
  }

  async function loadVoicePrompt(cursor: number) {
    try {
      const response = await fetch("/api/voice/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: report?.orgId ?? undefined,
          runId: report?.runId ?? undefined,
          cursor,
        }),
      });
      const data = await response.json().catch(() => ({}));
      setVoicePrompt(data?.question ?? null);
    } catch {
      setVoicePrompt(null);
    }
  }

  async function startAudit(targetUrl: string, orgId?: string) {
    setActive(true);
    setEvents([]);
    setReport(null);
    try {
      const res = await fetch("/api/audit/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl, ...(orgId ? { orgId } : {}) }),
      });
      if (!res.ok || !res.body) {
        setMessages((m) => [
          ...m,
          { role: "quad", text: `Audit could not start (status ${res.status}). Try again.` },
        ]);
        return;
      }
      const reader = res.body.getReader();
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
          // One malformed frame must never kill the whole stream.
          let evt: { type?: string; sequence?: number; report?: AuditReport; error?: string };
          try {
            evt = JSON.parse(line);
          } catch {
            continue;
          }
          if (evt.type === "audit.report") {
            setReport(evt.report ?? null);
          } else if (evt.type === "audit.failed") {
            setMessages((m) => [
              ...m,
              { role: "quad", text: `Audit failed: ${evt.error ?? "unknown error"}.` },
            ]);
          } else if (typeof evt.sequence === "number") {
            setEvents((e) => [...e, evt as PublishedEvent]);
            tallyCounters(evt as PublishedEvent, setCounters);
          }
        }
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "quad",
          text: `Audit stream interrupted: ${err instanceof Error ? err.message : String(err)}.`,
        },
      ]);
    } finally {
      setActive(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4 lg:h-screen lg:flex-row">
      <AsciiBlossoms />
      <section className="relative z-10 flex min-h-[58vh] flex-1 flex-col gap-4 lg:min-h-0">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Quad</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLoadDemo}
              disabled={demoState === "loading" || active}
              className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
              title="Seed Red Cross brain and run a live demo audit"
            >
              {demoState === "loading" ? "Loading..." : "Load demo"}
            </button>
            <span className="text-xs text-neutral-600">Live audit employee</span>
            <a
              href="/quadchain"
              className="rounded-lg border border-edge bg-panel px-3 py-1 text-xs font-medium text-accent hover:border-accent/50"
            >
              Quadchain
            </a>
          </div>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto">
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} active={active} onAction={startAudit} />
          ))}
          <OperatorConsole watchRunId={report?.runId ?? null} />
          <TrustTrail runId={report?.runId ?? null} />
          <TrustPacketPanel report={report} />
          <FindingsPanel report={report} />
        </div>

        <ChatBar
          onSend={handleSend}
          disabled={active}
          voiceEnabled={Boolean(settings?.voice)}
          voiceClientUrl={settings?.voiceClientUrl ?? null}
          deepgramEnabled={Boolean(settings?.deepgram)}
          orgId={report?.orgId ?? undefined}
          runId={report?.runId ?? undefined}
          voicePrompt={voicePrompt}
          onNextVoicePrompt={() => setVoicePromptCursor((cursor) => cursor + 1)}
          onVoiceStored={handleVoiceStored}
        />
      </section>

      <div className="relative z-10 flex h-[42vh] w-full shrink-0 lg:h-full lg:w-auto">
        <LiveLogs
          events={events}
          counters={counters}
          active={active}
          open={logsOpen}
          onToggle={() => setLogsOpen((o) => !o)}
        />
      </div>

      <DebugDrawer />
    </main>
  );
}

function MessageBubble({
  message,
  active,
  onAction,
}: {
  message: Message;
  active: boolean;
  onAction: (targetUrl: string, orgId?: string) => void;
}) {
  const align = message.role === "user" ? "text-right" : "";
  const action = message.action;
  return (
    <div className={align}>
      <span className="inline-block rounded-lg bg-panel px-3 py-2 text-sm text-neutral-200">
        {message.text}
      </span>
      {message.quadChain && (
        <div className={message.role === "user" ? "mt-1 text-right" : "mt-1"}>
          <span className="inline-block rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">
            verified by quadchain · {message.quadChain.certificateId}
            {message.verifiedContext?.length ? ` · used ${message.verifiedContext.length} verified memories` : ""}
          </span>
        </div>
      )}
      {message.agentLoop && (
        <div className={message.role === "user" ? "mt-1 text-right" : "mt-1"}>
          <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-edge bg-ink/70 px-2 py-1 font-mono text-[10px] text-neutral-400">
            <span className="text-accent">agent loop</span>
            {message.agentLoop.steps.map((step) => (
              <span key={`${message.agentLoop?.runId}-${step.index}`} className="rounded border border-edge bg-panel px-1.5 py-0.5">
                {step.kind.replace("_", " ")}
              </span>
            ))}
            <span>{message.agentLoop.turnsUsed}/{message.agentLoop.turnBudget} turns</span>
          </div>
        </div>
      )}
      {action && (
        <div className={message.role === "user" ? "mt-2 text-right" : "mt-2"}>
          <button
            type="button"
            onClick={() => onAction(action.targetUrl, action.orgId)}
            disabled={active}
            className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-medium text-accent hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
}

function tallyCounters(
  evt: PublishedEvent,
  setCounters: React.Dispatch<React.SetStateAction<Record<string, number>>>
) {
  const map: Record<string, string> = {
    "audit.pages_discovered": "pagesDiscovered",
    "page.rendered": "pagesFetched",
    "page.analyzed": "pagesAnalyzed",
    "finding.created": "findingsCreated",
  };
  const key = map[evt.type];
  if (!key) return;
  const inc =
    evt.type === "audit.pages_discovered"
      ? Number((evt.payload as { count?: number }).count ?? 0)
      : 1;
  setCounters((c) => ({ ...c, [key]: (c[key] ?? 0) + inc }));
}
