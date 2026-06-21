import { describe, expect, it } from "vitest";
import {
  PLAYBOOK_CATALOG,
  selectPlaybooksForIntent,
  summarizePlaybookCatalog,
} from ".";

describe("playbook registry", () => {
  it("registers operating procedures with evidence, guardrails, and verifiers", () => {
    expect(PLAYBOOK_CATALOG).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "enterprise_proof.answer_question",
          capabilityId: "playbook.enterprise_proof",
          requiredEvidence: expect.arrayContaining(["judge result"]),
          guardrails: expect.arrayContaining([
            "unsupported answers become needs-human instead of learned memory",
          ]),
          verifier: expect.objectContaining({
            required: true,
          }),
        }),
      ])
    );
    for (const playbook of PLAYBOOK_CATALOG) {
      expect(playbook.id).toContain(".");
      expect(playbook.capabilityId).toMatch(/^playbook\./);
      expect(playbook.requiredCapabilities.length).toBeGreaterThan(0);
      expect(playbook.guardrails.length).toBeGreaterThan(0);
      expect(playbook.outputArtifacts.length).toBeGreaterThan(0);
    }
  });

  it("selects playbooks for an intent and reports missing capabilities", () => {
    const selections = selectPlaybooksForIntent({
      intent: "audit_follow_up",
      activeCapabilityIds: ["quad.company_brain", "quad.chain_verifier"],
    });

    expect(selections.map((selection) => selection.playbook.id)).toEqual(
      expect.arrayContaining(["enterprise_proof.answer_question", "trust_packet.build_and_stage"])
    );
    expect(selections.find((selection) => selection.playbook.id === "enterprise_proof.answer_question")).toMatchObject({
      ready: true,
      missingCapabilities: [],
    });
    expect(selections.find((selection) => selection.playbook.id === "trust_packet.build_and_stage")).toMatchObject({
      ready: false,
      missingCapabilities: ["trust_packet.exporter"],
    });
  });

  it("summarizes playbooks without exposing raw evidence or prompts", () => {
    const summary = summarizePlaybookCatalog({
      activeCapabilityIds: ["quad.company_brain", "quad.chain_verifier", "trust_packet.exporter"],
    });

    expect(summary).toMatchObject({
      total: PLAYBOOK_CATALOG.length,
      approvalGated: PLAYBOOK_CATALOG.length,
      verifierRequired: PLAYBOOK_CATALOG.length,
    });
    expect(summary.ready).toBeGreaterThan(0);
    expect(summary.playbooks.find((playbook) => playbook.id === "trust_packet.build_and_stage")).toMatchObject({
      ready: true,
      missingCapabilityCount: 0,
    });
    expect(JSON.stringify(summary)).not.toMatch(/prompt|transcript text|raw/i);
  });
});
