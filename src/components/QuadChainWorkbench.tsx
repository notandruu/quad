"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { QuadChainComparison } from "@/lib/quad-chain/workbench";

gsap.registerPlugin(useGSAP);

type ChatMessage = {
  role: "user" | "quad";
  text: string;
};

const starterMessages: ChatMessage[] = [
  {
    role: "quad",
    text: "drop a noisy trace or describe the handoff you want compressed. after three turns i will reveal the verified packet.",
  },
];

const quickTurns = [
  "audit this oauth trace and keep the smallest safe fix",
  "show me what would get lost without quadchain",
  "now reveal the proof packet",
];

export function QuadChainWorkbench({ initial }: { initial: QuadChainComparison }) {
  const scopeRef = useRef<HTMLElement | null>(null);
  const [prompt, setPrompt] = useState(initial.prompt);
  const [rawTrace, setRawTrace] = useState(initial.rawTrace);
  const [comparison, setComparison] = useState(initial);
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [loading, setLoading] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);

  useGSAP(
    () => {
      gsap.from(".chat-bubble", {
        autoAlpha: 0,
        y: 16,
        duration: 0.45,
        stagger: 0.08,
        ease: "power3.out",
      });
    },
    { scope: scopeRef, dependencies: [messages.length], revertOnUpdate: true }
  );

  useGSAP(
    () => {
      if (!hasCompared) return;
      const timeline = gsap.timeline();
      timeline
        .from(".wrapped-shell", {
          autoAlpha: 0,
          y: 36,
          scale: 0.97,
          duration: 0.55,
          ease: "power3.out",
        })
        .from(
          ".wrapped-card",
          {
            autoAlpha: 0,
            y: 42,
            rotation: -1.5,
            scale: 0.92,
            duration: 0.62,
            stagger: 0.08,
            ease: "back.out(1.6)",
          },
          "-=0.2"
        )
        .from(
          ".trace-panel",
          {
            autoAlpha: 0,
            y: 24,
            duration: 0.45,
            stagger: 0.08,
            ease: "power2.out",
          },
          "-=0.22"
        );
    },
    { scope: scopeRef, dependencies: [hasCompared, comparison.withQuadChain.certificateId], revertOnUpdate: true }
  );

  async function sendTurn(text = prompt) {
    const clean = text.trim();
    if (!clean || loading) return;

    const nextTurn = messages.filter((message) => message.role === "user").length + 1;
    setMessages((current) => [...current, { role: "user", text: clean }]);
    setPrompt("");

    if (nextTurn < 3) {
      setMessages((current) => [
        ...current,
        {
          role: "quad",
          text:
            nextTurn === 1
              ? "got it. i found candidate evidence, debug noise, and answer-critical concepts. ask one more thing before i mint the packet."
              : "cool. next turn triggers the reveal: raw trace versus verified packet, token stats, and verifier mechanics.",
        },
      ]);
      return;
    }

    setLoading(true);
    setMessages((current) => [
      ...current,
      { role: "quad", text: "compressing with anthropic, then verifying with quadchain..." },
    ]);
    try {
      const response = await fetch("/api/quadchain/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: clean, rawTrace }),
      });
      if (!response.ok) throw new Error("comparison failed");
      const nextComparison = (await response.json()) as QuadChainComparison;
      setComparison(nextComparison);
      setHasCompared(true);
      setMessages((current) => [
        ...current,
        {
          role: "quad",
          text: `revealed. ${nextComparison.mode} drafted it, quadchain ${nextComparison.withQuadChain.accepted ? "accepted" : "rejected"} it, and the receiver gets the verified packet.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      ref={scopeRef}
      className="relative min-h-[calc(100vh-7rem)] overflow-hidden rounded-lg border border-edge bg-[#fff8fb] shadow-sm"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-20%] h-72 w-72 rounded-full bg-[#d9ff6a]/45 blur-3xl" />
        <div className="absolute right-[-12%] top-[8%] h-80 w-80 rounded-full bg-[#ff5aa5]/35 blur-3xl" />
        <div className="absolute bottom-[-18%] left-[28%] h-96 w-96 rounded-full bg-[#77d7ff]/35 blur-3xl" />
        <div className="absolute inset-x-0 top-10 font-mono text-[10px] text-accent-dark/30">
          <div className="animate-[ascii-ribbon_28s_linear_infinite] whitespace-nowrap">
            + source chain + compression chain + proof chain + anchor chain + verify before trust +
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-7rem)] max-w-6xl flex-col justify-center px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-3xl text-center">
          <p className="font-mono text-xs text-accent-dark">quadchain agent</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
            chat with the trace first
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            three turns in, it flips into a wrapped-style proof reveal: token stats, trace diff, verifier mechanics.
          </p>
        </div>

        <div className="mx-auto mt-8 grid w-full max-w-5xl gap-4 lg:grid-cols-[1fr_0.72fr]">
          <div className="rounded-[1.35rem] border border-edge bg-paper/85 p-3 shadow-[0_28px_90px_rgba(194,31,99,0.18)] backdrop-blur">
            <div className="max-h-[25rem] space-y-3 overflow-y-auto rounded-[1rem] border border-edge bg-white/70 p-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`chat-bubble flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[82%] rounded-[1rem] px-4 py-3 text-sm leading-6 ${
                      message.role === "user"
                        ? "bg-accent text-white"
                        : "border border-edge bg-panel/90 text-[var(--ink)]"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-[1rem] border border-edge bg-white/70 p-3">
              <label className="sr-only" htmlFor="quadchain-prompt">
                Message
              </label>
              <textarea
                id="quadchain-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendTurn();
                  }
                }}
                rows={3}
                className="w-full resize-none bg-transparent p-2 text-base leading-7 outline-none placeholder:text-soft"
                placeholder="Message quadchain..."
              />
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="font-mono text-xs text-soft">
                  {Math.min(messages.filter((message) => message.role === "user").length, 3)}/3 turns before reveal
                </div>
                <button
                  type="button"
                  onClick={() => sendTurn()}
                  disabled={loading}
                  className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-dark disabled:opacity-50"
                >
                  {loading ? "Compressing..." : messages.filter((message) => message.role === "user").length >= 2 ? "Reveal" : "Send"}
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {quickTurns.map((turn) => (
                <button
                  key={turn}
                  type="button"
                  onClick={() => sendTurn(turn)}
                  disabled={loading}
                  className="rounded-full border border-edge bg-panel/70 px-3 py-1 font-mono text-xs text-soft transition hover:border-accent/50 hover:text-accent-dark disabled:opacity-50"
                >
                  {turn}
                </button>
              ))}
            </div>
          </div>

          <details className="rounded-[1.35rem] border border-edge bg-panel/75 p-4 text-left shadow-sm">
            <summary className="cursor-pointer list-none text-sm font-medium text-accent-dark">
              Trace context
              <span className="ml-2 font-mono text-xs text-soft">editable</span>
            </summary>
            <textarea
              value={rawTrace}
              onChange={(event) => setRawTrace(event.target.value)}
              rows={18}
              className="mt-3 w-full resize-y rounded-lg border border-edge bg-paper/80 p-3 font-mono text-xs leading-5 outline-none focus:border-accent"
            />
          </details>
        </div>

        {!hasCompared ? (
          <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2 font-mono text-xs text-soft">
            <span className="rounded-full border border-edge bg-panel/70 px-3 py-1">turn 1: intent</span>
            <span className="rounded-full border border-edge bg-panel/70 px-3 py-1">turn 2: evidence map</span>
            <span className="rounded-full border border-edge bg-panel/70 px-3 py-1">turn 3: wrapped reveal</span>
          </div>
        ) : (
          <WrappedReveal comparison={comparison} />
        )}
      </div>
    </section>
  );
}

function WrappedReveal({ comparison }: { comparison: QuadChainComparison }) {
  return (
    <div className="wrapped-shell mt-8 space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <WrappedCard
          eyebrow="your context diet"
          value={`${comparison.withQuadChain.reduction}%`}
          detail={`${comparison.withQuadChain.savedTokens} tokens saved`}
          tone="lime"
        />
        <WrappedCard
          eyebrow="proof verdict"
          value={comparison.withQuadChain.accepted ? "accepted" : "rejected"}
          detail={comparison.withQuadChain.certificateId}
          tone="pink"
        />
        <WrappedCard
          eyebrow="model path"
          value={comparison.mode}
          detail="drafted, then verified"
          tone="blue"
        />
        <WrappedCard
          eyebrow="evidence"
          value={comparison.withQuadChain.evidence}
          detail="preserved in packet"
          tone="paper"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="trace-panel rounded-[1rem] border border-edge bg-paper/75 p-3">
          <h3 className="text-sm font-semibold">Mechanistic verifier trace</h3>
          <div className="mt-3 space-y-2">
            {comparison.mechanisticTrace.map((step) => (
              <div key={step.label} className="rounded-lg border border-edge bg-panel/70 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono text-xs text-accent-dark">{step.label}</div>
                  <div className="rounded-full border border-accent/30 px-2 py-0.5 font-mono text-[10px] text-soft">
                    {step.status}
                  </div>
                </div>
                <div className="mt-2 text-xs leading-5 text-muted">{step.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <TracePanel
            title="Without quadchain"
            status="unverified"
            body={comparison.rawTrace}
            footer={comparison.withoutQuadChain.risk}
          />
          <TracePanel
            title="With quadchain"
            status={comparison.withQuadChain.accepted ? "accepted" : "rejected"}
            body={comparison.quadChainTrace}
            footer={`certificate ${comparison.withQuadChain.certificateId}`}
          />
        </div>
      </div>

      <div className="trace-panel rounded-[1rem] border border-edge bg-paper/75 p-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium">Proof receipt</div>
          <div className="font-mono text-xs text-accent-dark">
            {comparison.withQuadChain.merkleRoot.slice(0, 32)}
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {comparison.omittedRanges.length === 0 ? (
            <div className="text-sm text-muted">No low-signal spans were omitted.</div>
          ) : (
            comparison.omittedRanges.map((range) => (
              <div key={range.id} className="rounded-lg border border-edge bg-panel/70 p-3">
                <div className="font-mono text-xs text-soft">{range.id}</div>
                <div className="mt-1 text-xs text-muted">{range.preview}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function WrappedCard({
  eyebrow,
  value,
  detail,
  tone,
}: {
  eyebrow: string;
  value: string;
  detail: string;
  tone: "lime" | "pink" | "blue" | "paper";
}) {
  const toneClass = {
    lime: "bg-[#d9ff6a] text-[#1f2b09]",
    pink: "bg-[#ff5aa5] text-white",
    blue: "bg-[#77d7ff] text-[#092331]",
    paper: "bg-paper text-[var(--ink)]",
  }[tone];

  return (
    <div className={`wrapped-card min-h-40 rounded-[1.25rem] border border-edge p-4 shadow-sm ${toneClass}`}>
      <div className="font-mono text-xs opacity-75">{eyebrow}</div>
      <div className="mt-4 break-words text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-3 break-words text-sm opacity-80">{detail}</div>
    </div>
  );
}

function TracePanel({
  title,
  status,
  body,
  footer,
}: {
  title: string;
  status: string;
  body: string;
  footer: string;
}) {
  return (
    <div className="trace-panel flex min-h-[24rem] flex-col rounded-[1rem] border border-edge bg-paper/75">
      <div className="flex items-center justify-between gap-2 border-b border-edge px-3 py-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs text-accent-dark">
          {status}
        </span>
      </div>
      <pre className="max-h-[28rem] flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono text-xs leading-5">
        {body}
      </pre>
      <div className="border-t border-edge px-3 py-2 text-xs text-muted">{footer}</div>
    </div>
  );
}
