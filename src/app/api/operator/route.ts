import { NextResponse } from "next/server";
import { DEMO_ORG_ID } from "@/data/seed";
import { ENTERPRISE_PROOF_ORG_ID } from "@/data/demo/enterprise-proof";
import { getBackendReadiness } from "@/lib/backend/readiness";
import { buildScopedContextGraph, listBrainMemoryTrail, summarizeScopedContextGraph } from "@/lib/brain";
import { listConnectorCredentials } from "@/lib/connectors";
import { getWorkerCanaryHealth, getWorkerQueueHealth, getWorkerRuntimeHealth } from "@/lib/jobs/queue";
import { getLatestModelCallReceipts, type ModelCallReceipt } from "@/lib/llm/gateway";
import { summarizeCapabilities, summarizeCapabilityCatalog } from "@/lib/metaregistry";
import { getLatestRuntimeTraceReceipts, summarizeRuntimeTraceReceipts } from "@/lib/observability";
import { getOrgWorkspaceContext } from "@/lib/orgs";
import { getQuadChainPackets, summarizeQuadChainPackets } from "@/lib/quad-chain/registry";
import { buildShipTrail, listRunSnapshots, summarizeAgentTask } from "@/lib/runs";
import { authorizeRequest, requestAuthError } from "@/lib/security";
import { buildSecurityPacket, summarizeSecurityPacket } from "@/lib/security/posture";
import { getEvidenceBundles, summarizeEvidenceBundles } from "@/lib/storage/evidence";
import { summarizeUsageMetering } from "@/lib/usage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestedOrgId = url.searchParams.get("orgId") ?? DEMO_ORG_ID;
  const auth = authorizeRequest({
    headers: request.headers,
    requestedOrgId,
    defaultOrgId: requestedOrgId === ENTERPRISE_PROOF_ORG_ID ? ENTERPRISE_PROOF_ORG_ID : DEMO_ORG_ID,
    env: requestedOrgId === ENTERPRISE_PROOF_ORG_ID ? publicEnterpriseProofDemoEnv() : undefined,
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
  const capabilityCatalog = summarizeCapabilityCatalog(capabilities, { entryLimit: 14 });
  const [workspaceContext, connectorCredentials, workerQueue, workerRuntime, workerCanary, backendReadiness, quadChainPackets, memoryTrail, contextGraph, modelReceipts, runtimeTraces, evidenceBundles] = await Promise.all([
    getOrgWorkspaceContext({ orgId }).catch(() => null),
    listConnectorCredentials({ orgId }).catch(() => []),
    getWorkerQueueHealth().catch(() => null),
    getWorkerRuntimeHealth().catch(() => null),
    getWorkerCanaryHealth().catch(() => null),
    getBackendReadiness().catch(() => null),
    getQuadChainPackets({ orgId, limit: 20 }).catch(() => []),
    listBrainMemoryTrail({ orgId, limit: 6 }).catch(() => null),
    buildScopedContextGraph({ orgId, limit: 12 }).catch(() => null),
    getLatestModelCallReceipts({ orgId, limit: 8 }).catch(() => []),
    getLatestRuntimeTraceReceipts({ orgId, limit: 12 }).catch(() => []),
    getEvidenceBundles({ orgId, limit: 20 }).catch(() => []),
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
    workspace: workspaceContext ? summarizeWorkspaceContext(workspaceContext) : null,
    workline: ["audit", "packet", "approval", "publish"],
    runs,
    shipTrails,
    pendingApprovals,
    artifacts: buildOperatorArtifacts(snapshots, pendingApprovals),
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
      catalog: capabilityCatalog,
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
    evidence: summarizeEvidenceBundles(evidenceBundles),
    modelGateway: summarizeModelReceipts(modelReceipts),
    runtimeTraces: summarizeRuntimeTraceReceipts(runtimeTraces),
    memory: memoryTrail,
    contextGraph: contextGraph ? summarizeScopedContextGraph(contextGraph) : null,
    connectorCredentials,
    security,
    usage: summarizeUsageMetering({
      orgId,
      runs: snapshots,
      packets: quadChainPackets,
      evidence: evidenceBundles,
      modelReceipts,
      runtimeTraces,
    }),
  });
}

type WorkspaceContext = Awaited<ReturnType<typeof getOrgWorkspaceContext>>;

function summarizeWorkspaceContext(context: WorkspaceContext) {
  return {
    org: context.org,
    workspace: context.workspace,
    membershipCount: context.memberships.length,
    requester: context.requester,
    boundary: context.boundary,
  };
}

function publicEnterpriseProofDemoEnv() {
  return {
    ...process.env,
    QUAD_API_SECRET: undefined,
    QUAD_SERVICE_TOKENS: undefined,
    QUAD_ALLOWED_ORGS: ENTERPRISE_PROOF_ORG_ID,
  };
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

type OperatorArtifactOutcome = {
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
};

type OperatorSnapshot = Awaited<ReturnType<typeof listRunSnapshots>>[number];

function buildOperatorArtifacts(snapshots: OperatorSnapshot[], approvals: OperatorApprovalSummary[]) {
  const stagedArtifacts = snapshots.flatMap((snapshot) =>
    snapshot.artifacts
      .filter((artifact) =>
        artifact.kind === "cms_draft" ||
        artifact.kind === "task_draft" ||
        artifact.kind === "trust_packet_export" ||
        artifact.kind === "connector_execution" ||
        artifact.kind === "browser_action"
      )
      .slice(-3)
      .reverse()
      .map((artifact) => {
        const receipt = snapshot.receipts.find((item) => item.artifactHash === artifact.hash);
        const connector = summarizeConnectorDraft(artifact.kind);

        return {
          id: `artifact_${artifact.id}`,
          runId: snapshot.run.id,
          artifactId: artifact.id,
          href: `/api/runs/${snapshot.run.id}/artifacts/${artifact.id}`,
          runHref: `/api/runs/${snapshot.run.id}`,
          title: artifact.title,
          kind: artifact.kind,
          status: receipt?.status ?? "ready",
          headline: connector.headline,
          outcome: buildArtifactOutcome(artifact, snapshot.artifacts),
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

  const runArtifacts = snapshots.slice(0, 3).map((snapshot) => {
    const run = summarizeAgentTask(snapshot);
    const readyReceipts = snapshot.receipts.filter((receipt) => receipt.status === "ready").length;
    const blockedReceipts = snapshot.receipts.filter((receipt) => receipt.status === "blocked").length;

    return {
      id: `artifact_${snapshot.run.id}`,
      runId: snapshot.run.id,
      artifactId: null,
      href: `/api/runs/${snapshot.run.id}`,
      runHref: `/api/runs/${snapshot.run.id}`,
      title: snapshot.run.title,
      kind: "run_snapshot",
      status: snapshot.run.status,
      headline: run.nextAction,
      outcome: null,
      preview: {
        label: "Run artifact",
        primaryMetric: `${readyReceipts}/${run.receipts.length}`,
        primaryLabel: "ready receipts",
        secondaryMetric: String(run.approvals.length),
        secondaryLabel: "approvals",
        risk: blockedReceipts > 0 ? "needs review" : "clean",
      },
      proof: snapshot.receipts.slice(0, 4).map((receipt) => ({
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
    outcome: null,
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

function buildArtifactOutcome(
  artifact: OperatorSnapshot["artifacts"][number],
  artifacts: OperatorSnapshot["artifacts"]
): OperatorArtifactOutcome | null {
  const data = isRecord(artifact.data) ? artifact.data : {};
  if (artifact.kind === "browser_action") {
    return buildBrowserActionOutcome(data);
  }
  if (artifact.kind === "connector_execution") {
    const browserArtifact = artifacts.find((candidate) => {
      const candidateData = isRecord(candidate.data) ? candidate.data : {};
      return candidate.kind === "browser_action" && candidateData.executionArtifactId === artifact.id;
    });
    const browserOutcome = browserArtifact && isRecord(browserArtifact.data)
      ? buildBrowserActionOutcome(browserArtifact.data)
      : null;
    return buildConnectorExecutionOutcome(data, browserOutcome);
  }
  if (artifact.kind === "verification_report") {
    return buildVerificationOutcome(data);
  }
  return null;
}

function buildConnectorExecutionOutcome(
  data: Record<string, unknown>,
  browserOutcome: OperatorArtifactOutcome | null
): OperatorArtifactOutcome | null {
  const connector = isRecord(data.connector) ? data.connector : {};
  const target = isRecord(data.target) ? data.target : {};
  const rollbackPlan = isRecord(data.rollbackPlan) ? data.rollbackPlan : {};
  const postExecutionVerification = isRecord(data.postExecutionVerification) ? data.postExecutionVerification : {};
  const checks = Array.isArray(postExecutionVerification.checks)
    ? postExecutionVerification.checks.filter((check): check is string => typeof check === "string")
    : [];
  const rollback = Array.isArray(rollbackPlan.steps)
    ? rollbackPlan.steps.filter((step): step is string => typeof step === "string")
    : [];

  return {
    summary: browserOutcome
      ? "Approved connector execution completed and a controlled Browserbase form-fill proof was captured before submit."
      : "Approved connector execution completed with rollback and post-ship verification requirements.",
    status: "executed",
    submitted: browserOutcome?.submitted ?? null,
    autonomy: readAutonomy(data.action, browserOutcome?.autonomy),
    target: {
      connectorId: typeof connector.id === "string" ? connector.id : "connector",
      destination: typeof target.destination === "string" ? target.destination : "approved connector",
      selector: typeof target.selector === "string" ? target.selector : browserOutcome?.target.selector ?? null,
      url: typeof data.targetUrl === "string" ? data.targetUrl : browserOutcome?.target.url ?? null,
    },
    evidence: browserOutcome?.evidence ?? [],
    fields: browserOutcome?.fields ?? [],
    rollback,
    verifier: {
      required: postExecutionVerification.required === true,
      name: typeof postExecutionVerification.verifier === "string"
        ? postExecutionVerification.verifier
        : "quad.post_ship_verifier",
      checks,
    },
    openObligations: [
      ...(browserOutcome?.openObligations ?? []),
      ...(checks.length > 0 ? ["Run post-ship verifier before claiming the fix is complete."] : []),
    ],
  };
}

function buildBrowserActionOutcome(data: Record<string, unknown>): OperatorArtifactOutcome | null {
  const connector = isRecord(data.connector) ? data.connector : {};
  const target = isRecord(data.target) ? data.target : {};
  const action = isRecord(data.action) ? data.action : {};
  const evidence = isRecord(data.evidence) ? data.evidence : {};
  const rollbackPlan = isRecord(data.rollbackPlan) ? data.rollbackPlan : {};
  const verification = isRecord(data.verification) ? data.verification : {};
  const fields = Array.isArray(data.fields) ? data.fields.flatMap((field) => {
    if (!isRecord(field)) return [];
    const label = typeof field.label === "string" ? field.label : "field";
    const selector = typeof field.selector === "string" ? field.selector : "";
    const valueHash = typeof field.valueHash === "string" ? field.valueHash : "";
    if (!selector || !valueHash) return [];
    return [{ label, selector, valueHash }];
  }) : [];
  const evidenceRows = [
    evidenceSummary("Before capture", evidence.before),
    evidenceSummary("After capture", evidence.after),
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));
  const screenshotIds = Array.isArray(verification.screenshotEvidenceIds)
    ? verification.screenshotEvidenceIds.filter((id): id is string => typeof id === "string")
    : [];
  const submitted = action.submitted === true;

  return {
    summary: typeof action.summary === "string"
      ? action.summary
      : "Controlled browser action captured with before and after evidence.",
    status: submitted ? "executed" : "paused",
    submitted,
    autonomy: readAutonomy(action),
    target: {
      connectorId: typeof connector.id === "string" ? connector.id : "browserbase.write_browser",
      destination: typeof target.destination === "string" ? target.destination : "controlled browser",
      selector: typeof target.selector === "string" ? target.selector : null,
      url: typeof target.url === "string" ? target.url : null,
    },
    evidence: evidenceRows,
    fields,
    rollback: Array.isArray(rollbackPlan.steps)
      ? rollbackPlan.steps.filter((step): step is string => typeof step === "string")
      : [],
    verifier: {
      required: verification.required === true,
      name: "quad.browser_action_verifier",
      checks: [
        typeof verification.expectedSelector === "string" ? `expected selector ${verification.expectedSelector}` : "",
        typeof verification.expectedValueHash === "string" ? `expected value hash ${verification.expectedValueHash}` : "",
        screenshotIds.length > 0 ? `${screenshotIds.length} screen captures bound` : "",
      ].filter(Boolean),
    },
    openObligations: submitted
      ? ["Verify the submitted page state against the browser evidence bundle."]
      : ["Human must review the filled browser session before final submit."],
  };
}

function buildVerificationOutcome(data: Record<string, unknown>): OperatorArtifactOutcome {
  const items = Array.isArray(data.items) ? data.items.filter(isRecord) : [];
  const passed = items.filter((item) => item.passed === true).length;
  const failed = items.filter((item) => item.passed === false).length;
  return {
    summary: failed > 0
      ? `Post-ship verification found ${failed} failed checks.`
      : `Post-ship verification passed ${passed} checks.`,
    status: failed > 0 ? "blocked" : "verified",
    submitted: null,
    autonomy: {
      tier: "tier_0_observe",
      label: "observe only",
      approvalRequired: false,
      humanReviewRequired: false,
      submitsExternally: false,
      nextTier: null,
    },
    target: {
      connectorId: "quad.post_ship_verifier",
      destination: "verification report",
      selector: null,
      url: null,
    },
    evidence: [],
    fields: [],
    rollback: [],
    verifier: {
      required: true,
      name: "quad.post_ship_verifier",
      checks: items.slice(0, 5).map((item) => {
        const label = typeof item.label === "string" ? item.label : typeof item.id === "string" ? item.id : "check";
        return `${label}: ${item.passed === true ? "passed" : "failed"}`;
      }),
    },
    openObligations: failed > 0 ? ["Review failed verification checks before demoing this as shipped."] : [],
  };
}

function readAutonomy(value: unknown, fallback?: OperatorArtifactOutcome["autonomy"]): OperatorArtifactOutcome["autonomy"] {
  const action = isRecord(value) ? value : {};
  const autonomy = isRecord(action.autonomy) ? action.autonomy : {};
  if (typeof autonomy.tier !== "string" || typeof autonomy.label !== "string") {
    return fallback ?? {
      tier: "unknown",
      label: "policy missing",
      approvalRequired: true,
      humanReviewRequired: true,
      submitsExternally: false,
      nextTier: null,
    };
  }
  return {
    tier: autonomy.tier,
    label: autonomy.label,
    approvalRequired: autonomy.approvalRequired === true,
    humanReviewRequired: autonomy.humanReviewRequired === true,
    submitsExternally: autonomy.submitsExternally === true,
    nextTier: typeof autonomy.nextTier === "string" ? autonomy.nextTier : null,
  };
}

function evidenceSummary(label: string, value: unknown): OperatorArtifactOutcome["evidence"][number] | null {
  if (!isRecord(value)) return null;
  const hash = typeof value.hash === "string" ? value.hash : "";
  if (!hash) return null;
  return {
    label,
    storageMode: typeof value.storageMode === "string" ? value.storageMode : "unknown",
    hash,
    storageKey: typeof value.storageKey === "string" ? value.storageKey : null,
    sourceUrl: typeof value.sourceUrl === "string" ? value.sourceUrl : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function summarizeConnectorDraft(fallbackKind: string) {
  const connectorId = connectorIdForArtifactKind(fallbackKind);
  const actionType = actionTypeForArtifactKind(fallbackKind);
  const destination = destinationForArtifactKind(fallbackKind);

  return {
    label: fallbackKind === "browser_action"
      ? "Browser action"
      : fallbackKind === "connector_execution"
        ? "Connector execution"
        : "Connector draft",
    headline: fallbackKind === "browser_action"
      ? "Approved browser write action recorded with selector and evidence proof."
      : fallbackKind === "connector_execution"
        ? "Approved connector execution recorded with rollback and verification proof."
        : "Dry-run publisher artifact staged. No customer-facing write was executed.",
    primaryMetric: fallbackKind === "browser_action" || fallbackKind === "connector_execution" ? "executed" : "ready",
    primaryLabel: fallbackKind === "browser_action" ? "browser" : fallbackKind === "connector_execution" ? "receipt" : "validation",
    secondaryMetric: connectorId,
    secondaryLabel: destination,
    risk: actionType.replace(/_/g, " "),
  };
}

function connectorIdForArtifactKind(kind: string): string {
  if (kind === "browser_action") return "browserbase.write_browser";
  if (kind === "cms_draft") return "cms.publisher";
  if (kind === "task_draft") return "task.publisher";
  if (kind === "trust_packet_export") return "trust_packet.exporter";
  return kind.replace("_", ".");
}

function actionTypeForArtifactKind(kind: string): string {
  if (kind === "browser_action") return "fill_and_pause_before_submit";
  if (kind === "connector_execution") return "execute_approved_artifact";
  if (kind === "cms_draft") return "upsert_page_section";
  if (kind === "task_draft") return "create_implementation_task";
  if (kind === "trust_packet_export") return "export_markdown_packet";
  return "stage_artifact";
}

function destinationForArtifactKind(kind: string): string {
  if (kind === "browser_action") return "controlled_browser";
  if (kind === "connector_execution") return "approved_connector";
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
