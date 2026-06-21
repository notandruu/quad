import { describe, expect, it } from "vitest";
import { getCapability } from "@/lib/metaregistry";
import {
  buildConnectorRegistry,
  buildConnectorRegistryEntry,
} from "./registry";
import type { ConnectorCredentialSummary } from "./credentials";

describe("connector registry", () => {
  it("summarizes connector auth, risk, credentials, and playbook bindings", async () => {
    const registry = await buildConnectorRegistry({
      orgId: "org_registry",
      env: {
        QUAD_CAPABILITY_ALLOWLIST: "browserbase.write_browser,cms.publisher,trust_packet.exporter",
        QUAD_CAPABILITY_FORCE_INSTALLED: "browserbase.write_browser,cms.publisher",
        QUAD_CAPABILITY_REVOKED: "cms.publisher",
        BROWSERBASE_API_KEY: "bb",
        BROWSERBASE_PROJECT_ID: "project",
        CMS_API_KEY: "cms_secret",
      },
      credentials: [
        credential({
          capabilityId: "browserbase.write_browser",
          scopes: ["browser:write", "forms:stage"],
        }),
        credential({
          capabilityId: "cms.publisher",
          scopes: ["cms:draft"],
          status: "revoked",
        }),
      ],
    });
    const browserWrite = registry.entries.find((entry) => entry.capabilityId === "browserbase.write_browser");
    const cms = registry.entries.find((entry) => entry.capabilityId === "cms.publisher");
    const trustPacket = registry.entries.find((entry) => entry.capabilityId === "trust_packet.exporter");

    expect(registry.total).toBeGreaterThanOrEqual(10);
    expect(registry.writeCapable).toBeGreaterThanOrEqual(3);
    expect(registry.byKind.browser).toBeGreaterThanOrEqual(2);
    expect(browserWrite).toMatchObject({
      kind: "browser",
      authMode: "hosted_provider",
      writes: true,
      approvalMode: "human_approval",
      credentialStatus: "installed",
      lifecycleState: "allowlisted",
      capabilityActive: true,
      risk: "high",
      nextAction: "keep writes behind approval receipts.",
    });
    expect(cms).toMatchObject({
      kind: "publisher",
      credentialStatus: "revoked",
      lifecycleState: "revoked",
      capabilityActive: false,
      risk: "high",
      nextAction: "install a fresh credential before routing.",
    });
    expect(trustPacket).toMatchObject({
      credentialRequired: false,
      credentialStatus: "not_required",
      risk: "medium",
    });
    expect(trustPacket?.boundPlaybooks.map((playbook) => playbook.id)).toContain("trust_packet.build_and_stage");
  });

  it("builds safe entries without exposing credential payloads", () => {
    const capability = getCapability("task.publisher");
    if (!capability) throw new Error("missing test capability");

    const entry = buildConnectorRegistryEntry(capability, [
      credential({
        capabilityId: "task.publisher",
        scopes: ["tasks:create"],
        credentialHash: "hash_secret_should_not_be_secret",
      }),
    ]);

    expect(entry).toMatchObject({
      capabilityId: "task.publisher",
      kind: "publisher",
      authMode: "api_key",
      credentialStatus: "installed",
      lifecycleState: "installed",
      capabilityActive: false,
      boundPlaybooks: expect.arrayContaining([
        expect.objectContaining({ id: "approved_fix.publish" }),
      ]),
    });
    expect(JSON.stringify(entry)).not.toContain("secret-token");
  });
});

function credential(input: Partial<ConnectorCredentialSummary> & { capabilityId: string }): ConnectorCredentialSummary {
  return {
    id: `conn_${input.capabilityId}`,
    orgId: "org_registry",
    capabilityId: input.capabilityId,
    actor: "operator.test",
    scopes: input.scopes ?? [],
    status: input.status ?? "installed",
    credentialHash: input.credentialHash ?? "hash_test",
    createdAt: "2026-06-21T00:00:00.000Z",
    updatedAt: "2026-06-21T00:00:00.000Z",
    revokedAt: input.status === "revoked" ? "2026-06-21T00:00:00.000Z" : null,
    hasCredential: input.status !== "revoked",
  };
}
