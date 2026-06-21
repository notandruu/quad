import { buildEvidenceView } from "@/lib/debug/findingEvidence";
import { getCapability, type ActiveTool } from "@/lib/metaregistry";
import type { AuditFinding, AuditReport } from "@/lib/types";
import {
  createQuadChainPacket,
  type QuadChainCertificate,
  type QuadChainOmittedRange,
  type QuadChainOpenObligation,
  type QuadChainPacket,
  type QuadChainSource,
} from "@/lib/quad-chain";

export type FdeWorkflowStepStatus = "ready" | "dry_run" | "blocked" | "needs_human";

export type FdeWorkflowStep = {
  id: string;
  title: string;
  owner: "quad" | "human" | "connector";
  status: FdeWorkflowStepStatus;
  capabilityId?: string;
  detail: string;
};

export type TrustPacketArtifact = {
  id: string;
  title: string;
  findingId: string;
  evidenceScore: number;
  summary: string;
};

export type FdeWorkflowPlan = {
  workflowId: string;
  runId: string;
  orgId: string;
  targetUrl: string;
  title: string;
  approvalTier: "none" | "human" | "admin";
  artifacts: TrustPacketArtifact[];
  steps: FdeWorkflowStep[];
  openObligations: QuadChainOpenObligation[];
  certificate: QuadChainCertificate;
  packet: QuadChainPacket;
  receiptPreview: {
    id: string;
    status: "ready_for_approval" | "blocked";
    summary: string;
  };
};

const REQUIRED_CAPABILITIES = new Set(["trust_packet.exporter"]);

export function buildTrustPacketWorkflow(input: {
  report: AuditReport;
  activeTools?: ActiveTool[];
  createdAt?: string;
}): FdeWorkflowPlan {
  const activeToolIds = new Set((input.activeTools ?? []).map((tool) => tool.id));
  const artifacts = input.report.topFindings.map(buildTrustPacketArtifact);
  const openObligations = input.report.topFindings.flatMap((finding) => buildFindingObligations(finding));
  const connectorSteps = buildConnectorSteps(activeToolIds);
  const steps: FdeWorkflowStep[] = [
    {
      id: "quad.audit.review_findings",
      title: "Review finding evidence",
      owner: "quad",
      status: artifacts.length > 0 ? "ready" : "blocked",
      detail: artifacts.length > 0
        ? `${artifacts.length} finding artifacts are ready for packet assembly.`
        : "No findings are available to ship into a trust packet.",
    },
    {
      id: "quad.chain.attach_certificate",
      title: "Attach quad chain certificate",
      owner: "quad",
      status: "ready",
      capabilityId: "quad.chain_verifier",
      detail: "Proof-carrying compressed context is attached to the handoff.",
    },
    ...connectorSteps,
    {
      id: "human.approve_packet",
      title: "Approve trust packet",
      owner: "human",
      status: openObligations.length === 0 ? "ready" : "needs_human",
      detail: openObligations.length === 0
        ? "Packet can move to human approval."
        : `${openObligations.length} obligation needs a human owner before shipping.`,
    },
  ];
  const compressedContext = buildCompressedWorkflowContext(input.report, artifacts, steps);
  const sources = buildSources(input.report);
  const omittedRanges = buildOmittedRanges(input.report);
  const requiredEvidence = input.report.topFindings
    .filter((finding) => Boolean(finding.evidence.quote))
    .map((finding) => ({
      id: `${finding.id}:quote`,
      sourceId: finding.id,
      quote: finding.evidence.quote,
      required: true,
    }));
  const answerConcepts = ["trust packet", "approval", "evidence"];
  const packet = createQuadChainPacket({
    type: "trust_packet",
    orgId: input.report.orgId,
    runId: input.report.runId,
    producer: "quad.enterprise_proof_agent",
    consumer: "quad.publisher_agent",
    sources,
    evidence: requiredEvidence,
    output: compressedContext,
    answerConcepts,
    omittedRanges,
    openObligations,
    visibility: "internal",
    createdAt: input.createdAt,
  });
  const certificate = packet.certificate;
  const coreBlocked = steps.some(
    (step) => step.status === "blocked" && (!step.capabilityId || REQUIRED_CAPABILITIES.has(step.capabilityId))
  ) || !certificate.proofChain.accepted;

  return {
    workflowId: `fde_${input.report.runId}`,
    runId: input.report.runId,
    orgId: input.report.orgId,
    targetUrl: input.report.targetUrl,
    title: "Enterprise proof trust packet",
    approvalTier: "human",
    artifacts,
    steps,
    openObligations,
    certificate,
    packet,
    receiptPreview: {
      id: `receipt_${input.report.runId}`,
      status: coreBlocked ? "blocked" : "ready_for_approval",
      summary: coreBlocked
        ? "Trust packet is blocked by missing required proof capability or evidence obligations."
        : "Trust packet is ready for approval with a verifiable quad chain certificate.",
    },
  };
}

function buildTrustPacketArtifact(finding: AuditFinding): TrustPacketArtifact {
  const evidence = buildEvidenceView(finding);

  return {
    id: `artifact_${finding.id}`,
    title: finding.title,
    findingId: finding.id,
    evidenceScore: evidence.proofScore,
    summary: `${finding.recommendedFix} Evidence: ${finding.evidence.quote ?? "No direct quote attached."}`,
  };
}

function buildFindingObligations(finding: AuditFinding): QuadChainOpenObligation[] {
  const evidence = buildEvidenceView(finding);
  const obligations: QuadChainOpenObligation[] = [];

  if (!evidence.approvalGate.canApprove) {
    obligations.push({
      kind: "needs_human",
      id: `${finding.id}:approval_gate`,
      reason: evidence.approvalGate.reasons.join(", "),
    });
  }
  if (!finding.evidence.quote) {
    obligations.push({
      kind: "evidence_missing",
      id: `${finding.id}:quote`,
      reason: "Finding needs a quoted evidence span before it can ship to a customer.",
    });
  }

  return obligations;
}

function buildConnectorSteps(activeToolIds: Set<string>): FdeWorkflowStep[] {
  return ["trust_packet.exporter", "cms.publisher", "task.publisher"].map((capabilityId) => {
    const capability = getCapability(capabilityId);
    const active = activeToolIds.has(capabilityId);
    const writeCapability = Boolean(capability?.writes);

    return {
      id: `${capabilityId}.stage`,
      title: capability?.name ?? capabilityId,
      owner: "connector",
      capabilityId,
      status: active ? (writeCapability ? "dry_run" : "ready") : "blocked",
      detail: active
        ? writeCapability
          ? "Connector is staged in dry-run mode until approval."
          : "Connector is available for artifact generation."
        : REQUIRED_CAPABILITIES.has(capabilityId)
          ? "Required connector is not active in the current metaregistry state."
          : "Optional publisher is not active; packet can still be approved without it.",
    };
  });
}

function buildSources(report: AuditReport): QuadChainSource[] {
  return [
    {
      id: `${report.runId}:summary`,
      kind: "artifact",
      content: {
        summary: report.summary,
        metrics: report.metrics,
      },
    },
    ...report.topFindings.map((finding) => ({
      id: finding.id,
      kind: "finding" as const,
      content: finding,
    })),
  ];
}

function buildOmittedRanges(report: AuditReport): QuadChainOmittedRange[] {
  const ranges: QuadChainOmittedRange[] = [];
  const topFindingIds = new Set(report.topFindings.map((finding) => finding.id));
  const omittedFindings = report.allFindings.filter((finding) => !topFindingIds.has(finding.id));

  if (omittedFindings.length > 0) {
    ranges.push({
      sourceId: `${report.runId}:all_findings`,
      rangeId: "non_top_findings",
      reason: "Lower-priority findings were omitted from the approval packet but remain in the audit report.",
      content: {
        count: omittedFindings.length,
        ids: omittedFindings.slice(0, 8).map((finding) => finding.id),
      },
    });
  } else if (report.metrics.findingsFiltered > 0) {
    ranges.push({
      sourceId: `${report.runId}:metrics`,
      rangeId: "filtered_findings",
      reason: "Filtered findings were omitted from the approval packet to keep the handoff focused.",
      content: {
        count: report.metrics.findingsFiltered,
      },
    });
  }

  if (report.recommendedActions.length > 0) {
    ranges.push({
      sourceId: `${report.runId}:recommended_actions`,
      rangeId: "recommended_actions",
      reason: "Recommended actions are carried by the workflow steps, not repeated inside the compressed packet body.",
      content: {
        count: report.recommendedActions.length,
      },
    });
  }

  return ranges;
}

function buildCompressedWorkflowContext(
  report: AuditReport,
  artifacts: TrustPacketArtifact[],
  steps: FdeWorkflowStep[]
): string {
  const findingLines = artifacts.map((artifact) => {
    const finding = report.topFindings.find((item) => item.id === artifact.findingId);
    return [
      `trust packet artifact: ${artifact.title}`,
      `evidence: ${finding?.evidence.quote ?? "missing quoted evidence"}`,
      `approval: ${artifact.evidenceScore >= 45 ? "reviewable" : "needs review"}`,
    ].join("\n");
  });
  const stepLines = steps.map((step) => `approval workflow step ${step.id}: ${step.status}`);

  return [
    `trust packet for ${report.targetUrl}`,
    "approval workflow is required before publishing.",
    "evidence is preserved for downstream review.",
    ...findingLines,
    ...stepLines,
  ].join("\n");
}
