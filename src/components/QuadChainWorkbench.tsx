"use client";

import { useState } from "react";
import type { QuadChainComparison } from "@/lib/quad-chain/workbench";

export function QuadChainWorkbench({ initial }: { initial: QuadChainComparison }) {
  const [prompt, setPrompt] = useState(initial.prompt);
  const [rawTrace, setRawTrace] = useState(initial.rawTrace);
  const [comparison, setComparison] = useState(initial);
  const [loading, setLoading] = useState(false);

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
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-edge bg-panel/80 p-4 shadow-sm">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Trace workbench</h2>
          <p className="mt-1 text-sm text-muted">
            Prompt it like chat. Anthropic drafts the packet when configured, then quadchain verifies it.
          </p>
        </div>
        <button
          type="button"
          onClick={runComparison}
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-dark disabled:opacity-50"
        >
          {loading ? "Comparing..." : "Compare traces"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-3">
          <label className="block text-sm font-medium text-muted" htmlFor="quadchain-prompt">
            Prompt
          </label>
          <textarea
            id="quadchain-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={5}
            className="w-full resize-y rounded-lg border border-edge bg-paper/80 p-3 text-sm outline-none focus:border-accent"
          />
          <label className="block text-sm font-medium text-muted" htmlFor="quadchain-trace">
            Trace or context
          </label>
          <textarea
            id="quadchain-trace"
            value={rawTrace}
            onChange={(event) => setRawTrace(event.target.value)}
            rows={13}
            className="w-full resize-y rounded-lg border border-edge bg-paper/80 p-3 font-mono text-xs leading-5 outline-none focus:border-accent"
          />
        </div>

        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-5">
            <Metric label="Raw tokens" value={comparison.withoutQuadChain.tokens} />
            <Metric label="Quadchain tokens" value={comparison.withQuadChain.tokens} />
            <Metric label="Saved" value={comparison.withQuadChain.savedTokens} />
            <Metric label="Reduction" value={`${comparison.withQuadChain.reduction}%`} />
            <Metric label={comparison.mode === "anthropic" ? "Model" : "Fallback"} value={comparison.mode} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <TracePanel
              title="Without quadchain"
              status="Unverified"
              body={comparison.rawTrace}
              footer={comparison.withoutQuadChain.risk}
            />
            <TracePanel
              title="With quadchain"
              status={comparison.withQuadChain.accepted ? "Accepted" : "Rejected"}
              body={comparison.quadChainTrace}
              footer={`certificate ${comparison.withQuadChain.certificateId}`}
            />
          </div>

          <div className="rounded-lg border border-edge bg-paper/70 p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm font-medium">Proof receipt</div>
              <div className="font-mono text-xs text-accent-dark">
                {comparison.withQuadChain.merkleRoot.slice(0, 28)}
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {comparison.omittedRanges.length === 0 ? (
                <div className="text-sm text-muted">No low-signal spans were omitted.</div>
              ) : (
                comparison.omittedRanges.map((range) => (
                  <div key={range.id} className="rounded border border-edge bg-panel/70 p-2">
                    <div className="font-mono text-xs text-soft">{range.id}</div>
                    <div className="mt-1 text-xs text-muted">{range.preview}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-edge bg-paper/70 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 font-mono text-lg font-semibold">{value}</div>
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
    <div className="flex min-h-[24rem] flex-col rounded-lg border border-edge bg-paper/70">
      <div className="flex items-center justify-between gap-2 border-b border-edge px-3 py-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="rounded-md border border-accent/30 bg-accent/10 px-2 py-0.5 text-xs text-accent-dark">
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
