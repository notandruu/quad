"use client";

import { useState } from "react";
import type { QuadChainOpenObligation, QuadChainPacketSummary } from "@/lib/quad-chain";
import type { AuditReport } from "@/lib/types";

type TrustPacketStep = {
  id: string;
  title: string;
  status: "ready" | "dry_run" | "blocked" | "needs_human";
  owner: "quad" | "human" | "connector";
  detail: string;
};

type TrustPacketResponse = {
  ok: boolean;
  error?: string;
  packet: QuadChainPacketSummary;
  task: {
    runId: string;
    status: string;
    nextAction: string;
    approvals: Array<{ id: string; decision: string; reason: string; evidenceVisible: boolean }>;
    receipts: Array<{ id: string; status: string; summary: string; artifactHash: string }>;
  };
  workflow: {
    workflowId: string;
    title: string;
    receiptPreview: {
      id: string;
      status: "ready_for_approval" | "blocked";
      summary: string;
    };
    steps: TrustPacketStep[];
    openObligations: QuadChainOpenObligation[];
    proofSummary?: {
      accepted: boolean;
      failures: string[];
      visibility: "public" | "internal" | "restricted";
      certificateId: string;
      handoffId: string;
      validator: string;
      readinessScore: number;
      evidencePreserved: number;
      evidenceRequired: number;
      evidenceLabel: string;
      tokensBefore: number;
      tokensAfter: number;
      tokensSaved: number;
      compressionRatio: number;
      omittedRangeCount: number;
      omittedRanges: Array<{
        sourceId: string;
        rangeId: string;
        reason: string;
        rangeHash: string;
      }>;
      openObligationCount: number;
      anchor: {
        registryReceipt: string;
        merkleRoot: string;
      };
    };
  };
};

export function TrustPacketPanel({ report }: { report: AuditReport | null }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<TrustPacketResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!report) return null;

  async function buildPacket() {
    if (!report || state === "loading") return;
    setState("loading");
    setError(null);

    try {
      const response = await fetch("/api/trust-packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: report.runId, orgId: report.orgId }),
      });
      const json = (await response.json()) as TrustPacketResponse;
      if (!response.ok || !json.ok) throw new Error(json.error ?? "trust packet build failed");
      setResult(json);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
    }
  }

  const ready = result?.workflow.receiptPreview.status === "ready_for_approval";

  return (
    <section className="rounded-lg border border-accent/30 bg-panel p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-neutral-100">Trust packet</h2>
          <p className="mt-1 text-[11px] leading-5 text-neutral-500">
            Turn this audit into a verified approval packet with evidence, certificate, and receipt.
          </p>
        </div>
        <button
          onClick={buildPacket}
          disabled={state === "loading"}
          className="shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {state === "loading" ? "Building..." : result ? "Rebuild" : "Build packet"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-300/30 bg-red-950/30 px-2 py-1.5 text-xs text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <TrustPacketStat label="status" value={ready ? "approval" : "blocked"} accent={ready} />
            <TrustPacketStat label="tokens saved" value={String(result.workflow.proofSummary?.tokensSaved ?? result.packet.tokensSaved)} />
            <TrustPacketStat label="proof" value={result.packet.accepted ? "accepted" : "rejected"} accent={result.packet.accepted} />
          </div>

          <div className="rounded border border-edge bg-ink/50 p-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-neutral-200">
                {ready ? "Ready for approval" : "Needs work"}
              </span>
              <span className="font-mono text-[10px] text-neutral-500">{result.packet.certificateId}</span>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-neutral-500">
              {result.workflow.receiptPreview.summary}
            </p>
          </div>

          <TrustPacketProofLedger result={result} />

          <div className="space-y-1.5">
            {result.workflow.steps.slice(0, 5).map((step) => (
              <div key={step.id} className="flex items-center justify-between gap-3 rounded border border-edge bg-ink/40 px-2 py-1.5">
                <div className="min-w-0">
                  <div className="truncate text-xs text-neutral-200">{step.title}</div>
                  <div className="truncate text-[10px] text-neutral-600">{step.owner}</div>
                </div>
                <span className={step.status === "blocked" || step.status === "needs_human" ? "text-[10px] text-amber-200" : "text-[10px] text-accent"}>
                  {formatStatus(step.status)}
                </span>
              </div>
            ))}
          </div>

          {result.workflow.openObligations.length > 0 && (
            <div className="rounded border border-amber-300/30 bg-amber-950/20 p-2">
              <div className="text-[11px] font-medium text-amber-100">Open obligations</div>
              <ul className="mt-1 space-y-1">
                {result.workflow.openObligations.slice(0, 3).map((item) => (
                  <li key={item.id} className="text-[10px] leading-4 text-amber-100/80">
                    {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function TrustPacketProofLedger({ result }: { result: TrustPacketResponse }) {
  const proof = result.workflow.proofSummary;
  const evidenceLabel = proof?.evidenceLabel ?? `${result.packet.evidencePreserved}/${result.packet.evidenceRequired}`;
  const omittedRangeCount = proof?.omittedRangeCount ?? 0;
  const openObligationCount = proof?.openObligationCount ?? result.workflow.openObligations.length;
  const readinessScore = proof?.readinessScore ?? (result.packet.accepted ? 1 : 0);
  const failures = proof?.failures ?? result.packet.failures;

  return (
    <div className="rounded border border-pink-300/25 bg-pink-950/10 p-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-medium text-neutral-200">Quad chain verification</h3>
          <p className="mt-1 font-mono text-[9px] text-neutral-600">
            {proof?.validator ?? "quad.chain.verifier"} · {proof?.visibility ?? result.packet.visibility}
          </p>
        </div>
        <span className={result.packet.accepted ? "shrink-0 text-[10px] text-accent" : "shrink-0 text-[10px] text-red-200"}>
          {result.packet.accepted ? "accepted" : "rejected"}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
        <TrustPacketStat label="evidence" value={evidenceLabel} accent={result.packet.accepted} />
        <TrustPacketStat label="omitted" value={String(omittedRangeCount)} />
        <TrustPacketStat label="obligations" value={String(openObligationCount)} accent={openObligationCount === 0} />
        <TrustPacketStat label="readiness" value={`${Math.round(readinessScore * 100)}%`} accent={readinessScore >= 1} />
      </div>

      <div className="mt-2 grid gap-1.5 md:grid-cols-2">
        <TrustPacketProofRow label="certificate" value={proof?.certificateId ?? result.packet.certificateId} />
        <TrustPacketProofRow label="handoff" value={proof?.handoffId ?? result.packet.handoffId} />
        <TrustPacketProofRow label="token window" value={`${proof?.tokensBefore ?? result.packet.tokensBefore} -> ${proof?.tokensAfter ?? result.packet.tokensAfter}`} />
        <TrustPacketProofRow label="registry" value={proof?.anchor.registryReceipt ?? "local receipt"} />
      </div>

      {proof && proof.omittedRanges.length > 0 ? (
        <div className="mt-2 space-y-1">
          {proof.omittedRanges.map((range) => (
            <div key={`${range.sourceId}:${range.rangeId}`} className="rounded border border-edge bg-ink/70 px-2 py-1">
              <div className="flex justify-between gap-2">
                <span className="truncate text-[10px] text-neutral-300">{range.rangeId}</span>
                <span className="shrink-0 font-mono text-[9px] text-neutral-700">{range.rangeHash.slice(0, 18)}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-neutral-500">{range.reason}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2 rounded border border-edge bg-ink/60 px-2 py-1 text-[10px] text-neutral-500">
          No omitted ranges declared for this packet.
        </div>
      )}

      {failures.length > 0 && (
        <div className="mt-2 rounded border border-red-300/25 bg-red-950/20 px-2 py-1 text-[10px] text-red-200">
          {failures.slice(0, 2).join(", ")}
        </div>
      )}
    </div>
  );
}

function TrustPacketProofRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-edge bg-panel/80 px-2 py-1">
      <div className="text-[9px] text-neutral-600">{label}</div>
      <div className="mt-0.5 truncate font-mono text-[9px] text-neutral-300">{value}</div>
    </div>
  );
}

function TrustPacketStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded border border-edge bg-ink/50 p-2">
      <div className={accent ? "text-sm font-semibold text-accent" : "text-sm font-semibold text-neutral-100"}>
        {value}
      </div>
      <div className="mt-1 text-[9px] text-neutral-600">{label}</div>
    </div>
  );
}

function formatStatus(status: TrustPacketStep["status"]) {
  return status.replace("_", " ");
}
