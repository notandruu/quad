"use client";

import { useEffect, useState } from "react";
import type { AuditFinding } from "@/lib/types";
import {
  actionTone,
  draftFindingAction,
  type ActionDraft,
  type FindingAction,
} from "@/lib/debug/actionDrafts";
import { buildEvidenceView } from "@/lib/debug/findingEvidence";
import type { QuadChainPacketSummary } from "@/lib/quad-chain";
import { ApprovalButtons } from "./ApprovalButtons";

const severityColor: Record<AuditFinding["severity"], string> = {
  high: "text-red-400 border-red-400/30",
  medium: "text-amber-300 border-amber-300/30",
  low: "text-neutral-400 border-edge",
};

/** A single finding with evidence, impact, fix, and approval actions. */
export function FindingCard({ finding }: { finding: AuditFinding }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [draft, setDraft] = useState<ActionDraft | null>(null);
  const [proof, setProof] = useState<QuadChainPacketSummary | null>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const evidence = buildEvidenceView(finding);

  useEffect(() => {
    if (!viewerOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setViewerOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewerOpen]);

  function handleAction(action: FindingAction) {
    if (action === "approve" && !evidence.approvalGate.canApprove) {
      setDraft({
        action: "edit",
        title: "Approval needs review",
        body: [
          evidence.approvalGate.detail,
          "",
          ...evidence.approvalGate.reasons.map((reason) => `- ${reason}`),
          "",
          `Recommended edit: ${finding.recommendedFix}`,
        ].join("\n"),
        status: "needs_edit",
        cta: "Review first",
      });
      return;
    }

    setDraft(draftFindingAction(action, finding));
  }

  async function toggleProof() {
    const nextOpen = !proofOpen;
    setProofOpen(nextOpen);
    if (!nextOpen || proof) return;
    const response = await fetch(
      `/api/quadchain/packets?runId=${encodeURIComponent(finding.runId)}&sourceId=${encodeURIComponent(finding.id)}&limit=1`,
      { cache: "no-store" }
    ).catch(() => null);
    if (!response?.ok) return;
    const json = (await response.json()) as { packets?: QuadChainPacketSummary[] };
    setProof(json.packets?.[0] ?? null);
  }

  return (
    <div className="animate-fade-in space-y-2 rounded-lg border border-edge bg-panel p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-neutral-100">{finding.title}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${severityColor[finding.severity]}`}>
          {evidence.severityLabel}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-neutral-500">
        <span>{evidence.categoryLabel}</span>
        <span>·</span>
        <span className="truncate">{evidence.pageHost}</span>
        <span>·</span>
        <span>Confidence {Math.round(finding.confidence * 100)}%</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-full border border-edge bg-ink/50 px-2 py-0.5 text-neutral-400">
          {evidence.sourceLabel}
        </span>
        {evidence.selectorLabel && (
          <span className="max-w-full truncate rounded-full border border-edge bg-ink/50 px-2 py-0.5 font-mono text-neutral-500">
            {evidence.selectorLabel}
          </span>
        )}
        {evidence.screenshotUrl ? (
          <button
            type="button"
            onClick={() => setViewerOpen(true)}
            className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-accent transition hover:border-accent/60 hover:bg-accent/15"
          >
            View screenshot
          </button>
        ) : (
          <span className="rounded-full border border-edge bg-ink/50 px-2 py-0.5 text-neutral-600">
            No screenshot
          </span>
        )}
        <button
          type="button"
          onClick={toggleProof}
          className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-accent transition hover:border-accent/60 hover:bg-accent/15"
        >
          {proofOpen ? "Hide proof" : "Show proof"}
        </button>
      </div>

      {proofOpen && (
        <div className="rounded-md border border-accent/20 bg-accent/5 p-3">
          {proof ? (
            <div className="grid gap-2 text-[11px] text-neutral-400 sm:grid-cols-3">
              <div>
                <div className="text-neutral-600">Packet</div>
                <div className="mt-1 truncate font-mono text-neutral-300">{proof.certificateId}</div>
              </div>
              <div>
                <div className="text-neutral-600">Verifier</div>
                <div className={proof.accepted ? "mt-1 text-accent" : "mt-1 text-red-300"}>
                  {proof.accepted ? "accepted" : "rejected"}
                </div>
              </div>
              <div>
                <div className="text-neutral-600">Evidence</div>
                <div className="mt-1 text-neutral-300">
                  {proof.evidencePreserved}/{proof.evidenceRequired}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-neutral-500">No quadchain packet found yet.</div>
          )}
        </div>
      )}

      <div className="rounded-md border border-edge bg-ink/60 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className={`text-[11px] font-medium ${proofTextColor(evidence.proofTone)}`}>
              {evidence.proofLabel}
            </div>
            <div className="mt-1 text-[10px] text-neutral-500">
              Evidence score {evidence.proofScore}/100
            </div>
          </div>
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-neutral-900">
            <div
              className={`h-full rounded-full ${proofBarColor(evidence.proofTone)}`}
              style={{ width: `${evidence.proofScore}%` }}
            />
          </div>
        </div>
        {evidence.proofReasons.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {evidence.proofReasons.map((reason) => (
              <span
                key={reason}
                className="rounded-full border border-edge bg-panel px-2 py-0.5 text-[10px] text-neutral-500"
              >
                {reason}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-md border border-edge bg-ink/60 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-medium text-neutral-100">Trace and evals</div>
            <div className="mt-1 text-[10px] text-neutral-500">{evidence.traceSummary}</div>
          </div>
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
            Phoenix ready
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-5">
          {evidence.traceSteps.map((step) => (
            <div key={step.id} className="min-w-0 rounded border border-edge bg-panel p-2">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${traceDotColor(step.status)}`} />
                <span className="truncate text-[10px] font-medium text-neutral-300">{step.label}</span>
              </div>
              <div className="mt-1 truncate text-[9px] text-neutral-500">{step.id}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {evidence.evalSignals.map((signal) => (
            <span
              key={signal.label}
              className={`rounded-full border px-2 py-0.5 text-[10px] ${evalSignalColor(signal.status)}`}
              title={signal.label}
            >
              {signal.label}: {signal.value}
            </span>
          ))}
        </div>
      </div>

      {evidence.screenshotUrl && (
        <button
          type="button"
          onClick={() => setViewerOpen(true)}
          className="group block overflow-hidden rounded-md border border-edge bg-ink/60 text-left transition hover:border-neutral-700"
        >
          <img
            src={evidence.screenshotUrl}
            alt={`Screenshot evidence for ${finding.title}`}
            className="max-h-40 w-full object-cover opacity-80 transition group-hover:opacity-100"
          />
          <div className="border-t border-edge px-3 py-2 text-[11px] text-neutral-500">
            Screenshot evidence from {evidence.pageHost}
          </div>
        </button>
      )}

      {finding.evidence.quote && (
        <blockquote className="border-l-2 border-edge pl-2 text-xs italic text-neutral-400">
          “{finding.evidence.quote}”
        </blockquote>
      )}

      <p className="text-xs text-neutral-300">
        <span className="text-neutral-500">Why it matters: </span>
        {finding.businessImpact}
      </p>
      <p className="text-xs text-neutral-300">
        <span className="text-neutral-500">Fix: </span>
        {finding.recommendedFix}
      </p>

      {finding.sourceComparison && (
        <div className="rounded bg-ink/60 p-2 text-[11px] text-neutral-400">
          <div><span className="text-neutral-500">Internal: </span>{finding.sourceComparison.internalClaim}</div>
          <div><span className="text-neutral-500">External: </span>{finding.sourceComparison.externalClaim}</div>
        </div>
      )}

      <div className={`rounded-md border p-3 ${approvalGateColor(evidence.approvalGate.tone)}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-medium">{evidence.approvalGate.label}</div>
            <div className="mt-1 text-[10px] opacity-80">{evidence.approvalGate.detail}</div>
          </div>
          <span className="rounded-full border border-current px-2 py-0.5 text-[10px]">
            Human gate
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {evidence.approvalGate.reasons.map((reason) => (
            <span key={reason} className="rounded-full border border-current px-2 py-0.5 text-[10px] opacity-80">
              {reason}
            </span>
          ))}
        </div>
      </div>

      <ApprovalButtons onAction={handleAction} />

      {draft && (
        <ActionPreview
          draft={draft}
          onClose={() => setDraft(null)}
          onConfirm={handleAction}
        />
      )}

      {viewerOpen && evidence.screenshotUrl && (
        <ScreenshotViewer
          title={finding.title}
          pageHost={evidence.pageHost}
          screenshotUrl={evidence.screenshotUrl}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </div>
  );
}

function proofTextColor(tone: ReturnType<typeof buildEvidenceView>["proofTone"]): string {
  return {
    strong: "text-accent",
    medium: "text-amber-500",
    weak: "text-red-500",
  }[tone];
}

function proofBarColor(tone: ReturnType<typeof buildEvidenceView>["proofTone"]): string {
  return {
    strong: "bg-accent",
    medium: "bg-amber-300",
    weak: "bg-red-300",
  }[tone];
}

function traceDotColor(status: ReturnType<typeof buildEvidenceView>["traceSteps"][number]["status"]): string {
  return {
    passed: "bg-accent",
    warning: "bg-amber-300",
    missing: "bg-red-300",
    pending: "bg-neutral-400",
  }[status];
}

function evalSignalColor(status: ReturnType<typeof buildEvidenceView>["evalSignals"][number]["status"]): string {
  return {
    passed: "border-accent/30 bg-accent/10 text-accent",
    warning: "border-amber-300/40 bg-amber-100 text-amber-700",
    missing: "border-red-300/40 bg-red-100 text-red-700",
  }[status];
}

function approvalGateColor(tone: ReturnType<typeof buildEvidenceView>["approvalGate"]["tone"]): string {
  return {
    ready: "border-accent/30 bg-accent/10 text-accent",
    review: "border-amber-300/50 bg-amber-100 text-amber-700",
  }[tone];
}

function ActionPreview({
  draft,
  onClose,
  onConfirm,
}: {
  draft: ActionDraft;
  onClose: () => void;
  onConfirm: (action: FindingAction) => void;
}) {
  const confirmed = draft.status === "saved" || draft.status === "ignored";

  return (
    <div className="rounded-md border border-edge bg-ink/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-accent">{actionTone(draft.status)}</div>
          <div className="mt-1 truncate text-sm font-medium text-neutral-100">{draft.title}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-edge px-2 py-1 text-[11px] text-neutral-500 transition hover:border-neutral-700 hover:text-neutral-200"
        >
          Close
        </button>
      </div>
      <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap rounded border border-edge bg-panel p-3 text-[11px] leading-5 text-neutral-300">
        {draft.body}
      </pre>
      {!confirmed && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onConfirm("approve")}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-ink"
          >
            Approve draft
          </button>
          <button
            type="button"
            onClick={() => onConfirm("edit")}
            className="rounded-md border border-edge px-3 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-700"
          >
            Edit first
          </button>
        </div>
      )}
    </div>
  );
}

function ScreenshotViewer({
  title,
  pageHost,
  screenshotUrl,
  onClose,
}: {
  title: string;
  pageHost: string;
  screenshotUrl: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Screenshot evidence for ${title}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-edge bg-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-edge px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-neutral-100">{title}</div>
            <div className="mt-1 truncate text-xs text-neutral-500">{pageHost}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-edge px-3 py-1 text-xs text-neutral-400 transition hover:border-neutral-700 hover:text-neutral-100"
          >
            Close
          </button>
        </div>
        <div className="overflow-auto bg-ink p-4">
          <img
            src={screenshotUrl}
            alt={`Screenshot evidence for ${title}`}
            className="mx-auto max-h-[75vh] max-w-full rounded border border-edge object-contain"
          />
        </div>
      </div>
    </div>
  );
}
