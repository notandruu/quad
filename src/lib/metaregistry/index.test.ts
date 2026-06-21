import { describe, expect, it } from "vitest";
import {
  CAPABILITY_CATALOG,
  buildActiveToolCatalog,
  getEnterpriseProofStarterBundle,
  summarizeCapabilities,
  validateCapabilityManifest,
  type CapabilityInstallState,
  type CapabilityManifest,
} from ".";

describe("metaregistry", () => {
  it("keeps write capabilities behind an approval policy", () => {
    const failures = CAPABILITY_CATALOG.flatMap((manifest) => validateCapabilityManifest(manifest));
    expect(failures).not.toContain("write_capability_needs_approval_mode");
  });

  it("does not activate degraded external capabilities", () => {
    const summary = summarizeCapabilities({});
    const activeIds = summary.activeTools.map((tool) => tool.id);

    expect(activeIds).toContain("quad.chain_verifier");
    expect(activeIds).toContain("trust_packet.exporter");
    expect(activeIds).not.toContain("browserbase.read_browser");
    expect(activeIds).not.toContain("sentry.reliability");
  });

  it("builds an enterprise proof starter bundle", () => {
    const bundle = getEnterpriseProofStarterBundle().map((manifest) => manifest.id);

    expect(bundle).toContain("quad.chain_verifier");
    expect(bundle).toContain("trust_packet.exporter");
    expect(bundle).toContain("fetch.agent_bridge");
  });

  it("only exposes active states in the tool catalog", () => {
    const states: CapabilityInstallState[] = [
      {
        id: "quad.chain_verifier",
        installed: true,
        status: "available",
        missingEnv: [],
        active: true,
        reason: "Ready.",
      },
      {
        id: "cms.publisher",
        installed: true,
        status: "degraded",
        missingEnv: ["CMS_API_KEY"],
        active: false,
        reason: "Missing CMS_API_KEY.",
      },
    ];

    expect(buildActiveToolCatalog(states).map((tool) => tool.id)).toEqual(["quad.chain_verifier"]);
  });

  it("rejects unsafe ad hoc manifests", () => {
    const manifest: CapabilityManifest = {
      id: "cms",
      name: "Cms",
      kind: "publisher",
      description: "Publishes directly.",
      owner: "andrew",
      env: ["cms-key"],
      scopes: [],
      writes: true,
      approvalMode: "none",
      enabledByDefault: true,
      tags: [],
    };

    expect(validateCapabilityManifest(manifest)).toEqual([
      "id_must_be_namespaced",
      "write_capability_needs_approval_mode",
      "scope_required",
      "env_key_invalid",
    ]);
  });
});
