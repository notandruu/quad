import { getQuadChainPackets } from "@/lib/quad-chain/registry";
import type { QuadChainPacketSummary, QuadChainSource } from "@/lib/quad-chain";
import { summarizeQuadChainPacket } from "@/lib/quad-chain";
import { loadRunSnapshot } from "@/lib/runs";
import type { AuditFinding, AuditReport } from "@/lib/types";
import { loadCachedReport } from "./reportCache";

export type AuditChatContext = {
  report: AuditReport | null;
  verifiedContext: QuadChainPacketSummary[];
  sources: QuadChainSource[];
};

export async function loadAuditChatContext(input: {
  orgId: string;
  runId: string;
  packetLimit?: number;
}): Promise<AuditChatContext> {
  const report = await loadReportForChat(input.runId);
  if (report && report.orgId !== input.orgId) {
    return {
      report: null,
      verifiedContext: [],
      sources: [],
    };
  }

  const packets = await getQuadChainPackets({
    orgId: input.orgId,
    runId: input.runId,
    limit: input.packetLimit ?? 20,
  }).catch(() => []);
  const auditPackets = packets
    .filter((packet) => packet.type === "audit_report" || packet.type === "finding")
    .map(summarizeQuadChainPacket);
  const verifiedContext = uniquePacketSummaries([
    ...auditPackets,
    ...extractReportPacket(report),
  ]);

  return {
    report,
    verifiedContext,
    sources: report ? buildAuditSources(input.runId, report) : [],
  };
}

export function buildAuditSources(runId: string, report: AuditReport): QuadChainSource[] {
  return [
    {
      id: `${runId}:audit_report`,
      kind: "artifact",
      content: {
        summary: report.summary,
        metrics: report.metrics,
        targetUrl: report.targetUrl,
      },
    },
    ...report.topFindings.slice(0, 5).map((finding) => findingSource(finding)),
  ];
}

async function loadReportForChat(runId: string): Promise<AuditReport | null> {
  const cached = await loadCachedReport(runId);
  if (cached) return cached;

  const snapshot = await loadRunSnapshot(runId);
  const artifact = snapshot?.artifacts.find((item) => item.kind === "audit_report");
  return isAuditReport(artifact?.data) ? artifact.data : null;
}

function findingSource(finding: AuditFinding): QuadChainSource {
  return {
    id: finding.id,
    kind: "finding",
    content: {
      title: finding.title,
      severity: finding.severity,
      pageUrl: finding.pageUrl,
      quote: finding.evidence.quote,
      selector: finding.evidence.selector,
      screenshotUrl: finding.evidence.screenshotUrl,
      fix: finding.recommendedFix,
    },
  };
}

function extractReportPacket(report: AuditReport | null): QuadChainPacketSummary[] {
  const maybePacket = (report as (AuditReport & { quadChain?: unknown }) | null)?.quadChain;
  return isQuadChainPacketSummary(maybePacket) ? [maybePacket] : [];
}

function uniquePacketSummaries(packets: QuadChainPacketSummary[]): QuadChainPacketSummary[] {
  const seen = new Set<string>();
  const unique: QuadChainPacketSummary[] = [];
  for (const packet of packets) {
    if (seen.has(packet.id)) continue;
    seen.add(packet.id);
    unique.push(packet);
  }
  return unique;
}

function isAuditReport(value: unknown): value is AuditReport {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<AuditReport>;
  return Boolean(
    typeof item.runId === "string" &&
    typeof item.orgId === "string" &&
    typeof item.targetUrl === "string" &&
    typeof item.summary === "string" &&
    Array.isArray(item.topFindings) &&
    item.metrics
  );
}

function isQuadChainPacketSummary(value: unknown): value is QuadChainPacketSummary {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<QuadChainPacketSummary>;
  return Boolean(
    typeof item.id === "string" &&
    typeof item.certificateId === "string" &&
    typeof item.runId === "string" &&
    typeof item.type === "string"
  );
}
