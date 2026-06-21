import { createQuadChainPacket, summarizeQuadChainPacket, type QuadChainPacketSummary } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
import {
  addArtifact,
  addTask,
  createReceipt,
  getRunSnapshot,
  loadRunSnapshot,
  saveRunSnapshot,
  summarizeAgentTask,
  transitionRun,
  type AgentTaskSummary,
  type RunLedgerSnapshot,
  type WorkflowArtifactRecord,
} from "@/lib/runs";

export type VerificationStatus = "passed" | "failed";

export type VerificationItem = {
  artifactId: string;
  artifactKind: WorkflowArtifactRecord["kind"];
  title: string;
  status: VerificationStatus;
  checks: Array<{
    id: string;
    label: string;
    passed: boolean;
    detail: string;
  }>;
};

export type VerifyPublishedWorkResult = {
  task: AgentTaskSummary;
  status: VerificationStatus;
  items: VerificationItem[];
  packets: QuadChainPacketSummary[];
};

export type VerifyPublishedWorkInput = {
  runId: string;
  orgId?: string;
  actor?: string;
  now?: string;
};

const VERIFIABLE_ARTIFACTS = new Set<WorkflowArtifactRecord["kind"]>([
  "cms_draft",
  "task_draft",
  "trust_packet_export",
]);

export async function verifyPublishedWork(input: VerifyPublishedWorkInput): Promise<VerifyPublishedWorkResult> {
  const loaded = await loadRunSnapshot(input.runId);
  if (!loaded) throw new PostShipVerificationError("run_not_found", 404, "Run not found.");
  if (input.orgId && loaded.run.orgId !== input.orgId) {
    throw new PostShipVerificationError("run_not_found", 404, "Run not found.");
  }

  const artifacts = loaded.artifacts.filter((artifact) => VERIFIABLE_ARTIFACTS.has(artifact.kind));
  if (artifacts.length === 0) {
    throw new PostShipVerificationError("artifact_missing", 404, "No staged connector artifacts were found.");
  }

  const now = input.now ?? new Date().toISOString();
  const actor = input.actor ?? "quad.verification_agent";
  const items = artifacts.map((artifact) => verifyArtifact(loaded, artifact));
  const packets: QuadChainPacketSummary[] = [];
  const overall: VerificationStatus = items.every((item) => item.status === "passed") ? "passed" : "failed";

  addTask({
    runId: loaded.run.id,
    title: "Verify staged connector artifacts",
    status: overall === "passed" ? "completed" : "blocked",
    owner: "quad",
    capabilityId: "quad.post_ship_verifier",
    detail: overall === "passed"
      ? `${items.length} staged artifacts passed verification.`
      : "One or more staged artifacts failed verification.",
    now,
  });

  for (const item of items) {
    const verificationArtifact = addArtifact({
      runId: loaded.run.id,
      kind: "verification_report",
      title: `Verification report: ${item.title}`,
      data: {
        actor,
        status: item.status,
        artifactId: item.artifactId,
        artifactKind: item.artifactKind,
        checks: item.checks,
      },
      now,
    });
    createReceipt({
      runId: loaded.run.id,
      artifactId: verificationArtifact.id,
      status: item.status === "passed" ? "executed" : "blocked",
      summary: item.status === "passed"
        ? `${item.title} passed post-ship verification.`
        : `${item.title} failed post-ship verification.`,
      now,
    });

    const packet = createQuadChainPacket({
      type: "connector_action",
      orgId: loaded.run.orgId,
      runId: loaded.run.id,
      producer: "quad.post_ship_verifier",
      consumer: String(item.artifactKind),
      sources: [
        {
          id: item.artifactId,
          kind: "artifact",
          content: {
            title: item.title,
            kind: item.artifactKind,
          },
        },
        {
          id: verificationArtifact.id,
          kind: "tool_result",
          content: verificationArtifact.data,
        },
      ],
      evidence: item.checks.map((check) => ({
        id: `${verificationArtifact.id}:${check.id}`,
        sourceId: verificationArtifact.id,
        quote: `${check.label}: ${check.detail}`,
        required: true,
      })),
      output: [
        `post-ship verification: ${item.status}`,
        `artifact: ${item.title}`,
        ...item.checks.map((check) => `${check.id}: ${check.passed ? "passed" : "failed"} - ${check.detail}`),
      ].join("\n"),
      answerConcepts: ["post-ship verification", item.status, item.artifactKind],
      visibility: "internal",
      createdAt: now,
    });
    const saved = await saveQuadChainPacket(packet);
    packets.push(summarizeQuadChainPacket(packet) ?? saved.summary);
  }

  transitionRun(loaded.run.id, overall === "passed" ? "completed" : "failed", {
    now,
    failureReason: overall === "failed" ? "Post-ship verification failed." : undefined,
  });
  await saveRunSnapshot(loaded.run.id);
  const snapshot = getRunSnapshot(loaded.run.id);
  if (!snapshot) throw new PostShipVerificationError("run_not_found", 404, "Run not found.");

  return {
    task: summarizeAgentTask(snapshot),
    status: overall,
    items,
    packets,
  };
}

function verifyArtifact(snapshot: RunLedgerSnapshot, artifact: WorkflowArtifactRecord): VerificationItem {
  const data = isRecord(artifact.data) ? artifact.data : {};
  const checks = [
    {
      id: "has_dry_run_marker",
      label: "Dry-run marker",
      passed: data.dryRun === true,
      detail: data.dryRun === true
        ? "Artifact was staged in dry-run mode before verification."
        : "Artifact is missing the dry-run marker.",
    },
    {
      id: "has_ready_receipt",
      label: "Ready receipt",
      passed: snapshot.receipts.some((receipt) => receipt.artifactId === artifact.id && receipt.status === "ready"),
      detail: snapshot.receipts.some((receipt) => receipt.artifactId === artifact.id && receipt.status === "ready")
        ? "Artifact has a ready receipt from the staging step."
        : "Artifact does not have a ready staging receipt.",
    },
    {
      id: "has_customer_target",
      label: "Customer target",
      passed: Boolean(data.targetUrl || snapshot.run.targetUrl),
      detail: data.targetUrl || snapshot.run.targetUrl
        ? `Target ${String(data.targetUrl ?? snapshot.run.targetUrl)} is present.`
        : "No target URL or customer destination is attached.",
    },
  ];

  if (artifact.kind === "cms_draft") {
    checks.push({
      id: "cms_copy_present",
      label: "Cms copy present",
      passed: Boolean(data.body || data.sectionTitle),
      detail: data.body || data.sectionTitle ? "Cms draft includes publishable copy." : "Cms draft copy is missing.",
    });
  }
  if (artifact.kind === "task_draft") {
    checks.push({
      id: "task_acceptance_present",
      label: "Task acceptance criteria",
      passed: Array.isArray(data.acceptanceCriteria) && data.acceptanceCriteria.length > 0,
      detail: Array.isArray(data.acceptanceCriteria) && data.acceptanceCriteria.length > 0
        ? "Task draft includes acceptance criteria."
        : "Task draft is missing acceptance criteria.",
    });
  }
  if (artifact.kind === "trust_packet_export") {
    checks.push({
      id: "trust_packet_export_present",
      label: "Trust packet export",
      passed: typeof data.markdown === "string" && data.markdown.includes("## status"),
      detail: typeof data.markdown === "string" && data.markdown.includes("## status")
        ? "Trust packet export includes status section."
        : "Trust packet export markdown is incomplete.",
    });
  }

  return {
    artifactId: artifact.id,
    artifactKind: artifact.kind,
    title: artifact.title,
    status: checks.every((check) => check.passed) ? "passed" : "failed",
    checks,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export class PostShipVerificationError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "PostShipVerificationError";
  }
}
