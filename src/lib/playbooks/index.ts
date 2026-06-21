import type { Intent } from "@/lib/types";

export type PlaybookAutonomyTier = "read" | "draft" | "confirm" | "approve";

export type PlaybookManifest = {
  id: string;
  capabilityId: string;
  name: string;
  description: string;
  owner: "quad" | "human" | "connector";
  intents: Intent[];
  requiredCapabilities: string[];
  requiredEvidence: string[];
  guardrails: string[];
  outputArtifacts: string[];
  approvalTier: PlaybookAutonomyTier;
  verifier: {
    required: boolean;
    checks: string[];
  };
};

export type PlaybookSelection = {
  playbook: PlaybookManifest;
  missingCapabilities: string[];
  ready: boolean;
  reason: string;
};

export type PlaybookCatalogSummary = {
  total: number;
  ready: number;
  blocked: number;
  approvalGated: number;
  verifierRequired: number;
  playbooks: Array<{
    id: string;
    capabilityId: string;
    name: string;
    intents: Intent[];
    requiredCapabilityCount: number;
    missingCapabilityCount: number;
    approvalTier: PlaybookAutonomyTier;
    verifierRequired: boolean;
    ready: boolean;
    reason: string;
  }>;
};

export const PLAYBOOK_CATALOG: PlaybookManifest[] = [
  {
    id: "enterprise_proof.answer_question",
    capabilityId: "playbook.enterprise_proof",
    name: "Enterprise proof answer loop",
    description: "Retrieve memory, collect connector evidence, draft a grounded answer, evaluate it, and write back only verified organizational facts.",
    owner: "quad",
    intents: ["company_question", "audit_follow_up"],
    requiredCapabilities: ["quad.company_brain", "quad.chain_verifier"],
    requiredEvidence: ["brain memory or connector document", "judge result", "quadchain packet"],
    guardrails: [
      "unsupported answers become needs-human instead of learned memory",
      "target memory scope must be explicit",
      "writeback is idempotent by question source id",
    ],
    outputArtifacts: ["trust answer", "validated memory", "needs-human receipt"],
    approvalTier: "draft",
    verifier: {
      required: true,
      checks: ["grounded answer", "answers question", "scope is unambiguous"],
    },
  },
  {
    id: "trust_packet.build_and_stage",
    capabilityId: "playbook.trust_packet",
    name: "Trust packet builder",
    description: "Turn approved findings into a customer-ready trust packet with preserved evidence, omitted ranges, open obligations, and publisher dry-runs.",
    owner: "quad",
    intents: ["audit_follow_up", "draft_content"],
    requiredCapabilities: ["quad.chain_verifier", "trust_packet.exporter"],
    requiredEvidence: ["finding quote", "source url", "approval state", "certificate summary"],
    guardrails: [
      "weak evidence creates open obligations",
      "customer-facing publication requires human approval",
      "publisher connectors run in dry-run mode first",
    ],
    outputArtifacts: ["trust packet", "approval request", "connector draft"],
    approvalTier: "confirm",
    verifier: {
      required: true,
      checks: ["evidence preserved", "omitted ranges recorded", "approval receipt exists"],
    },
  },
  {
    id: "meeting_memory.capture",
    capabilityId: "playbook.meeting_memory",
    name: "Meeting memory capture",
    description: "Classify meeting or voice signals, retain company facts, discard noise, and stage shared memory proposals with proof receipts.",
    owner: "quad",
    intents: ["summarize_meeting", "save_memory"],
    requiredCapabilities: ["quad.company_brain", "deepgram.voice_memory", "quad.chain_verifier"],
    requiredEvidence: ["transcript summary", "retained fact", "source timestamp or speaker hint"],
    guardrails: [
      "personal context is not promoted to company memory without explicit scope",
      "noise is summarized but not persisted",
      "shared memory writes go through approval-backed ingest",
    ],
    outputArtifacts: ["meeting summary", "memory proposal", "voice transcript packet"],
    approvalTier: "draft",
    verifier: {
      required: true,
      checks: ["signal classification", "scope policy", "memory receipt"],
    },
  },
  {
    id: "approved_fix.publish",
    capabilityId: "playbook.approved_fix",
    name: "Approved fix publisher",
    description: "Stage website, task, browser, and team-system fixes through connector dry-runs, approval receipts, execution, and post-ship verification.",
    owner: "connector",
    intents: ["draft_content", "create_task"],
    requiredCapabilities: ["quad.chain_verifier", "cms.publisher", "task.publisher"],
    requiredEvidence: ["approved artifact", "connector draft", "post-ship verification"],
    guardrails: [
      "write-capable connectors require explicit org allowlisting",
      "external submit is tier 3 approve",
      "execution records rollback and verifier requirements",
    ],
    outputArtifacts: ["cms draft", "task draft", "connector execution", "verification report"],
    approvalTier: "approve",
    verifier: {
      required: true,
      checks: ["approval receipt", "connector action packet", "post-ship verification"],
    },
  },
];

export function selectPlaybooksForIntent(input: {
  intent: Intent;
  activeCapabilityIds?: string[];
}): PlaybookSelection[] {
  const active = new Set(input.activeCapabilityIds ?? []);

  return PLAYBOOK_CATALOG
    .filter((playbook) => playbook.intents.includes(input.intent))
    .map((playbook) => {
      const missingCapabilities = playbook.requiredCapabilities.filter((id) => !active.has(id));
      return {
        playbook,
        missingCapabilities,
        ready: missingCapabilities.length === 0,
        reason: missingCapabilities.length === 0
          ? "All required capabilities are active."
          : `Missing ${missingCapabilities.length} required capability${missingCapabilities.length === 1 ? "" : "ies"}.`,
      };
    });
}

export function summarizePlaybookCatalog(input: {
  activeCapabilityIds?: string[];
  intent?: Intent;
} = {}): PlaybookCatalogSummary {
  const playbooks = input.intent
    ? selectPlaybooksForIntent({ intent: input.intent, activeCapabilityIds: input.activeCapabilityIds })
    : PLAYBOOK_CATALOG.map((playbook) => {
        const active = new Set(input.activeCapabilityIds ?? []);
        const missingCapabilities = playbook.requiredCapabilities.filter((id) => !active.has(id));
        return {
          playbook,
          missingCapabilities,
          ready: missingCapabilities.length === 0,
          reason: missingCapabilities.length === 0
            ? "All required capabilities are active."
            : `Missing ${missingCapabilities.length} required capability${missingCapabilities.length === 1 ? "" : "ies"}.`,
        };
      });

  return {
    total: playbooks.length,
    ready: playbooks.filter((selection) => selection.ready).length,
    blocked: playbooks.filter((selection) => !selection.ready).length,
    approvalGated: playbooks.filter((selection) => selection.playbook.approvalTier !== "read").length,
    verifierRequired: playbooks.filter((selection) => selection.playbook.verifier.required).length,
    playbooks: playbooks.map((selection) => ({
      id: selection.playbook.id,
      capabilityId: selection.playbook.capabilityId,
      name: selection.playbook.name,
      intents: selection.playbook.intents,
      requiredCapabilityCount: selection.playbook.requiredCapabilities.length,
      missingCapabilityCount: selection.missingCapabilities.length,
      approvalTier: selection.playbook.approvalTier,
      verifierRequired: selection.playbook.verifier.required,
      ready: selection.ready,
      reason: selection.reason,
    })),
  };
}
