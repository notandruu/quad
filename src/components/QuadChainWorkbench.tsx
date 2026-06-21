"use client";

import { useState } from "react";
import type { QuadChainComparison } from "@/lib/quad-chain/workbench";

export function QuadChainWorkbench({ initial }: { initial: QuadChainComparison }) {
  const [prompt, setPrompt] = useState(initial.prompt);
  const [rawTrace, setRawTrace] = useState(initial.rawTrace);
  const [comparison, setComparison] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [hasCompared, setHasCompared] = useState(false);

  async function runComparison() {
    setLoading(true);
    try {
      const response = await fetch("/api/quadchain/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, rawTrace }),
      });
      if (!response.ok) throw new Error("comparison failed");
      setComparison((await response.json()) as QuadChainComparison);
      setHasCompared(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative min-h-[calc(100vh-7rem)] overflow-hidden rounded-lg border border-edge bg-[#fff8fb] shadow-sm">
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

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-7rem)] max-w-5xl flex-col justify-center px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-3xl text-center">
          <p className="font-mono text-xs text-accent-dark">quadchain agent</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">
            ask it to compress a trace
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            paste noisy agent context, then quadchain turns it into a verified memory packet and shows what would have
            been sent without proof.
          </p>
        </div>

        <div className="mx-auto mt-8 w-full max-w-4xl rounded-[1.35rem] border border-edge bg-paper/85 p-3 shadow-[0_28px_90px_rgba(194,31,99,0.18)] backdrop-blur">
          <div className="rounded-[1rem] border border-edge bg-white/70 p-3">
            <label className="sr-only" htmlFor="quadchain-prompt">
              Prompt
            </label>
            <textarea
              id="quadchain-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={3}
              className="w-full resize-none bg-transparent p-2 text-base leading-7 outline-none placeholder:text-soft"
              placeholder="Ask quadchain to compress and verify this context..."
            />
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="font-mono text-xs text-soft">
                {rawTrace.length.toLocaleString()} chars of trace context loaded
              </div>
              <button
                type="button"
                onClick={runComparison}
                disabled={loading}
                className="rounded-full bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-dark disabled:opacity-50"
              >
                {loading ? "Compressing..." : "Compare traces"}
              </button>
            </div>
          </div>

          <details className="group mt-3 rounded-[1rem] border border-edge bg-panel/70 p-3 text-left">
            <summary className="cursor-pointer list-none text-sm font-medium text-accent-dark">
              Trace context
              <span className="ml-2 font-mono text-xs text-soft group-open:hidden">show</span>
              <span className="ml-2 hidden font-mono text-xs text-soft group-open:inline">hide</span>
            </summary>
            <textarea
              value={rawTrace}
              onChange={(event) => setRawTrace(event.target.value)}
              rows={12}
              className="mt-3 w-full resize-y rounded-lg border border-edge bg-paper/80 p-3 font-mono text-xs leading-5 outline-none focus:border-accent"
            />
          </details>
        </div>

        {!hasCompared ? (
          <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2 font-mono text-xs text-soft">
            <span className="rounded-full border border-edge bg-panel/70 px-3 py-1">anthropic packet draft</span>
            <span className="rounded-full border border-edge bg-panel/70 px-3 py-1">hash-bound output</span>
            <span className="rounded-full border border-edge bg-panel/70 px-3 py-1">evidence obligations</span>
            <span className="rounded-full border border-edge bg-panel/70 px-3 py-1">tamper check</span>
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
    <div className="mt-8 space-y-4">
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

      <div className="rounded-[1rem] border border-edge bg-paper/75 p-3">
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
    <div className={`min-h-40 rounded-[1.25rem] border border-edge p-4 shadow-sm ${toneClass}`}>
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
    <div className="flex min-h-[24rem] flex-col rounded-[1rem] border border-edge bg-paper/75">
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
