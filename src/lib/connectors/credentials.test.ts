import { describe, expect, it, vi } from "vitest";
import { getQuadChainPackets } from "@/lib/quad-chain/registry";
import {
  installConnectorCredential,
  listConnectorCredentials,
  revokeConnectorCredential,
} from "./credentials";

describe("connector credential vault", () => {
  it("encrypts credentials and returns metadata-only summaries", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "");
    vi.stubEnv("QUAD_CONNECTOR_ENCRYPTION_KEY", "test-encryption-key");

    const result = await installConnectorCredential({
      orgId: "org_connector_secret",
      capabilityId: "cms.publisher",
      credential: {
        accessToken: "secret-token-value",
        endpoint: "https://cms.example",
      },
      scopes: ["cms:draft"],
      actor: "admin@example.com",
      now: "2026-06-21T00:00:00.000Z",
    });
    const serialized = JSON.stringify(result);

    expect(result.summary).toMatchObject({
      orgId: "org_connector_secret",
      capabilityId: "cms.publisher",
      scopes: ["cms:draft"],
      status: "installed",
      hasCredential: true,
    });
    expect(result.summary).not.toHaveProperty("encryptedCredential");
    expect(result.summary.credentialHash).toMatch(/^sha256:/);
    expect(result.packet).toMatchObject({
      type: "connector_action",
      orgId: "org_connector_secret",
      accepted: true,
      evidenceRequired: 3,
      evidencePreserved: 3,
      visibility: "restricted",
    });
    expect(serialized).not.toContain("secret-token-value");

    const packets = await getQuadChainPackets({
      orgId: "org_connector_secret",
      runId: result.receipt.id,
      type: "connector_action",
    });
    expect(packets).toHaveLength(1);
    expect(JSON.stringify(packets[0])).not.toContain("secret-token-value");
  });

  it("rejects scopes outside the manifest", async () => {
    await expect(installConnectorCredential({
      orgId: "org_connector_scope",
      capabilityId: "cms.publisher",
      credential: { token: "secret" },
      scopes: ["admin:everything"],
    })).rejects.toMatchObject({
      code: "scope_not_allowed",
      status: 400,
    });
  });

  it("revokes an installed credential without deleting metadata", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_KEY", "");

    const installed = await installConnectorCredential({
      orgId: "org_connector_revoke",
      capabilityId: "task.publisher",
      credential: { apiKey: "secret" },
      now: "2026-06-21T00:00:00.000Z",
    });
    const revoked = await revokeConnectorCredential({
      orgId: "org_connector_revoke",
      installId: installed.summary.id,
      actor: "security@example.com",
      now: "2026-06-21T01:00:00.000Z",
    });

    expect(revoked.summary.status).toBe("revoked");
    expect(revoked.summary.revokedAt).toBe("2026-06-21T01:00:00.000Z");
    expect(revoked.receipt).toMatchObject({
      action: "revoked",
      installId: installed.summary.id,
      actor: "security@example.com",
    });
    expect(revoked.packet).toMatchObject({
      type: "connector_action",
      accepted: true,
      visibility: "restricted",
    });
  });
});
