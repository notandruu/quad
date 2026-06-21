import { describe, expect, it } from "vitest";
import {
  CAPABILITY_CATALOG,
  buildActiveToolCatalog,
  buildCapabilityInstallPlan,
  getEnterpriseProofStarterBundle,
  resolveCapabilityPolicy,
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
        allowlisted: true,
        disabled: false,
        installSource: "default",
        reason: "Ready.",
      },
      {
        id: "cms.publisher",
        installed: true,
        status: "degraded",
        missingEnv: ["CMS_API_KEY"],
        active: false,
        allowlisted: true,
        disabled: false,
        installSource: "forced",
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

  it("uses org policy to allowlist, disable, and force-install capabilities", () => {
    const summary = summarizeCapabilities(
      {
        QUAD_CAPABILITY_ALLOWLIST: "quad.chain_verifier,cms.publisher",
        QUAD_CAPABILITY_DISABLED: "quad.chain_verifier",
        QUAD_CAPABILITY_FORCE_INSTALLED: "cms.publisher",
        CMS_API_KEY: "cms_test",
      },
      { orgId: "org_enterprise" }
    );

    const verifier = summary.installed.find((state) => state.id === "quad.chain_verifier");
    const cms = summary.installed.find((state) => state.id === "cms.publisher");
    const browserbase = summary.installed.find((state) => state.id === "browserbase.read_browser");

    expect(summary.policy).toMatchObject({
      orgId: "org_enterprise",
      allowlist: ["quad.chain_verifier", "cms.publisher"],
      disabled: ["quad.chain_verifier"],
      forceInstalled: ["cms.publisher"],
      requireWriteAllowlist: true,
    });
    expect(verifier).toMatchObject({
      active: false,
      disabled: true,
      reason: "Capability is disabled by org policy.",
    });
    expect(cms).toMatchObject({
      installed: true,
      active: true,
      allowlisted: true,
      installSource: "forced",
    });
    expect(browserbase).toMatchObject({
      installed: true,
      active: false,
      allowlisted: false,
      reason: "Capability is not allowlisted for this org.",
    });
    expect(summary.activeTools.map((tool) => tool.id)).toEqual(["cms.publisher"]);
  });

  it("requires explicit allowlisting before activating write tools", () => {
    const blocked = summarizeCapabilities({
      QUAD_CAPABILITY_FORCE_INSTALLED: "cms.publisher",
      CMS_API_KEY: "cms_test",
    }).installed.find((state) => state.id === "cms.publisher");

    const allowed = summarizeCapabilities({
      QUAD_CAPABILITY_ALLOWLIST: "cms.publisher",
      QUAD_CAPABILITY_FORCE_INSTALLED: "cms.publisher",
      CMS_API_KEY: "cms_test",
    }).installed.find((state) => state.id === "cms.publisher");

    expect(blocked).toMatchObject({
      installed: true,
      active: false,
      reason: "Write capability requires explicit org allowlisting.",
    });
    expect(allowed).toMatchObject({
      installed: true,
      active: true,
    });
  });

  it("parses capability policy from env with safe defaults", () => {
    expect(
      resolveCapabilityPolicy({
        QUAD_CAPABILITY_ALLOWLIST: "quad.chain_verifier, trust_packet.exporter",
        QUAD_CAPABILITY_DISABLED: "sentry.reliability",
        QUAD_REQUIRE_WRITE_CAPABILITY_ALLOWLIST: "false",
      })
    ).toEqual({
      orgId: undefined,
      allowlist: ["quad.chain_verifier", "trust_packet.exporter"],
      disabled: ["sentry.reliability"],
      forceInstalled: [],
      requireWriteAllowlist: false,
    });
  });

  it("builds a safe install plan for the enterprise proof starter bundle", () => {
    const plan = buildCapabilityInstallPlan({
      env: {
        QUAD_CAPABILITY_DISABLED: "sentry.reliability",
        BROWSERBASE_API_KEY: "bb",
        BROWSERBASE_PROJECT_ID: "project",
      },
      orgId: "org_plan",
    });

    expect(plan.bundleId).toBe("enterprise_proof_starter");
    expect(plan.knownIds).toContain("browserbase.read_browser");
    expect(plan.unknownIds).toEqual([]);
    expect(plan.newlyAllowlisted).toEqual(expect.arrayContaining(["quad.chain_verifier", "browserbase.read_browser"]));
    expect(plan.newlyForceInstalled).toEqual([]);
    expect(plan.envRequired).toEqual(
      expect.arrayContaining([
        { id: "quad.company_brain", missingEnv: ["SUPABASE_URL", "SUPABASE_SERVICE_KEY"] },
        { id: "arize.phoenix", missingEnv: ["PHOENIX_COLLECTOR_ENDPOINT"] },
      ])
    );
    expect(plan.blockedAfterInstall).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "sentry.reliability",
          reason: "Capability is disabled by org policy.",
        }),
      ])
    );
    expect(plan.activeAfterInstall.map((tool) => tool.id)).toEqual(
      expect.arrayContaining(["quad.chain_verifier", "trust_packet.exporter", "browserbase.read_browser"])
    );
  });

  it("force-installs write tools in preview but still reports missing env", () => {
    const plan = buildCapabilityInstallPlan({
      env: {},
      orgId: "org_plan",
      includeWriteTools: true,
    });

    expect(plan.newlyAllowlisted).toEqual(expect.arrayContaining(["cms.publisher", "task.publisher"]));
    expect(plan.newlyForceInstalled).toEqual(expect.arrayContaining(["cms.publisher", "task.publisher", "browserbase.write_browser"]));
    expect(plan.envRequired).toEqual(
      expect.arrayContaining([
        { id: "cms.publisher", missingEnv: ["CMS_API_KEY"] },
        { id: "task.publisher", missingEnv: ["LINEAR_API_KEY"] },
      ])
    );
    expect(plan.blockedAfterInstall.map((item) => item.id)).toEqual(
      expect.arrayContaining(["cms.publisher", "task.publisher"])
    );
  });

  it("keeps unknown capability ids out of policy previews", () => {
    const plan = buildCapabilityInstallPlan({
      env: {},
      capabilityIds: ["quad.chain_verifier", "missing.capability"],
    });

    expect(plan.knownIds).toEqual(["quad.chain_verifier"]);
    expect(plan.unknownIds).toEqual(["missing.capability"]);
    expect(plan.policyPreview.allowlist).toEqual(["quad.chain_verifier"]);
  });
});
