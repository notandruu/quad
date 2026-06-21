import { createHash } from "crypto";
import { buildMemoryWriteProposalPayload } from "@/lib/brain/proposals";
import { captureContextEvents, summarizeContextCapture } from "@/lib/context-capture";
import {
  createQuadChainPacket,
  summarizeQuadChainPacket,
  type QuadChainPacketSummary,
} from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";
import {
  addArtifact,
  addTask,
  createReceipt,
  createWorkflowRun,
  getRunSnapshot,
  requestApproval,
  saveRunSnapshot,
  summarizeAgentTask,
  transitionRun,
  type AgentTaskSummary,
  type ApprovalRecord,
  type ReceiptRecord,
  type WorkflowArtifactRecord,
} from "@/lib/runs";
import type { IngestInput } from "@/lib/brain/ingest";
import type { LearnFromMeetingResult, MeetingFactResult } from "@/lib/skills/learnFromMeeting";

export type MeetingFollowup = {
  id: string;
  title: string;
  reason: string;
  owner: "quad" | "human";
  status: "draft" | "blocked";
  sourceFactIds: string[];
};

export type MeetingIntelligenceResult = {
  runId: string;
  task: AgentTaskSummary;
  artifacts: Array<Pick<WorkflowArtifactRecord, "id" | "kind" | "title" | "hash">>;
  approval: Pick<ApprovalRecord, "id" | "decision" | "reason" | "evidenceVisible">;
  receipt: Pick<ReceiptRecord, "id" | "status" | "summary" | "artifactHash">;
  packets: QuadChainPacketSummary[];
  followups: MeetingFollowup[];
};

export async function buildMeetingIntelligence(
  result: LearnFromMeetingResult
): Promise<MeetingIntelligenceResult> {
  const now = new Date().toISOString();
  const retainedFacts = result.facts.filter((item) =>
    item.status === "learned" || item.status === "proposed" || item.status === "reused"
  );
  const evidence = retainedFacts
    .filter((item) => item.fact.sourceQuote)
    .slice(0, 6)
    .map((item) => ({
      quote: item.fact.sourceQuote,
      documentId: result.runId,
    }));
  const followups = extractMeetingFollowups(result);

  const run = createWorkflowRun({
    id: result.runId,
    orgId: result.orgId,
    workflowKind: "meeting_agent",
    title: `Meeting agent: ${result.title}`,
    createdBy: "agent",
    now,
  });
  transitionRun(run.id, "running", { now });
  const capture = captureContextEvents({
    orgId: result.orgId,
    runId: result.runId,
    sourceName: `meeting:${result.title}`,
    events: result.transcript.split("\n").filter(Boolean).map((line, index) => ({
      id: `${result.runId}:line_${index + 1}`,
      sourceType: "meeting",
      text: line,
    })),
    now,
  });

  addTask({
    runId: run.id,
    title: "Capture meeting transcript",
    status: "completed",
    owner: "quad",
    detail: "Meeting transcript was normalized into a source artifact.",
    now,
  });
  addTask({
    runId: run.id,
    title: "Extract durable company context",
    status: retainedFacts.length > 0 ? "completed" : "blocked",
    owner: "quad",
    detail:
      retainedFacts.length > 0
        ? `${retainedFacts.length} durable facts were grounded against transcript evidence.`
        : "No durable facts were grounded enough for writeback.",
    now,
  });
  addTask({
    runId: run.id,
    title: "Separate context signal from noise",
    status: capture.summary.signalCount > 0 ? "completed" : "blocked",
    owner: "quad",
    detail:
      capture.summary.signalCount > 0
        ? `${capture.summary.signalCount} signals kept and ${capture.summary.noiseCount} noisy events filtered before writeback.`
        : "No durable context signals survived the capture filter.",
    now,
  });

  const transcriptArtifact = addArtifact({
    runId: run.id,
    kind: "meeting_transcript",
    title: "Meeting transcript source",
    data: {
      title: result.title,
      transcript: result.transcript,
      transcriptHash: hashText(result.transcript),
      lineCount: result.transcript.split("\n").filter(Boolean).length,
      privacy: "raw transcript is operator-visible only",
    },
    now,
  });
  const summaryArtifact = addArtifact({
    runId: run.id,
    kind: "meeting_summary",
    title: "Meeting intelligence summary",
    data: {
      summary: result.summary,
      learnedCount: result.learnedCount,
      proposedCount: result.proposedCount,
      rejectedCount: result.rejectedCount,
      factCount: result.facts.length,
      retainedFacts: retainedFacts.map((item) => factPreview(item)),
      rejectedFacts: result.facts.filter((item) => item.status === "rejected").map((item) => factPreview(item)),
    },
    now,
  });
  const captureArtifact = addArtifact({
    runId: run.id,
    kind: "context_capture",
    title: "Context capture signal report",
    data: {
      summary: summarizeContextCapture(capture),
      signals: capture.signals.map((signal) => ({
        id: signal.id,
        sourceId: signal.sourceId,
        claim: signal.claim,
        category: signal.category,
        confidence: signal.confidence,
        suggestedVisibility: signal.suggestedVisibility,
      })),
      noise: capture.noise.map((item) => ({
        id: item.id,
        sourceEventId: item.sourceEventId,
        reason: item.reason,
        textSummary: item.textSummary,
      })),
    },
    now,
  });
  const followupArtifact = addArtifact({
    runId: run.id,
    kind: "meeting_followup",
    title: "Draft follow-up actions",
    data: {
      followups,
      policy: {
        requiresApproval: true,
        reason: "meeting-derived actions can change customer-facing work or team tasks",
      },
    },
    now,
  });

  const memoryInput = buildMeetingMemoryInput(result, retainedFacts);
  const proposalArtifact = addArtifact({
    runId: run.id,
    kind: "meeting_memory_proposal",
    title: "Proposed meeting memory write",
    data: buildMemoryWriteProposalPayload(memoryInput),
    now,
  });
  const approval = requestApproval({
    runId: run.id,
    artifactId: proposalArtifact.id,
    reason: "Approve meeting-derived company memory before it writes to the shared brain.",
    evidenceVisible: evidence.length > 0,
    now,
  });
  const receipt = createReceipt({
    runId: run.id,
    artifactId: proposalArtifact.id,
    approvalId: approval.id,
    status: "blocked",
    summary: "Meeting memory writeback is staged and blocked until approval.",
    now,
  });
  addTask({
    runId: run.id,
    title: "Approve shared brain update",
    status: "blocked",
    owner: "human",
    detail: "A human must approve the meeting-derived memory proposal before writeback.",
    now,
  });
  addTask({
    runId: run.id,
    title: "Dispatch follow-up actions",
    status: "blocked",
    owner: "human",
    detail: "Follow-up work is drafted, but no connector action runs until approval.",
    now,
  });
  transitionRun(run.id, "needs_approval", { now });

  const packets = await saveMeetingPackets({
    result,
    retainedFacts,
    evidence,
    transcriptArtifact,
    summaryArtifact,
    captureArtifact,
    proposalArtifact,
    followupArtifact,
    approvalId: approval.id,
    receiptId: receipt.id,
    followups,
    now,
  });

  await saveRunSnapshot(run.id);
  const snapshot = getRunSnapshot(run.id);
  if (!snapshot) throw new Error(`Meeting run was not saved: ${run.id}`);

  return {
    runId: run.id,
    task: summarizeAgentTask(snapshot),
    artifacts: snapshot.artifacts.map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title,
      hash: artifact.hash,
    })),
    approval: {
      id: approval.id,
      decision: approval.decision,
      reason: approval.reason,
      evidenceVisible: approval.evidenceVisible,
    },
    receipt: {
      id: receipt.id,
      status: receipt.status,
      summary: receipt.summary,
      artifactHash: receipt.artifactHash,
    },
    packets,
    followups,
  };
}

export function extractMeetingFollowups(result: LearnFromMeetingResult): MeetingFollowup[] {
  const retainedFacts = result.facts.filter((item) =>
    item.status === "learned" || item.status === "proposed" || item.status === "reused"
  );
  const urgent = retainedFacts.filter((item) =>
    /website|site|page|goes live|urgent|fix|launch|announce|applications open|need/i.test(item.fact.claim)
  );
  const selected = urgent.length > 0 ? urgent : retainedFacts.slice(0, 3);

  return selected.slice(0, 5).map((item, index) => ({
    id: `meeting_followup_${index + 1}`,
    title: buildFollowupTitle(item.fact.claim),
    reason: item.fact.claim,
    owner: "quad",
    status: "blocked",
    sourceFactIds: [item.sourceId],
  }));
}

function buildMeetingMemoryInput(
  result: LearnFromMeetingResult,
  retainedFacts: MeetingFactResult[]
): IngestInput {
  const facts = retainedFacts.map((item) => item.fact.claim);
  return {
    orgId: result.orgId,
    sourceId: `meeting_summary:${result.runId}`,
    sourceType: "meeting",
    title: `Meeting memory: ${result.title}`,
    content: [result.summary, ...facts.map((fact) => `- ${fact}`)].join("\n"),
    summary: result.summary,
    entities: ["meeting", "operations", "company_brain"],
    confidence: retainedFacts.length > 0 ? averageConfidence(retainedFacts) : 0.55,
    permissions: ["read"],
    evidence: retainedFacts
      .filter((item) => item.fact.sourceQuote)
      .slice(0, 8)
      .map((item) => ({
        quote: item.fact.sourceQuote,
        documentId: result.runId,
      })),
    validationStatus: retainedFacts.length > 0 ? "verified" : "unverified",
    relatedSourceIds: retainedFacts.map((item) => item.sourceId).slice(0, 10),
    relationships: retainedFacts.map((item) => ({
      kind: "derived_from",
      sourceId: item.sourceId,
    })),
  };
}

async function saveMeetingPackets(input: {
  result: LearnFromMeetingResult;
  retainedFacts: MeetingFactResult[];
  evidence: Array<{ quote: string; documentId: string }>;
  transcriptArtifact: WorkflowArtifactRecord;
  summaryArtifact: WorkflowArtifactRecord;
  captureArtifact: WorkflowArtifactRecord;
  proposalArtifact: WorkflowArtifactRecord;
  followupArtifact: WorkflowArtifactRecord;
  approvalId: string;
  receiptId: string;
  followups: MeetingFollowup[];
  now: string;
}): Promise<QuadChainPacketSummary[]> {
  const evidence = input.evidence.map((item, index) => ({
    id: `${input.transcriptArtifact.id}:quote_${index + 1}`,
    sourceId: input.transcriptArtifact.id,
    quote: item.quote,
    required: true,
  }));
  const retainedClaims = input.retainedFacts.map((item) => item.fact.claim);
  const transcriptOutput = [
    `meeting transcript captured for ${input.result.title}`,
    `transcript artifact: ${input.transcriptArtifact.id}`,
    `summary artifact: ${input.summaryArtifact.id}`,
    `capture artifact: ${input.captureArtifact.id}`,
    `meeting summary: ${input.result.summary}`,
    ...evidence.map((item) => `evidence: ${item.quote}`),
  ].join("\n");
  const transcriptPacket = createQuadChainPacket({
    type: "voice_transcript",
    orgId: input.result.orgId,
    runId: input.result.runId,
    producer: "quad.meeting_agent",
    consumer: "quad.company_brain",
    sources: [
      {
        id: input.transcriptArtifact.id,
        kind: "transcript",
        content: {
          title: input.result.title,
          transcriptHash: hashText(input.result.transcript),
          lineCount: input.result.transcript.split("\n").filter(Boolean).length,
        },
      },
    ],
    evidence,
    output: transcriptOutput,
    answerConcepts: ["meeting", "transcript", "summary"],
    visibility: "restricted",
    createdAt: input.now,
  });

  const memoryOutput = [
    "meeting memory approval required",
    `approval id: ${input.approvalId}`,
    `receipt id: ${input.receiptId}`,
    `memory proposal artifact: ${input.proposalArtifact.id}`,
    `meeting summary: ${input.result.summary}`,
    ...retainedClaims.map((claim) => `proposed memory: ${claim}`),
    ...evidence.map((item) => `evidence: ${item.quote}`),
  ].join("\n");
  const memoryPacket = createQuadChainPacket({
    type: "approval",
    orgId: input.result.orgId,
    runId: input.result.runId,
    producer: "quad.meeting_agent",
    consumer: "quad.operator_console",
    sources: [
      {
        id: input.proposalArtifact.id,
        kind: "artifact",
        content: {
          title: input.proposalArtifact.title,
          hash: input.proposalArtifact.hash,
          approvalId: input.approvalId,
          receiptId: input.receiptId,
        },
      },
    ],
    evidence,
    output: memoryOutput,
    answerConcepts: ["meeting", "memory", "approval"],
    visibility: "restricted",
    createdAt: input.now,
  });

  const followupOutput = [
    "meeting agent handoff created",
    `follow-up artifact: ${input.followupArtifact.id}`,
    `follow-up count: ${input.followups.length}`,
    ...input.followups.map((followup) => `follow-up: ${followup.title}`),
  ].join("\n");
  const followupPacket = createQuadChainPacket({
    type: "agent_handoff",
    orgId: input.result.orgId,
    runId: input.result.runId,
    producer: "quad.meeting_agent",
    consumer: "quad.fde_agent",
    sources: [
      {
        id: input.followupArtifact.id,
        kind: "artifact",
        content: {
          title: input.followupArtifact.title,
          hash: input.followupArtifact.hash,
          followupCount: input.followups.length,
        },
      },
    ],
    output: followupOutput,
    answerConcepts: ["meeting", "handoff", "follow-up"],
    visibility: "internal",
    createdAt: input.now,
  });

  const saved = await Promise.all([
    saveQuadChainPacket(transcriptPacket),
    saveQuadChainPacket(memoryPacket),
    saveQuadChainPacket(followupPacket),
  ]);
  return [transcriptPacket, memoryPacket, followupPacket].map(
    (packet, index) => summarizeQuadChainPacket(packet) ?? saved[index].summary
  );
}

function factPreview(item: MeetingFactResult) {
  return {
    claim: item.fact.claim,
    category: item.fact.category,
    status: item.status,
    confidence: item.confidence,
    sourceId: item.sourceId,
  };
}

function buildFollowupTitle(claim: string): string {
  if (/blood|donation|drive/i.test(claim)) return "Update blood drive proof on the site";
  if (/cpr|aed|training/i.test(claim)) return "Publish virtual CPR training proof";
  if (/disaster ready|preparedness|applications/i.test(claim)) return "Announce Disaster Ready Homes";
  if (/volunteer|shelter/i.test(claim)) return "Draft volunteer recruitment update";
  return `Review meeting-derived action ${claim.slice(0, 48)}`;
}

function averageConfidence(facts: MeetingFactResult[]): number {
  const values = facts.map((item) => item.confidence).filter((item): item is number => typeof item === "number");
  if (values.length === 0) return 0.7;
  return Math.round((values.reduce((sum, item) => sum + item, 0) / values.length) * 100) / 100;
}

function hashText(value: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
