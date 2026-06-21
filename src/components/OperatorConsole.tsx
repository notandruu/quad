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
  taskEvents?: TaskEventSummary[];
  nextAction: string;
};

type TaskEventSummary = {
  id: string;
  sequence: number;
  kind: string;
  actor: string;
  message: string;
  createdAt: string;
  taskId?: string;
  artifactId?: string;
  approvalId?: string;
  receiptId?: string;
  capabilityId?: string;
  status?: string;
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
  outcome?: {
    summary: string;
    status: "drafted" | "executed" | "paused" | "verified" | "blocked";
    submitted: boolean | null;
    autonomy: {
      tier: string;
      label: string;
      approvalRequired: boolean;
      humanReviewRequired: boolean;
      submitsExternally: boolean;
      nextTier: string | null;
    };
    target: {
      connectorId: string;
      destination: string;
      selector: string | null;
      url: string | null;
    };
    evidence: Array<{
      label: string;
      storageMode: string;
      hash: string;
      storageKey: string | null;
      sourceUrl: string | null;
    }>;
    fields: Array<{
      label: string;
      selector: string;
      valueHash: string;
    }>;
    rollback: string[];
    verifier: {
      required: boolean;
      name: string;
      checks: string[];
    };
    openObligations: string[];
  } | null;
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

type ShipTrailStep = {
  id: "audit" | "packet" | "approval" | "publish" | "verify";
  label: string;
  status: "pending" | "active" | "blocked" | "complete";
  summary: string;
  artifactId?: string;
  receiptId?: string;
  href: string;
  createdAt: string;
};

type QuadChainPacketSummary = {
  id: string;
  type: string;
  runId: string;
  certificateId: string;
  accepted: boolean;
  failures: string[];
  evidencePreserved: number;
  evidenceRequired: number;
  tokensSaved: number;
  visibility: "public" | "internal" | "restricted";
  createdAt: string;
};

type MemoryTrailSummary = {
  total: number;
  shown: number;
  stale: number;
  fresh: number;
  unknownFreshness: number;
  company: number;
  team: number;
  personal: number;
  relationshipCount: number;
  latest: Array<{
    id: string;
    sourceId: string;
    sourceType: string;
    title: string;
    summary: string;
    confidence: number;
    updatedAt: string;
    evidenceCount: number;
    metadata: {
      visibility: "company" | "team" | "personal";
      ownerUserId: string | null;
      teamIds: string[];
      validationStatus: "unverified" | "verified" | "approved";
      sourceUpdatedAt: string | null;
      staleAfter: string | null;
      freshness: "fresh" | "stale" | "unknown";
      relationships: Array<{ kind: string; sourceId: string; label?: string }>;
    };
  }>;
};

type MemoryTrailItem = MemoryTrailSummary["latest"][number];

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
    dataPreview?: unknown;
    rawDataIncluded?: boolean;
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
  shipTrails: Record<string, ShipTrailStep[]>;
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
  worker?: {
    queue: {
      queueDepth: number;
      retrying: number;
      deadLetter: number;
      running?: number;
      completed?: number;
      latestUpdatedAt?: string | null;
    };
    runtime: {
      alive: boolean;
      seen: boolean;
      workerId: string | null;
      lastHeartbeatAt?: string | null;
      processed?: number;
      staleAfterMs?: number;
    };
    canary: {
      seen: boolean;
      ok: boolean;
      status: string | null;
      lastRunAt: string | null;
      durationMs?: number | null;
      jobId?: string | null;
    };
  };
  backendReadiness?: {
    ok: boolean;
    mode: "production_ready" | "degraded" | "demo_fallback";
    generatedAt: string;
    nextActions: string[];
    components: Record<
      string,
      {
        status: "ready" | "degraded" | "missing";
        configured: boolean;
        detail: string;
      }
    >;
  };
  quadChain?: {
    total: number;
    accepted: number;
    rejected: number;
    tokensSaved: number;
    evidencePreserved: number;
    evidenceRequired: number;
    latest: QuadChainPacketSummary[];
  };
  memory?: MemoryTrailSummary | null;
  usage?: {
    posture: {
      billingReady: boolean;
      source: "receipt_sample";
      warning: string | null;
    };
    totals: {
      runs: number;
      approvals: number;
      artifacts: number;
      receipts: number;
      connectorActions: number;
      quadchainPackets: number;
      acceptedPackets: number;
      rejectedPackets: number;
      tokensSaved: number;
      evidenceBundles: number;
      evidenceBytes: number;
      modelCalls: number;
      completedModelCalls: number;
      failedModelCalls: number;
      blockedModelCalls: number;
      inputTokens: number;
      outputTokens: number;
      runtimeTraces: number;
      failedRuntimeTraces: number;
      estimatedCostUsd: number;
    };
    byKind: {
      artifacts: Record<string, number>;
      evidence: Record<string, number>;
      runtime: Record<string, number>;
      modelPurpose: Record<string, number>;
    };
  };
};

type InstallPlanResponse = {
  ok: boolean;
  plan?: {
    bundleId: string;
    knownIds: string[];
    unknownIds: string[];
    alreadyActive: string[];
    newlyAllowlisted: string[];
    newlyForceInstalled: string[];
    envRequired: Array<{ id: string; missingEnv: string[] }>;
    blockedAfterInstall: Array<{ id: string; reason: string; missingEnv: string[] }>;
    activeAfterInstall: Array<{ id: string; name: string; kind: string }>;
  };
};

export function OperatorConsole({ orgId = "org_redcross", watchRunId }: { orgId?: string; watchRunId?: string | null }) {
  const [data, setData] = useState<OperatorResponse | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const [artifactTab, setArtifactTab] = useState<"preview" | "data" | "proof">("preview");
  const [artifactDetail, setArtifactDetail] = useState<HostedArtifactPayload | null>(null);
  const [artifactDetailStatus, setArtifactDetailStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [decisionState, setDecisionState] = useState<{ id: string; decision: "approved" | "rejected" } | null>(null);
  const [publishingRunId, setPublishingRunId] = useState<string | null>(null);
  const [executingRunId, setExecutingRunId] = useState<string | null>(null);
  const [verifyingRunId, setVerifyingRunId] = useState<string | null>(null);
  const [installPlan, setInstallPlan] = useState<InstallPlanResponse["plan"] | null>(null);
  const [installRequestState, setInstallRequestState] = useState<"idle" | "requesting" | "requested" | "error">("idle");
  const [refreshingMemoryId, setRefreshingMemoryId] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/metaregistry/install-plan?orgId=${encodeURIComponent(orgId)}&includeWriteTools=1`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((json: InstallPlanResponse | null) => {
        if (!cancelled) setInstallPlan(json?.plan ?? null);
      })
      .catch(() => {
        if (!cancelled) setInstallPlan(null);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const counts = useMemo(() => {
    const runs = data?.runs ?? [];
    return {
      runs: runs.length,
      approvals: data?.pendingApprovals.length ?? 0,
      readyReceipts: runs.flatMap((run) => run.receipts).filter((receipt) => receipt.status === "ready").length,
      activeTools: data?.capabilities.active.length ?? 0,
      backend: data?.backendReadiness?.ok ? "pass" : data?.worker?.canary.ok ? "canary" : data?.worker?.runtime.alive ? "live" : "check",
    };
  }, [data]);

  const activeArtifact = useMemo(() => {
    const artifacts = data?.artifacts ?? [];
    return artifacts.find((artifact) => artifact.id === activeArtifactId) ?? artifacts[0] ?? null;
  }, [activeArtifactId, data?.artifacts]);

  const taskEvents = useMemo(() => {
    return (data?.runs ?? [])
      .flatMap((run) =>
        (run.taskEvents ?? []).map((event) => ({
          ...event,
          runId: run.runId,
          runTitle: run.title,
        }))
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.sequence - a.sequence)
      .slice(0, 8);
  }, [data?.runs]);

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
  const activeTrail = activeArtifact ? data.shipTrails[activeArtifact.runId] ?? [] : [];

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

  async function verifyFix(run: OperatorRun) {
    setVerifyingRunId(run.runId);
    const response = await fetch("/api/verify-fix", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runId: run.runId,
        orgId: data?.orgId,
        actor: "demo.operator",
      }),
    }).catch(() => null);
    setVerifyingRunId(null);
    if (response?.ok) {
      const result = (await response.json().catch(() => null)) as { task?: OperatorRun } | null;
      const verificationArtifact = result?.task?.artifacts?.find((artifact) => artifact.kind === "verification_report");
      if (verificationArtifact) setActiveArtifactId(`artifact_${verificationArtifact.id}`);
      setArtifactTab("preview");
      await load();
    }
  }

  async function executePublish(run: OperatorRun) {
    setExecutingRunId(run.runId);
    const response = await fetch("/api/publish/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        runId: run.runId,
        orgId: data?.orgId,
        actor: "demo.operator",
      }),
    }).catch(() => null);
    setExecutingRunId(null);
    if (response?.ok) {
      const result = (await response.json().catch(() => null)) as { executed?: Array<{ artifact?: { id?: string } }> } | null;
      const executionArtifactId = result?.executed?.[0]?.artifact?.id;
      if (executionArtifactId) setActiveArtifactId(`artifact_${executionArtifactId}`);
      setArtifactTab("preview");
      await load();
    }
  }

  async function requestCapabilityInstall() {
    setInstallRequestState("requesting");
    const response = await fetch("/api/metaregistry/install-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orgId: data?.orgId,
        actor: "demo.operator",
        includeWriteTools: true,
      }),
    }).catch(() => null);
    if (!response?.ok) {
      setInstallRequestState("error");
      return;
    }
    setInstallRequestState("requested");
    await load();
  }

  async function requestMemoryRefresh(item: MemoryTrailItem) {
    setRefreshingMemoryId(item.id);
    const response = await fetch("/api/brain/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orgId: data?.orgId,
        memoryId: item.id,
        sourceId: item.sourceId,
        reason: `Refresh ${item.title} before agents reuse stale context.`,
      }),
    }).catch(() => null);
    setRefreshingMemoryId(null);
    if (response?.ok) await load();
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

      <div className="mt-3 grid grid-cols-5 gap-2 text-center">
        <OperatorStat label="runs" value={String(counts.runs)} />
        <OperatorStat label="approvals" value={String(counts.approvals)} accent={counts.approvals > 0} />
        <OperatorStat label="receipts" value={String(counts.readyReceipts)} />
        <OperatorStat label="tools" value={String(counts.activeTools)} accent />
        <OperatorStat label="backend" value={counts.backend} accent={counts.backend === "pass"} />
      </div>

      {data.backendReadiness && <BackendReadinessPanel readiness={data.backendReadiness} />}
      {data.worker && <WorkerUptimePanel worker={data.worker} />}
      {data.usage && <UsageMeteringPanel usage={data.usage} />}
      {data.quadChain && <QuadChainTrustTrail quadChain={data.quadChain} />}
      {data.memory && (
        <MemoryTrailPanel
          memory={data.memory}
          refreshingMemoryId={refreshingMemoryId}
          onRefresh={(item) => void requestMemoryRefresh(item)}
        />
      )}

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
                executing={executingRunId === run.runId}
                verifying={verifyingRunId === run.runId}
                onPublish={() => void stagePublish(run)}
                onExecute={() => void executePublish(run)}
                onVerify={() => void verifyFix(run)}
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
          shipTrail={activeTrail}
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

          <CapabilityInstallPlan
            plan={installPlan}
            state={installRequestState}
            onRequestInstall={() => void requestCapabilityInstall()}
          />
          <TaskStream events={taskEvents} />
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

function QuadChainTrustTrail({ quadChain }: { quadChain: NonNullable<OperatorResponse["quadChain"]> }) {
  const latest = quadChain.latest.slice(0, 5);
  const evidenceLabel =
    quadChain.evidenceRequired > 0
      ? `${quadChain.evidencePreserved}/${quadChain.evidenceRequired}`
      : "n/a";

  return (
    <div className="mt-3 rounded border border-accent/25 bg-ink/45 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-medium text-neutral-200">Quadchain trust trail</h3>
          <p className="mt-1 font-mono text-[9px] text-neutral-600">
            live receipts from chat, voice, fetch, worker, and audit surfaces
          </p>
        </div>
        <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
          {quadChain.accepted}/{quadChain.total} accepted
        </span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <OperatorStat label="packets" value={String(quadChain.total)} accent={quadChain.total > 0} />
        <OperatorStat label="rejected" value={String(quadChain.rejected)} accent={quadChain.rejected === 0} />
        <OperatorStat label="evidence" value={evidenceLabel} accent={quadChain.evidencePreserved >= quadChain.evidenceRequired} />
        <OperatorStat label="tokens" value={String(quadChain.tokensSaved)} />
      </div>
      <div className="mt-3 space-y-1.5">
        {latest.length > 0 ? (
          latest.map((packet) => (
            <a
              key={packet.id}
              href={`/quadchain?runId=${encodeURIComponent(packet.runId)}`}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded border border-edge bg-panel px-2 py-1.5 hover:border-accent/35"
            >
              <span className="min-w-0">
                <span className="block truncate text-[10px] text-neutral-300">{formatStatus(packet.type)}</span>
                <span className="block truncate font-mono text-[9px] text-neutral-600">{packet.certificateId}</span>
              </span>
              <span className={packet.accepted ? "text-[10px] text-accent" : "text-[10px] text-red-200"}>
                {packet.accepted ? "accepted" : "rejected"}
              </span>
            </a>
          ))
        ) : (
          <div className="rounded border border-dashed border-edge bg-ink/30 p-2 text-[10px] text-neutral-600">
            No quadchain packets yet.
          </div>
        )}
      </div>
    </div>
  );
}

function UsageMeteringPanel({ usage }: { usage: NonNullable<OperatorResponse["usage"]> }) {
  const evidenceMb = usage.totals.evidenceBytes > 0
    ? `${(usage.totals.evidenceBytes / 1_000_000).toFixed(2)}mb`
    : "0mb";
  const modelIssueCount = usage.totals.failedModelCalls + usage.totals.blockedModelCalls;
  const topArtifact = topEntry(usage.byKind.artifacts);

  return (
    <div className="mt-3 rounded border border-edge bg-ink/45 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-medium text-neutral-200">Usage meter</h3>
          <p className="mt-1 font-mono text-[9px] text-neutral-600">
            receipt-derived internal metering for hosted runs
          </p>
        </div>
        <span className={usage.posture.billingReady ? "rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent" : "rounded-full border border-amber-300/30 bg-amber-950/20 px-2 py-0.5 text-[10px] text-amber-100"}>
          {usage.posture.billingReady ? "billing ready" : "internal only"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        <OperatorStat label="runs" value={String(usage.totals.runs)} />
        <OperatorStat label="actions" value={String(usage.totals.connectorActions)} accent={usage.totals.connectorActions > 0} />
        <OperatorStat label="tokens" value={String(usage.totals.inputTokens + usage.totals.outputTokens)} />
        <OperatorStat label="evidence" value={evidenceMb} />
        <OperatorStat label="cost" value={`$${usage.totals.estimatedCostUsd.toFixed(4)}`} />
      </div>

      <div className="mt-2 grid gap-1.5 md:grid-cols-3">
        <UsageRow label="model calls" value={`${usage.totals.completedModelCalls}/${usage.totals.modelCalls}`} />
        <UsageRow label="model issues" value={String(modelIssueCount)} />
        <UsageRow label="quadchain" value={`${usage.totals.acceptedPackets}/${usage.totals.quadchainPackets}`} />
        <UsageRow label="receipts" value={String(usage.totals.receipts)} />
        <UsageRow label="traces" value={`${usage.totals.runtimeTraces - usage.totals.failedRuntimeTraces}/${usage.totals.runtimeTraces}`} />
        <UsageRow label="top artifact" value={topArtifact ? `${topArtifact[0]}:${topArtifact[1]}` : "none"} />
      </div>

      {usage.posture.warning && (
        <div className="mt-2 rounded border border-amber-300/25 bg-amber-950/20 px-2 py-1 text-[10px] text-amber-100">
          {usage.posture.warning}
        </div>
      )}
    </div>
  );
}

function UsageRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-edge bg-panel px-2 py-1.5">
      <div className="text-[9px] text-neutral-600">{label}</div>
      <div className="mt-0.5 truncate font-mono text-[10px] text-neutral-300">{value}</div>
    </div>
  );
}

function MemoryTrailPanel({
  memory,
  refreshingMemoryId,
  onRefresh,
}: {
  memory: MemoryTrailSummary;
  refreshingMemoryId: string | null;
  onRefresh: (item: MemoryTrailItem) => void;
}) {
  return (
    <div className="mt-3 rounded border border-pink-300/25 bg-ink/45 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-medium text-neutral-200">Memory trail</h3>
          <p className="mt-1 font-mono text-[9px] text-neutral-600">
            scoped context graph signals from approved memory
          </p>
        </div>
        <span className={memory.stale > 0 ? "rounded-full border border-amber-300/30 bg-amber-950/20 px-2 py-0.5 text-[10px] text-amber-100" : "rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent"}>
          {memory.stale > 0 ? `${memory.stale} stale` : "fresh enough"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <OperatorStat label="memories" value={String(memory.total)} accent={memory.total > 0} />
        <OperatorStat label="fresh" value={String(memory.fresh)} accent={memory.fresh > 0 && memory.stale === 0} />
        <OperatorStat label="scoped" value={`${memory.company}/${memory.team}/${memory.personal}`} />
        <OperatorStat label="edges" value={String(memory.relationshipCount)} accent={memory.relationshipCount > 0} />
      </div>

      <div className="mt-3 space-y-1.5">
        {memory.latest.length > 0 ? (
          memory.latest.slice(0, 4).map((item) => (
            <div key={item.id} className="rounded border border-edge bg-panel px-2 py-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[10px] text-neutral-300">{item.title}</div>
                  <div className="mt-0.5 truncate font-mono text-[9px] text-neutral-600">
                    {item.sourceType} · {item.metadata.visibility} · {item.metadata.validationStatus}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {item.metadata.freshness === "stale" && (
                    <button
                      type="button"
                      disabled={refreshingMemoryId === item.id}
                      onClick={() => onRefresh(item)}
                      className="rounded border border-amber-300/30 bg-amber-950/20 px-1.5 py-0.5 text-[9px] text-amber-100 hover:border-amber-300/60 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {refreshingMemoryId === item.id ? "Refreshing" : "Refresh"}
                    </button>
                  )}
                  <span className={freshnessClass(item.metadata.freshness)}>
                    {item.metadata.freshness}
                  </span>
                </div>
              </div>
              <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-neutral-500">{item.summary}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                <span className="rounded-full border border-edge bg-ink px-1.5 py-0.5 text-[9px] text-neutral-500">
                  {item.evidenceCount} evidence
                </span>
                <span className="rounded-full border border-edge bg-ink px-1.5 py-0.5 text-[9px] text-neutral-500">
                  {Math.round(item.confidence * 100)}% confidence
                </span>
                {item.metadata.ownerUserId && (
                  <span className="rounded-full border border-edge bg-ink px-1.5 py-0.5 text-[9px] text-neutral-500">
                    owner {item.metadata.ownerUserId}
                  </span>
                )}
                {item.metadata.relationships.length > 0 && (
                  <span className="rounded-full border border-accent/25 bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent">
                    {item.metadata.relationships.length} related
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded border border-dashed border-edge bg-ink/30 p-2 text-[10px] text-neutral-600">
            No readable memories yet.
          </div>
        )}
      </div>
    </div>
  );
}

function BackendReadinessPanel({ readiness }: { readiness: NonNullable<OperatorResponse["backendReadiness"]> }) {
  const componentEntries = Object.entries(readiness.components);
  const ready = componentEntries.filter(([, component]) => component.status === "ready").length;
  const statusTone =
    readiness.ok
      ? "border-accent/30 bg-accent/10 text-accent"
      : readiness.mode === "degraded"
        ? "border-amber-300/30 bg-amber-950/20 text-amber-100"
        : "border-red-300/30 bg-red-950/20 text-red-200";

  return (
    <div className="mt-3 rounded border border-edge bg-ink/45 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-medium text-neutral-200">Backend readiness</h3>
          <p className="mt-1 font-mono text-[9px] text-neutral-600">
            {ready}/{componentEntries.length} systems ready
          </p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusTone}`}>
          {formatStatus(readiness.mode)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5 md:grid-cols-4">
        {componentEntries.slice(0, 8).map(([name, component]) => (
          <div key={name} className="rounded border border-edge bg-panel px-2 py-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10px] text-neutral-400">{formatStatus(name)}</span>
              <span className={componentStatusClass(component.status)}>{component.status}</span>
            </div>
          </div>
        ))}
      </div>
      {readiness.nextActions.length > 0 && (
        <div className="mt-3 rounded border border-amber-300/20 bg-amber-950/10 p-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-amber-100">Next backend action</div>
          <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-neutral-400">
            {readiness.nextActions[0]}
          </p>
        </div>
      )}
    </div>
  );
}

function WorkerUptimePanel({ worker }: { worker: NonNullable<OperatorResponse["worker"]> }) {
  const canaryAge = formatRelativeAge(worker.canary.lastRunAt);
  const heartbeatAge = formatRelativeAge(worker.runtime.lastHeartbeatAt ?? null);
  const duration = formatDuration(worker.canary.durationMs ?? null);
  const canaryTone = worker.canary.ok
    ? "rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent"
    : "rounded-full border border-red-300/30 bg-red-950/20 px-2 py-0.5 text-[10px] text-red-200";
  const runtimeTone = worker.runtime.alive
    ? "rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent"
    : worker.runtime.seen
      ? "rounded-full border border-amber-300/30 bg-amber-950/20 px-2 py-0.5 text-[10px] text-amber-100"
      : "rounded-full border border-edge bg-panel px-2 py-0.5 text-[10px] text-neutral-500";

  return (
    <div className="mt-3 rounded border border-edge bg-ink/45 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-medium text-neutral-200">Worker uptime</h3>
          <p className="mt-1 font-mono text-[9px] text-neutral-600">
            scheduled canary, heartbeat, queue, and dead-letter state
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <span className={runtimeTone}>{worker.runtime.alive ? "heartbeat live" : worker.runtime.seen ? "heartbeat stale" : "no heartbeat"}</span>
          <span className={canaryTone}>{worker.canary.ok ? "canary ok" : "canary missing"}</span>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <OperatorStat label="canary age" value={canaryAge} accent={worker.canary.ok} />
        <OperatorStat label="duration" value={duration} accent={worker.canary.ok} />
        <OperatorStat label="queue" value={String(worker.queue.queueDepth)} accent={worker.queue.queueDepth === 0} />
        <OperatorStat label="dead" value={String(worker.queue.deadLetter)} accent={worker.queue.deadLetter === 0} />
      </div>
      <div className="mt-3 grid gap-1.5 md:grid-cols-3">
        <WorkerUptimeRow label="Worker" value={worker.runtime.workerId ?? "not seen"} />
        <WorkerUptimeRow label="Heartbeat" value={heartbeatAge} />
        <WorkerUptimeRow label="Processed" value={String(worker.runtime.processed ?? 0)} />
        <WorkerUptimeRow label="Running" value={String(worker.queue.running ?? 0)} />
        <WorkerUptimeRow label="Retrying" value={String(worker.queue.retrying)} />
        <WorkerUptimeRow label="Latest job" value={formatRelativeAge(worker.queue.latestUpdatedAt ?? null)} />
      </div>
    </div>
  );
}

function WorkerUptimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-edge bg-panel px-2 py-1.5">
      <div className="text-[9px] text-neutral-600">{label}</div>
      <div className="mt-0.5 truncate font-mono text-[10px] text-neutral-300">{value}</div>
    </div>
  );
}

function RunCard({
  run,
  active,
  publishing,
  executing,
  verifying,
  onInspect,
  onPublish,
  onExecute,
  onVerify,
}: {
  run: OperatorRun;
  active: boolean;
  publishing: boolean;
  executing: boolean;
  verifying: boolean;
  onInspect: () => void;
  onPublish: () => void;
  onExecute: () => void;
  onVerify: () => void;
}) {
  const receipt = run.receipts[0];
  const canStage = run.approvals.some((approval) => approval.decision === "approved");
  const hasStaged = run.artifacts.some((artifact) =>
    artifact.kind === "cms_draft" || artifact.kind === "task_draft" || artifact.kind === "trust_packet_export"
  );
  const hasExecuted = run.artifacts.some((artifact) => artifact.kind === "connector_execution");
  const hasVerified = run.artifacts.some((artifact) => artifact.kind === "verification_report");

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
        {hasStaged && !hasExecuted && (
          <button
            type="button"
            onClick={onExecute}
            disabled={executing}
            className="rounded-full border border-pink-300/40 bg-pink-950/20 px-2 py-0.5 text-[10px] text-pink-100 hover:border-pink-200/70 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {executing ? "Executing fix" : "Execute fix"}
          </button>
        )}
        {hasExecuted && !hasVerified && (
          <>
            <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
              Fix executed
            </span>
            <button
              type="button"
              onClick={onVerify}
              disabled={verifying}
              className="rounded-full border border-pink-300/40 bg-pink-950/20 px-2 py-0.5 text-[10px] text-pink-100 hover:border-pink-200/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {verifying ? "Verifying fix" : "Verify fix"}
            </button>
          </>
        )}
        {hasVerified && (
          <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
            Fix verified
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-neutral-500">{run.nextAction}</p>
    </div>
  );
}

function ArtifactSidecar({
  artifact,
  artifacts,
  shipTrail,
  tab,
  detail,
  detailStatus,
  onTabChange,
  onSelect,
}: {
  artifact: OperatorArtifact | null;
  artifacts: OperatorArtifact[];
  shipTrail: ShipTrailStep[];
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
        {shipTrail.length > 0 && <ShipTrail steps={shipTrail} />}
        {tab === "preview" && <ArtifactPreview artifact={artifact} />}
        {tab === "data" && <ArtifactData artifact={artifact} detail={detail} detailStatus={detailStatus} />}
        {tab === "proof" && <ArtifactProof artifact={artifact} />}
      </div>
    </aside>
  );
}

function ShipTrail({ steps }: { steps: ShipTrailStep[] }) {
  return (
    <div className="mb-3 rounded border border-edge bg-panel/70 p-2">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Ship trail</span>
        <span className="font-mono text-[9px] text-neutral-700">{steps.filter((step) => step.status === "complete").length}/{steps.length}</span>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {steps.map((step) => (
          <a
            key={step.id}
            href={step.href}
            target="_blank"
            rel="noreferrer"
            title={step.summary}
            className={
              step.status === "complete"
                ? "rounded border border-accent/35 bg-accent/10 px-1.5 py-1 text-center text-[9px] text-accent"
                : step.status === "active"
                  ? "rounded border border-pink-300/40 bg-pink-950/20 px-1.5 py-1 text-center text-[9px] text-pink-100"
                  : step.status === "blocked"
                    ? "rounded border border-red-300/35 bg-red-950/20 px-1.5 py-1 text-center text-[9px] text-red-200"
                    : "rounded border border-edge bg-ink px-1.5 py-1 text-center text-[9px] text-neutral-600"
            }
          >
            {step.label}
          </a>
        ))}
      </div>
      <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-neutral-500">
        {steps.find((step) => step.status === "active")?.summary ??
          steps.find((step) => step.status === "blocked")?.summary ??
          steps[steps.length - 1]?.summary}
      </p>
    </div>
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
      {artifact.outcome && <ArtifactOutcome outcome={artifact.outcome} />}
    </div>
  );
}

function ArtifactOutcome({ outcome }: { outcome: NonNullable<OperatorArtifact["outcome"]> }) {
  const submittedLabel = outcome.submitted === null ? "n/a" : outcome.submitted ? "submitted" : "not submitted";
  const autonomy = outcome.autonomy ?? {
    label: "policy missing",
    nextTier: null,
  };

  return (
    <div className="rounded border border-pink-300/25 bg-pink-950/10 p-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-[10px] font-medium text-neutral-200">Outcome summary</h4>
          <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-neutral-500">{outcome.summary}</p>
        </div>
        <span className={outcome.status === "blocked" ? "shrink-0 text-[10px] text-red-200" : "shrink-0 text-[10px] text-accent"}>
          {formatStatus(outcome.status)}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <OutcomeRow label="connector" value={outcome.target.connectorId} />
        <OutcomeRow label="autonomy" value={autonomy.label} />
        <OutcomeRow label="submit" value={submittedLabel} />
        <OutcomeRow label="selector" value={outcome.target.selector ?? "n/a"} />
        <OutcomeRow label="captures" value={String(outcome.evidence.length)} />
        <OutcomeRow label="next gate" value={autonomy.nextTier ? formatStatus(autonomy.nextTier) : "none"} />
      </div>

      {outcome.evidence.length > 0 && (
        <div className="mt-2 space-y-1">
          {outcome.evidence.slice(0, 2).map((item) => (
            <div key={`${item.label}:${item.hash}`} className="rounded border border-edge bg-ink/70 px-2 py-1">
              <div className="flex justify-between gap-2">
                <span className="text-[10px] text-neutral-300">{item.label}</span>
                <span className="font-mono text-[9px] text-neutral-600">{item.storageMode}</span>
              </div>
              <div className="mt-0.5 truncate font-mono text-[9px] text-neutral-700">{item.hash}</div>
            </div>
          ))}
        </div>
      )}

      {outcome.fields.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {outcome.fields.slice(0, 3).map((field) => (
            <span
              key={`${field.selector}:${field.valueHash}`}
              className="rounded-full border border-edge bg-ink px-1.5 py-0.5 font-mono text-[9px] text-neutral-500"
              title={field.selector}
            >
              {field.label}: {field.valueHash}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 rounded border border-edge bg-panel/70 px-2 py-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-neutral-300">{outcome.verifier.name}</span>
          <span className={outcome.verifier.required ? "text-[10px] text-accent" : "text-[10px] text-neutral-600"}>
            {outcome.verifier.required ? "required" : "optional"}
          </span>
        </div>
        {outcome.verifier.checks.length > 0 && (
          <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-neutral-500">
            {outcome.verifier.checks.slice(0, 3).join(" / ")}
          </p>
        )}
      </div>

      {outcome.rollback.length > 0 && (
        <div className="mt-2 rounded border border-edge bg-ink/70 px-2 py-1 text-[10px] text-neutral-500">
          rollback: {outcome.rollback[0]}
        </div>
      )}

      {outcome.openObligations.length > 0 && (
        <div className="mt-2 rounded border border-amber-300/25 bg-amber-950/20 px-2 py-1 text-[10px] text-amber-100">
          {outcome.openObligations[0]}
        </div>
      )}
    </div>
  );
}

function OutcomeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-edge bg-panel/80 px-2 py-1">
      <div className="text-[9px] text-neutral-600">{label}</div>
      <div className="mt-0.5 truncate font-mono text-[9px] text-neutral-300">{value}</div>
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
          <>
            {detail?.artifact?.rawDataIncluded === false && (
              <div className="mb-2 rounded border border-amber-300/25 bg-amber-950/20 px-2 py-1 text-[9px] text-amber-100">
                preview only. raw artifact data requires secret auth.
              </div>
            )}
            <pre className="whitespace-pre-wrap break-words">
              {JSON.stringify(detail?.artifact?.data ?? detail?.detail ?? null, null, 2)}
            </pre>
          </>
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

function CapabilityInstallPlan({
  plan,
  state,
  onRequestInstall,
}: {
  plan: InstallPlanResponse["plan"] | null;
  state: "idle" | "requesting" | "requested" | "error";
  onRequestInstall: () => void;
}) {
  if (!plan) {
    return (
      <div className="rounded border border-dashed border-edge bg-ink/30 p-2 text-[10px] text-neutral-600">
        Capability install plan unavailable.
      </div>
    );
  }

  const envKeys = plan.envRequired.flatMap((item) => item.missingEnv).slice(0, 4);
  return (
    <div className="rounded border border-accent/20 bg-accent/5 p-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-medium text-neutral-200">Starter install plan</h3>
          <p className="mt-1 text-[10px] leading-4 text-neutral-500">
            {plan.activeAfterInstall.length}/{plan.knownIds.length} capabilities active after setup
          </p>
        </div>
        <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
          dry run
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <OperatorStat label="allowlist" value={String(plan.newlyAllowlisted.length)} accent />
        <OperatorStat label="install" value={String(plan.newlyForceInstalled.length)} />
        <OperatorStat label="blocked" value={String(plan.blockedAfterInstall.length)} accent={plan.blockedAfterInstall.length === 0} />
      </div>
      {envKeys.length > 0 && (
        <div className="mt-2 rounded border border-edge bg-panel px-2 py-1 font-mono text-[9px] text-neutral-600">
          missing env: {envKeys.join(", ")}
        </div>
      )}
      <button
        type="button"
        onClick={onRequestInstall}
        disabled={state === "requesting" || state === "requested"}
        className="mt-2 rounded border border-accent/30 bg-panel px-2 py-1 text-[10px] text-accent hover:border-accent/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {state === "requesting"
          ? "Requesting install"
          : state === "requested"
            ? "Install requested"
            : state === "error"
              ? "Retry install request"
              : "Request install"}
      </button>
    </div>
  );
}

function TaskStream({
  events,
}: {
  events: Array<TaskEventSummary & { runId: string; runTitle: string }>;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium text-neutral-200">Task stream</h3>
        <span className="font-mono text-[9px] text-neutral-700">{events.length} events</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {events.length > 0 ? (
          events.map((event) => {
            const presentation = taskEventPresentation(event.kind);

            return (
              <a
                key={`${event.runId}:${event.id}`}
                href={`/api/runs/${encodeURIComponent(event.runId)}/tasks`}
                target="_blank"
                rel="noreferrer"
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded border border-edge bg-ink/45 px-2 py-1.5 hover:border-accent/35"
                title={event.message}
              >
                <span className={presentation.tone}>{presentation.glyph}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[10px] text-neutral-300">{presentation.label}</span>
                  <span className="block truncate text-[10px] leading-4 text-neutral-600">{event.message}</span>
                  {event.capabilityId && (
                    <span className="mt-0.5 block truncate font-mono text-[9px] text-neutral-700">{event.capabilityId}</span>
                  )}
                </span>
                <span className="font-mono text-[9px] text-neutral-700">#{event.sequence}</span>
              </a>
            );
          })
        ) : (
          <div className="rounded border border-dashed border-edge bg-ink/30 p-2 text-[10px] text-neutral-600">
            No task events yet.
          </div>
        )}
      </div>
    </div>
  );
}

function taskEventPresentation(kind: string) {
  if (kind === "browser_action.session") {
    return {
      label: "Browser session",
      glyph: "@",
      tone: "mt-0.5 font-mono text-[10px] text-sky-300",
    };
  }
  if (kind === "browser_action.field") {
    return {
      label: "Browser field",
      glyph: ">",
      tone: "mt-0.5 font-mono text-[10px] text-accent",
    };
  }
  if (kind === "browser_action.screenshot") {
    return {
      label: "Browser screenshot",
      glyph: "+",
      tone: "mt-0.5 font-mono text-[10px] text-pink-100",
    };
  }
  if (kind === "browser_action.paused") {
    return {
      label: "Browser pause",
      glyph: "||",
      tone: "mt-0.5 font-mono text-[10px] text-amber-200",
    };
  }
  if (kind === "browser_action.failed") {
    return {
      label: "Browser failed",
      glyph: "!",
      tone: "mt-0.5 font-mono text-[10px] text-red-200",
    };
  }
  if (kind.includes("blocked")) {
    return { label: formatStatus(kind), glyph: "!", tone: "mt-0.5 font-mono text-[10px] text-red-200" };
  }
  if (kind.includes("approval")) {
    return { label: formatStatus(kind), glyph: "?", tone: "mt-0.5 font-mono text-[10px] text-accent" };
  }
  if (kind.includes("receipt")) {
    return { label: formatStatus(kind), glyph: "#", tone: "mt-0.5 font-mono text-[10px] text-pink-100" };
  }
  if (kind.includes("artifact")) {
    return { label: formatStatus(kind), glyph: "+", tone: "mt-0.5 font-mono text-[10px] text-neutral-600" };
  }
  if (kind.includes("completed")) {
    return { label: formatStatus(kind), glyph: "/", tone: "mt-0.5 font-mono text-[10px] text-neutral-300" };
  }
  return { label: formatStatus(kind), glyph: "*", tone: "mt-0.5 font-mono text-[10px] text-neutral-600" };
}

function statusClass(status: string) {
  if (status === "needs_approval") return "shrink-0 text-[10px] text-accent";
  if (status === "failed") return "shrink-0 text-[10px] text-red-300";
  if (status === "completed") return "shrink-0 text-[10px] text-neutral-300";
  return "shrink-0 text-[10px] text-amber-200";
}

function componentStatusClass(status: "ready" | "degraded" | "missing") {
  if (status === "ready") return "text-[9px] text-accent";
  if (status === "degraded") return "text-[9px] text-amber-200";
  return "text-[9px] text-red-300";
}

function freshnessClass(freshness: "fresh" | "stale" | "unknown") {
  if (freshness === "fresh") return "shrink-0 text-[10px] text-accent";
  if (freshness === "stale") return "shrink-0 text-[10px] text-amber-100";
  return "shrink-0 text-[10px] text-neutral-600";
}

function formatStatus(status: string) {
  return status.replace("_", " ");
}

function topEntry(record: Record<string, number>): [string, number] | null {
  const [entry] = Object.entries(record).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return entry ?? null;
}

function formatDuration(durationMs: number | null): string {
  if (!Number.isFinite(durationMs ?? NaN)) return "n/a";
  const value = Math.max(0, Math.round(durationMs ?? 0));
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}s`;
}

function formatRelativeAge(value: string | null): string {
  if (!value) return "n/a";
  const then = Date.parse(value);
  if (!Number.isFinite(then)) return "n/a";
  const elapsed = Math.max(0, Date.now() - then);
  if (elapsed < 60_000) return `${Math.max(1, Math.round(elapsed / 1000))}s ago`;
  if (elapsed < 60 * 60_000) return `${Math.round(elapsed / 60_000)}m ago`;
  if (elapsed < 24 * 60 * 60_000) return `${Math.round(elapsed / (60 * 60_000))}h ago`;
  return `${Math.round(elapsed / (24 * 60 * 60_000))}d ago`;
}
