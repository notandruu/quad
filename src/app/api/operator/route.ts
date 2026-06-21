import { NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { getBackendReadiness } from "@/lib/backend/readiness";
import { listBrainMemoryTrail } from "@/lib/brain";
import { listConnectorCredentials } from "@/lib/connectors";
import { getWorkerCanaryHealth, getWorkerQueueHealth, getWorkerRuntimeHealth } from "@/lib/jobs/queue";
import { getLatestModelCallReceipts, type ModelCallReceipt } from "@/lib/llm/gateway";
import { summarizeCapabilities } from "@/lib/metaregistry";
import { getQuadChainPackets, summarizeQuadChainPackets } from "@/lib/quad-chain/registry";
import { buildShipTrail, listRunSnapshots, summarizeAgentTask } from "@/lib/runs";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import { buildSecurityPacket, summarizeSecurityPacket } from "@/lib/security/posture";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId: url.searchParams.get("orgId") ?? DEMO_ORG_ID,
  });
  if (!auth.ok) {
    return NextResponse.json(requestAuthError(auth), { status: auth.status });
  }

  const orgId = auth.orgId;
  const limit = Number(url.searchParams.get("limit") ?? 8);

  // This route fans out to the runs ledger, connector store, and three worker
  // health probes, and the operator console polls it every few seconds. A
  // single transient rejection must not 500 the whole panel mid-demo — degrade
  // each source to a safe empty value instead.
  const snapshots = await listRunSnapshots({ orgId, limit }).catch(() => []);
  const capabilities = summarizeCapabilities(process.env, { orgId });
  const [connectorCredentials, workerQueue, workerRuntime, workerCanary, backendReadiness, quadChainPackets, memoryTrail, modelReceipts] = await Promise.all([
    listConnectorCredentials({ orgId }).catch(() => []),
    getWorkerQueueHealth().catch(() => null),
    getWorkerRuntimeHealth().catch(() => null),
    getWorkerCanaryHealth().catch(() => null),
    getBackendReadiness().catch(() => null),
    getQuadChainPackets({ orgId, limit: 20 }).catch(() => []),
    listBrainMemoryTrail({ orgId, limit: 6 }).catch(() => null),
    getLatestModelCallReceipts({ orgId, limit: 8 }).catch(() => []),
  ]);
  const security = summarizeSecurityPacket(buildSecurityPacket({ orgId }));
  const runs = snapshots.map((snapshot) => summarizeAgentTask(snapshot));
  const shipTrails = Object.fromEntries(
    snapshots.map((snapshot) => [snapshot.run.id, buildShipTrail(snapshot)])
  );
  const pendingApprovals = snapshots.flatMap((snapshot) =>
    snapshot.approvals
      .filter((approval) => approval.decision === "pending")
      .map((approval) => ({
        id: approval.id,
        runId: snapshot.run.id,
        runTitle: snapshot.run.title,
        decision: approval.decision,
        reason: approval.reason,
        evidenceVisible: approval.evidenceVisible,
        targetUrl: snapshot.run.targetUrl ?? null,
      }))
  );

  return NextResponse.json({
    ok: true,
    orgId,
    workline: ["audit", "packet", "approval", "publish"],
    runs,
    shipTrails,
    pendingApprovals,
    artifacts: buildOperatorArtifacts(runs, pendingApprovals),
    capabilities: {
      active: capabilities.activeTools.slice(0, 10),
      blocked: capabilities.installed
        .filter((capability) => capability.installed && !capability.active)
        .slice(0, 10)
        .map((capability) => ({
          id: capability.id,
          status: capability.status,
          reason: redactConfigNames(capability.reason),
          missingEnvCount: capability.missingEnv.length,
          allowlisted: capability.allowlisted,
          disabled: capability.disabled,
          installSource: capability.installSource,
        })),
      starterBundle: capabilities.starterBundle,
      policy: {
        allowlistCount: capabilities.policy.allowlist.length,
        disabledCount: capabilities.policy.disabled.length,
        forceInstalledCount: capabilities.policy.forceInstalled.length,
        requireWriteAllowlist: capabilities.policy.requireWriteAllowlist,
      },
    },
    worker: {
      queue: workerQueue,
      runtime: workerRuntime,
      canary: workerCanary,
    },
    backendReadiness: backendReadiness ? summarizeBackendReadiness(backendReadiness) : null,
    quadChain: summarizeQuadChainPackets(quadChainPackets),
    modelGateway: summarizeModelReceipts(modelReceipts),
    memory: memoryTrail,
    connectorCredentials,
    security,
  });
}

type OperatorRunSummary = ReturnType<typeof summarizeAgentTask>;

type OperatorApprovalSummary = {
  id: string;
  runId: string;
  runTitle: string;
  decision: string;
  reason: string;
  evidenceVisible: boolean;
  targetUrl: string | null;
};

function buildOperatorArtifacts(runs: OperatorRunSummary[], approvals: OperatorApprovalSummary[]) {
  const stagedArtifacts = runs.flatMap((run) =>
    run.artifacts
      .filter((artifact) => artifact.kind === "cms_draft" || artifact.kind === "task_draft" || artifact.kind === "trust_packet_export")
      .slice(0, 3)
      .map((artifact) => {
        const receipt = run.receipts.find((item) => item.artifactHash === artifact.hash);
        const connector = summarizeConnectorDraft(artifact.kind);

        return {
          id: `artifact_${artifact.id}`,
          runId: run.runId,
          artifactId: artifact.id,
          href: `/api/runs/${run.runId}/artifacts/${artifact.id}`,
          runHref: `/api/runs/${run.runId}`,
          title: artifact.title,
          kind: artifact.kind,
          status: receipt?.status ?? "ready",
          headline: connector.headline,
          preview: {
            label: connector.label,
            primaryMetric: connector.primaryMetric,
            primaryLabel: connector.primaryLabel,
            secondaryMetric: connector.secondaryMetric,
            secondaryLabel: connector.secondaryLabel,
            risk: connector.risk,
          },
          proof: [
            {
              id: receipt?.id ?? artifact.id,
              status: receipt?.status ?? "ready",
              summary: receipt?.summary ?? "Staged dry-run artifact.",
              artifactHash: artifact.hash,
            },
          ],
        };
      })
  );

  const runArtifacts = runs.slice(0, 3).map((run) => {
    const readyReceipts = run.receipts.filter((receipt) => receipt.status === "ready").length;
    const blockedReceipts = run.receipts.filter((receipt) => receipt.status === "blocked").length;

    return {
      id: `artifact_${run.runId}`,
      runId: run.runId,
      artifactId: null,
      href: `/api/runs/${run.runId}`,
      runHref: `/api/runs/${run.runId}`,
      title: run.title,
      kind: "run_snapshot",
      status: run.status,
      headline: run.nextAction,
      preview: {
        label: "Run artifact",
        primaryMetric: `${readyReceipts}/${run.receipts.length}`,
        primaryLabel: "ready receipts",
        secondaryMetric: String(run.approvals.length),
        secondaryLabel: "approvals",
        risk: blockedReceipts > 0 ? "needs review" : "clean",
      },
      proof: run.receipts.slice(0, 4).map((receipt) => ({
        id: receipt.id,
        status: receipt.status,
        summary: receipt.summary,
        artifactHash: receipt.artifactHash,
      })),
    };
  });

  const approvalArtifacts = approvals.slice(0, 2).map((approval) => ({
    id: `artifact_${approval.id}`,
    runId: approval.runId,
    artifactId: null,
    href: `/api/runs/${approval.runId}`,
    runHref: `/api/runs/${approval.runId}`,
    title: approval.runTitle,
    kind: "approval_request",
    status: "pending",
    headline: approval.reason,
    preview: {
      label: "Approval artifact",
      primaryMetric: approval.evidenceVisible ? "yes" : "no",
      primaryLabel: "evidence visible",
      secondaryMetric: approval.targetUrl ? "url" : "n/a",
      secondaryLabel: "target",
      risk: approval.evidenceVisible ? "human gate" : "needs evidence",
    },
    proof: [
      {
        id: approval.id,
        status: approval.decision,
        summary: approval.reason,
        artifactHash: approval.runId,
      },
    ],
  }));

  return [...stagedArtifacts, ...approvalArtifacts, ...runArtifacts].slice(0, 7);
}

function summarizeConnectorDraft(fallbackKind: string) {
  const connectorId = connectorIdForArtifactKind(fallbackKind);
  const actionType = actionTypeForArtifactKind(fallbackKind);
  const destination = destinationForArtifactKind(fallbackKind);

  return {
    label: "Connector draft",
    headline: "Dry-run publisher artifact staged. No customer-facing write was executed.",
    primaryMetric: "ready",
    primaryLabel: "validation",
    secondaryMetric: connectorId,
    secondaryLabel: destination,
    risk: actionType.replace(/_/g, " "),
  };
}

function connectorIdForArtifactKind(kind: string): string {
  if (kind === "cms_draft") return "cms.publisher";
  if (kind === "task_draft") return "task.publisher";
  if (kind === "trust_packet_export") return "trust_packet.exporter";
  return kind.replace("_", ".");
}

function actionTypeForArtifactKind(kind: string): string {
  if (kind === "cms_draft") return "upsert_page_section";
  if (kind === "task_draft") return "create_implementation_task";
  if (kind === "trust_packet_export") return "export_markdown_packet";
  return "stage_artifact";
}

function destinationForArtifactKind(kind: string): string {
  if (kind === "cms_draft") return "website_cms";
  if (kind === "task_draft") return "task_tracker";
  if (kind === "trust_packet_export") return "customer_trust_packet";
  return kind.replace("_", " ");
}

function summarizeBackendReadiness(report: NonNullable<Awaited<ReturnType<typeof getBackendReadiness>>>) {
  return {
    ok: report.ok,
    mode: report.mode,
    generatedAt: report.generatedAt,
    nextActions: report.nextActions.slice(0, 6).map(redactConfigNames),
    components: Object.fromEntries(
      Object.entries(report.components).map(([key, value]) => [
        key,
        {
          status: value.status,
          configured: value.configured,
          detail: redactConfigNames(value.detail),
        },
      ])
    ),
  };
}

function summarizeModelReceipts(receipts: ModelCallReceipt[]) {
  return {
    total: receipts.length,
    completed: receipts.filter((receipt) => receipt.status === "completed").length,
    blocked: receipts.filter((receipt) => receipt.status === "blocked").length,
    failed: receipts.filter((receipt) => receipt.status === "failed").length,
    skipped: receipts.filter((receipt) => receipt.status === "skipped").length,
    redactions: receipts.reduce((total, receipt) => total + receipt.input.redactionCount, 0),
    latest: receipts.slice(0, 5).map((receipt) => ({
      id: receipt.id,
      runId: receipt.runId ?? null,
      provider: receipt.provider,
      model: receipt.model,
      purpose: receipt.purpose,
      status: receipt.status,
      attempts: receipt.attempts,
      durationMs: receipt.durationMs,
      createdAt: receipt.createdAt,
      input: {
        originalChars: receipt.input.originalChars,
        sanitizedChars: receipt.input.sanitizedChars,
        redactionCount: receipt.input.redactionCount,
        classifications: receipt.input.classifications,
      },
      output: {
        chars: receipt.output.chars,
      },
      errorClass: receipt.errorClass ?? null,
    })),
  };
}

function redactConfigNames(value: string): string {
  return value.replace(/\b[A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|DSN|KEY)\b/g, "required secret config");
}
