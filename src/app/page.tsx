"use client";

import { useEffect, useState } from "react";
import { ChatBar } from "@/components/ChatBar";
import { LiveLogs } from "@/components/LiveLogs";
import { FindingsPanel } from "@/components/FindingsPanel";
import { DebugDrawer } from "@/components/DebugDrawer";
import { AsciiBlossoms } from "@/components/AsciiBlossoms";
import type { AuditReport } from "@/lib/types";
import type { PublishedEvent } from "@/lib/redis/publisher";
import type { BackendSettings } from "@/lib/debug/status";

type Message = { role: "user" | "quad"; text: string };
type DemoState = "idle" | "loading" | "done";

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [events, setEvents] = useState<PublishedEvent[]>([]);
  const [counters, setCounters] = useState<Record<string, number>>({});
  const [report, setReport] = useState<AuditReport | null>(null);
  const [active, setActive] = useState(false);
  const [logsOpen, setLogsOpen] = useState(true);
  const [settings, setSettings] = useState<BackendSettings | null>(null);
  const [demoState, setDemoState] = useState<DemoState>("idle");

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setSettings(data))
      .catch(() => setSettings(null));
  }, []);

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
          text: `BrightPath brain loaded (${json.memoriesLoaded} memories). Auditing their public site now...`,
        },
      ]);

      const demoUrl = `${window.location.origin}/demo`;
      await startAudit(demoUrl, "org_brightpath");
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
    const data = await res.json();
    setMessages((m) => [...m, { role: "quad", text: data.message }]);
  }

  async function startAudit(targetUrl: string, orgId?: string) {
    setActive(true);
    setEvents([]);
    setReport(null);
    const res = await fetch("/api/audit/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUrl, ...(orgId ? { orgId } : {}) }),
    });
    if (!res.body) {
      setActive(false);
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
        const evt = JSON.parse(line);
        if (evt.type === "audit.report") {
          setReport(evt.report);
        } else if (typeof evt.sequence === "number") {
          setEvents((e) => [...e, evt]);
          tallyCounters(evt, setCounters);
        }
      }
    }
    setActive(false);
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
              title="Seed BrightPath brain and run a live demo audit"
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
            <div key={i} className={m.role === "user" ? "text-right" : ""}>
              <span className="inline-block rounded-lg bg-panel px-3 py-2 text-sm text-neutral-200">
                {m.text}
              </span>
            </div>
          ))}
          <FindingsPanel report={report} />
        </div>

        <ChatBar
          onSend={handleSend}
          disabled={active}
          voiceEnabled={Boolean(settings?.voice)}
          voiceClientUrl={settings?.voiceClientUrl ?? null}
          deepgramEnabled={Boolean(settings?.deepgram)}
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
