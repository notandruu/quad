"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type OperatorRun = {
  runId: string;
  status: string;
  title: string;
  targetUrl?: string;
  artifacts: Array<{ id: string; kind: string; title: string; hash: string }>;
  approvals: Array<{ id: string; decision: string; reason: string; evidenceVisible: boolean }>;
  receipts: Array<{ id: string; status: string; summary: string; artifactHash: string }>;
  nextAction: string;
};

type OperatorCapability = {
  id: string;
  name?: string;
  kind?: string;
  approvalMode?: string;
  sponsor?: string;
  status?: string;
  reason?: string;
  missingEnv?: string[];
};

type OperatorArtifact = {
  id: string;
  runId: string;
  artifactId: string | null;
  href: string;
  runHref: string;
  title: string;
  kind: string;
  status: string;
  headline: string;
  preview: {
    label: string;
    primaryMetric: string;
    primaryLabel: string;
    secondaryMetric: string;
    secondaryLabel: string;
    risk: string;
  };
  proof: Array<{ id: string; status: string; summary: string; artifactHash: string }>;
};

type HostedArtifactPayload = {
  ok: boolean;
  artifact?: {
    id: string;
    runId: string;
    kind: string;
    title: string;
    hash: string;
    createdAt: string;
    data: unknown;
    links: {
      self: string;
      run: string;
    };
  };
  detail?: {
    run: {
      id: string;
      status: string;
      title: string;
    };
    links: {
      self: string;
      artifacts: string;
      tasks: string;
    };
  };
};

type OperatorResponse = {
  ok: boolean;
  orgId: string;
  workline: string[];
  runs: OperatorRun[];
  pendingApprovals: Array<{
    id: string;
    runId: string;
    runTitle: string;
    decision: string;
    reason: string;
    evidenceVisible: boolean;
    targetUrl: string | null;
  }>;
  artifacts: OperatorArtifact[];
  capabilities: {
    active: OperatorCapability[];
    blocked: OperatorCapability[];
    starterBundle: string[];
  };
};

export function OperatorConsole({ orgId = "org_brightpath", watchRunId }: { orgId?: string; watchRunId?: string | null }) {
  const [data, setData] = useState<OperatorResponse | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [artifactTab, setArtifactTab] = useState<"preview" | "data" | "proof">("preview");
  const [artifactDetail, setArtifactDetail] = useState<HostedArtifactPayload | null>(null);
  const [artifactDetailStatus, setArtifactDetailStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [decisionState, setDecisionState] = useState<{ id: string; decision: "approved" | "rejected" } | null>(null);
  const [publishingRunId, setPublishingRunId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/operator?orgId=${encodeURIComponent(orgId)}&limit=8`, {
      cache: "no-store",
    }).catch(() => null);
    if (!response?.ok) return;
    const json = (await response.json()) as OperatorResponse;
    setData(json);
    setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
  }, [orgId]);

  useEffect(() => {
    let cancelled = false;

    async function loadIfActive() {
      const response = await fetch(`/api/operator?orgId=${encodeURIComponent(orgId)}&limit=8`, {
        cache: "no-store",
      }).catch(() => null);
      if (!response?.ok) return;
      const json = (await response.json()) as OperatorResponse;
      if (!cancelled) {
        setData(json);
        setUpdatedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
    }

    void loadIfActive();
    const id = window.setInterval(loadIfActive, 6000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [orgId, watchRunId]);

  const counts = useMemo(() => {
    const runs = data?.runs ?? [];
    return {
      runs: runs.length,
      approvals: data?.pendingApprovals.length ?? 0,
      readyReceipts: runs.flatMap((run) => run.receipts).filter((receipt) => receipt.status === "ready").length,
      activeTools: data?.capabilities.active.length ?? 0,
    };
  }, [data]);

  const activeArtifact = useMemo(() => {
    const artifacts = data?.artifacts ?? [];
    return artifacts.find((artifact) => artifact.id === activeArtifactId) ?? artifacts[0] ?? null;
  }, [activeArtifactId, data?.artifacts]);

  useEffect(() => {
    if (!activeArtifact || artifactTab !== "data") return;
    let cancelled = false;
    setArtifactDetailStatus("loading");
    fetch(activeArtifact.href, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((json: HostedArtifactPayload | null) => {
        if (cancelled) return;
        if (!json?.ok) {
          setArtifactDetail(null);
          setArtifactDetailStatus("error");
          return;
        }
        setArtifactDetail(json);
        setArtifactDetailStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setArtifactDetail(null);
        setArtifactDetailStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [activeArtifact, artifactTab]);

  if (!data) {
    return (
      <section className="rounded-lg border border-edge bg-panel p-3">
        <h2 className="text-sm font-medium text-neutral-100">Operator console</h2>
        <div className="mt-3 h-28 animate-pulse rounded border border-edge bg-ink/50" />
      </section>
    );
  }

  const latestRuns = data.runs.slice(0, 3);

  async function decideApproval(approval: OperatorResponse["pendingApprovals"][number], decision: "approved" | "rejected") {
    setDecisionState({ id: approval.id, decision });
    const response = await fetch(`/api/approvals/${encodeURIComponent(approval.id)}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runId: approval.runId,
        orgId: data?.orgId,
        decision,
        approver: "demo.operator",
        reason:
          decision === "approved"
            ? "Approved from the operator console."
            : "Rejected from the operator console.",
      }),
    }).catch(() => null);
    setDecisionState(null);
    if (response?.ok) await load();
  }

  async function stagePublish(run: OperatorRun) {
    setPublishingRunId(run.runId);
    const response = await fetch("/api/publish/dry-run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runId: run.runId,
        orgId: data?.orgId,
        actor: "demo.operator",
      }),
    }).catch(() => null);
    setPublishingRunId(null);
    if (response?.ok) {
      const result = (await response.json().catch(() => null)) as { staged?: Array<{ artifact?: { id?: string } }> } | null;
      const stagedArtifactId = result?.staged?.[0]?.artifact?.id;
      if (stagedArtifactId) setActiveArtifactId(`artifact_${stagedArtifactId}`);
      setArtifactTab("preview");
      await load();
    }
  }

  return (
    <section className="rounded-lg border border-accent/25 bg-panel p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-neutral-100">Operator console</h2>
          <p className="mt-1 font-mono text-[10px] text-neutral-600">
            {data.workline.join(" --> ")}
          </p>
        </div>
        <span className="rounded-full border border-edge bg-ink/50 px-2 py-0.5 font-mono text-[10px] text-neutral-500">
          {updatedAt ? `synced ${updatedAt}` : "syncing"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <OperatorStat label="runs" value={String(counts.runs)} />
        <OperatorStat label="approvals" value={String(counts.approvals)} accent={counts.approvals > 0} />
        <OperatorStat label="receipts" value={String(counts.readyReceipts)} />
        <OperatorStat label="tools" value={String(counts.activeTools)} accent />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)]">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-neutral-200">Recent runs</h3>
            <span className="text-[10px] text-neutral-600">{data.orgId}</span>
          </div>
          {latestRuns.length > 0 ? (
            latestRuns.map((run) => (
              <RunCard
                key={run.runId}
                run={run}
                active={activeArtifact?.runId === run.runId}
                publishing={publishingRunId === run.runId}
                onPublish={() => void stagePublish(run)}
                onInspect={() => {
                  setActiveArtifactId(`artifact_${run.runId}`);
                  setArtifactTab("preview");
                }}
              />
            ))
          ) : (
            <div className="rounded border border-dashed border-edge bg-ink/30 p-3 text-xs text-neutral-600">
              No run receipts yet. Build a trust packet to populate the queue.
            </div>
          )}
        </div>

        <ArtifactSidecar
          artifact={activeArtifact}
          artifacts={data.artifacts}
          tab={artifactTab}
          detail={artifactDetail}
          detailStatus={artifactDetailStatus}
          onTabChange={setArtifactTab}
          onSelect={setActiveArtifactId}
        />

        <div className="space-y-3 xl:col-span-2">
          <div>
            <h3 className="text-xs font-medium text-neutral-200">Approval queue</h3>
            <div className="mt-2 space-y-2">
              {data.pendingApprovals.length > 0 ? (
                data.pendingApprovals.slice(0, 3).map((approval) => (
                  <div key={approval.id} className="rounded border border-accent/25 bg-accent/5 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-neutral-200">{approval.runTitle}</span>
                      <span className="text-[10px] text-accent">pending</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-neutral-500">{approval.reason}</p>
                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        disabled={Boolean(decisionState)}
                        onClick={() => void decideApproval(approval, "approved")}
                        className="rounded border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent hover:border-accent/60 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {decisionState?.id === approval.id && decisionState.decision === "approved" ? "Approving packet" : "Approve packet"}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(decisionState)}
                        onClick={() => void decideApproval(approval, "rejected")}
                        className="rounded border border-red-300/30 bg-red-950/20 px-2 py-0.5 text-[10px] text-red-200 hover:border-red-300/60 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {decisionState?.id === approval.id && decisionState.decision === "rejected" ? "Rejecting packet" : "Reject packet"}
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded border border-edge bg-ink/40 p-2 text-[11px] text-neutral-600">
                  No pending approvals.
                </div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium text-neutral-200">Capability registry</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {data.capabilities.active.slice(0, 7).map((capability) => (
                <CapabilityPill key={capability.id} capability={capability} active />
              ))}
              {data.capabilities.blocked.slice(0, 4).map((capability) => (
                <CapabilityPill key={capability.id} capability={capability} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function OperatorStat({
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

function RunCard({
  run,
  active,
  publishing,
  onInspect,
  onPublish,
}: {
  run: OperatorRun;
  active: boolean;
  publishing: boolean;
  onInspect: () => void;
  onPublish: () => void;
}) {
  const receipt = run.receipts[0];
  const canStage = run.approvals.some((approval) => approval.decision === "approved");
  const hasStaged = run.artifacts.some((artifact) =>
    artifact.kind === "cms_draft" || artifact.kind === "task_draft" || artifact.kind === "trust_packet_export"
  );

  return (
    <div className={active ? "rounded border border-accent/40 bg-accent/5 p-2" : "rounded border border-edge bg-ink/45 p-2"}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-neutral-100">{run.title}</div>
          <div className="mt-0.5 truncate font-mono text-[9px] text-neutral-600">{run.runId}</div>
        </div>
        <span className={statusClass(run.status)}>{formatStatus(run.status)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {receipt && (
          <span className="rounded-full border border-edge bg-panel px-2 py-0.5 text-[10px] text-neutral-400">
            receipt {receipt.status}
          </span>
        )}
        <a
          href={`/quadchain?runId=${encodeURIComponent(run.runId.replace(/^trust_/, ""))}`}
          className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent hover:border-accent/60"
        >
          View proof
        </a>
        <button
          type="button"
          onClick={onInspect}
          className="rounded-full border border-edge bg-panel px-2 py-0.5 text-[10px] text-neutral-300 hover:border-accent/40 hover:text-accent"
        >
          Open artifact
        </button>
        {canStage && (
          <button
            type="button"
            onClick={onPublish}
            disabled={publishing || hasStaged}
            className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent hover:border-accent/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {hasStaged ? "Fix staged" : publishing ? "Staging fix" : "Stage fix"}
          </button>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-neutral-500">{run.nextAction}</p>
    </div>
  );
}

function ArtifactSidecar({
  artifact,
  artifacts,
  tab,
  detail,
  detailStatus,
  onTabChange,
  onSelect,
}: {
  artifact: OperatorArtifact | null;
  artifacts: OperatorArtifact[];
  tab: "preview" | "data" | "proof";
  detail: HostedArtifactPayload | null;
  detailStatus: "idle" | "loading" | "ready" | "error";
  onTabChange: (tab: "preview" | "data" | "proof") => void;
  onSelect: (id: string) => void;
}) {
  if (!artifact) {
    return (
      <div className="rounded border border-dashed border-edge bg-ink/30 p-3 text-xs text-neutral-600">
        No artifacts yet.
      </div>
    );
  }

  return (
    <aside className="min-h-[310px] overflow-hidden rounded border border-accent/30 bg-ink/55">
      <div className="border-b border-edge bg-panel/80 p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-accent">Artifact sidecar</div>
            <h3 className="mt-1 truncate text-xs font-medium text-neutral-100">{artifact.title}</h3>
          </div>
          <select
            value={artifact.id}
            onChange={(event) => onSelect(event.currentTarget.value)}
            className="max-w-28 rounded border border-edge bg-ink px-2 py-1 text-[10px] text-neutral-300 outline-none"
            aria-label="Select artifact"
          >
            {artifacts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.kind.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {(["preview", "data", "proof"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onTabChange(item)}
              className={
                tab === item
                  ? "rounded border border-accent/40 bg-accent/15 px-2 py-1 text-[10px] text-accent"
                  : "rounded border border-edge bg-ink px-2 py-1 text-[10px] text-neutral-500 hover:text-neutral-200"
              }
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3">
        {tab === "preview" && <ArtifactPreview artifact={artifact} />}
        {tab === "data" && <ArtifactData artifact={artifact} detail={detail} detailStatus={detailStatus} />}
        {tab === "proof" && <ArtifactProof artifact={artifact} />}
      </div>
    </aside>
  );
}

function ArtifactPreview({ artifact }: { artifact: OperatorArtifact }) {
  return (
    <div className="space-y-3">
      <div className="rounded border border-edge bg-panel p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] text-neutral-500">{artifact.preview.label}</span>
          <span className={statusClass(artifact.status)}>{formatStatus(artifact.status)}</span>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
          <div>
            <div className="text-3xl font-semibold text-neutral-100">{artifact.preview.primaryMetric}</div>
            <div className="mt-1 text-[10px] text-neutral-500">{artifact.preview.primaryLabel}</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-medium text-accent">{artifact.preview.secondaryMetric}</div>
            <div className="mt-1 text-[10px] text-neutral-500">{artifact.preview.secondaryLabel}</div>
          </div>
        </div>
        <div className="mt-4 h-16 overflow-hidden rounded border border-edge bg-ink/80 p-2 font-mono text-[9px] leading-4 text-neutral-500">
          <div>+ source bound</div>
          <div>+ evidence preserved</div>
          <div>+ verifier accepted</div>
          <div>+ queued for operator review</div>
        </div>
      </div>
      <p className="line-clamp-3 text-[10px] leading-4 text-neutral-500">{artifact.headline}</p>
      <div className="rounded border border-accent/20 bg-accent/5 px-2 py-1 text-[10px] text-accent">
        {artifact.preview.risk}
      </div>
    </div>
  );
}

function ArtifactData({
  artifact,
  detail,
  detailStatus,
}: {
  artifact: OperatorArtifact;
  detail: HostedArtifactPayload | null;
  detailStatus: "idle" | "loading" | "ready" | "error";
}) {
  const lines = [
    ["artifact", artifact.id],
    ["run", artifact.runId],
    ["kind", artifact.kind],
    ["status", artifact.status],
    ["hosted", artifact.href],
    ["proof rows", String(artifact.proof.length)],
  ];

  return (
    <div className="space-y-2">
      <div className="space-y-1 font-mono text-[10px]">
        {lines.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3 rounded border border-edge bg-panel px-2 py-1">
            <span className="text-neutral-600">{key}</span>
            <span className="truncate text-neutral-300">{value}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <a
          href={artifact.href}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-accent/30 bg-accent/10 px-2 py-1 text-[10px] text-accent hover:border-accent/60"
        >
          Open hosted artifact
        </a>
        <a
          href={artifact.runHref}
          target="_blank"
          rel="noreferrer"
          className="rounded border border-edge bg-panel px-2 py-1 text-[10px] text-neutral-300 hover:border-accent/40 hover:text-accent"
        >
          Open run
        </a>
      </div>
      <div className="max-h-36 overflow-auto rounded border border-edge bg-ink/80 p-2 font-mono text-[9px] leading-4 text-neutral-400">
        {detailStatus === "loading" && "loading hosted payload..."}
        {detailStatus === "error" && "hosted payload unavailable"}
        {detailStatus === "ready" && (
          <pre className="whitespace-pre-wrap break-words">
            {JSON.stringify(detail?.artifact?.data ?? detail?.detail ?? null, null, 2)}
          </pre>
        )}
        {detailStatus === "idle" && "select data to load the hosted payload"}
      </div>
    </div>
  );
}

function ArtifactProof({ artifact }: { artifact: OperatorArtifact }) {
  return (
    <div className="space-y-2">
      {artifact.proof.map((proof) => (
        <div key={proof.id} className="rounded border border-edge bg-panel p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[9px] text-neutral-500">{proof.id}</span>
            <span className={proof.status === "blocked" ? "text-[10px] text-amber-200" : "text-[10px] text-accent"}>
              {formatStatus(proof.status)}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-neutral-500">{proof.summary}</p>
          <div className="mt-2 truncate font-mono text-[9px] text-neutral-700">{proof.artifactHash}</div>
        </div>
      ))}
    </div>
  );
}

function CapabilityPill({ capability, active = false }: { capability: OperatorCapability; active?: boolean }) {
  return (
    <span
      className={
        active
          ? "rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent"
          : "rounded-full border border-amber-300/30 bg-amber-950/20 px-2 py-0.5 text-[10px] text-amber-100"
      }
      title={capability.reason ?? capability.id}
    >
      {capability.sponsor ?? capability.name ?? capability.id}
    </span>
  );
}

function statusClass(status: string) {
  if (status === "needs_approval") return "shrink-0 text-[10px] text-accent";
  if (status === "failed") return "shrink-0 text-[10px] text-red-300";
  if (status === "completed") return "shrink-0 text-[10px] text-neutral-300";
  return "shrink-0 text-[10px] text-amber-200";
}

function formatStatus(status: string) {
  return status.replace("_", " ");
}
