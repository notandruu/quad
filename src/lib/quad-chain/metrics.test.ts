import { describe, expect, it } from "vitest";
import { quadChainHeadlineMetrics, quadChainRouteMetrics, totalRouteSavings } from "./metrics";

describe("quad chain metrics", () => {
  it("keeps the headline evidence preservation visible", () => {
    expect(quadChainHeadlineMetrics.find((metric) => metric.label === "Evidence preserved")?.value).toBe("41/41");
  });

  it("computes the multiagent route savings from role rows", () => {
    expect(totalRouteSavings(quadChainRouteMetrics)).toEqual({
      rawTokens: 9000,
      quadChainTokens: 2283,
      tokensSaved: 6717,
      reduction: 74.63,
    });
  });
});
