import { describe, expect, it } from "vitest";
import { summarizeRuntimeToolRouting, topRuntimeToolLabels, type RuntimeToolPlanView } from "./runtimeTools";

describe("runtime tool debug summary", () => {
  it("summarizes a fully routed plan", () => {
    const summary = summarizeRuntimeToolRouting({
      intent: "website_audit",
      surface: "fetch_agent",
      requiredCapabilityIds: ["quad.chain_verifier", "fetch.agent_bridge"],
      eagerTools: [
        route("quad.chain_verifier", "Quad chain verifier"),
        route("fetch.agent_bridge", "Fetch agent bridge"),
      ],
      deferredTools: [],
      blockedCapabilities: [],
    });

    expect(summary).toMatchObject({
      label: "Runtime ready",
      hotCount: 2,
      deferredCount: 0,
      blockedCount: 0,
      requiredCount: 2,
      tone: "ready",
    });
  });

  it("keeps partial routing honest when blockers remain", () => {
    const plan: RuntimeToolPlanView = {
      intent: "website_audit",
      surface: "dashboard",
      requiredCapabilityIds: ["quad.chain_verifier", "browserbase.read_browser", "arize.phoenix"],
      eagerTools: [route("quad.chain_verifier", "Quad chain verifier")],
      deferredTools: [route("arize.phoenix", "Arize Phoenix", "deferred")],
      blockedCapabilities: [{ id: "browserbase.read_browser", reason: "Missing two required settings.", missingEnvCount: 2 }],
    };

    expect(summarizeRuntimeToolRouting(plan)).toMatchObject({
      label: "Runtime partially wired",
      hotCount: 1,
      deferredCount: 1,
      blockedCount: 1,
      requiredCount: 3,
      tone: "partial",
    });
    expect(topRuntimeToolLabels(plan)).toEqual([
      "hot: Quad chain verifier",
      "deferred: Arize Phoenix",
      "blocked: browserbase.read_browser",
    ]);
  });
});

function route(id: string, name: string, loadMode: "eager" | "deferred" = "eager") {
  return {
    tool: { id, name },
    loadMode,
    reason: "Ready.",
  };
}
