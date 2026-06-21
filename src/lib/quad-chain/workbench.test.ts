import { describe, expect, it } from "vitest";
import {
  buildQuadChainComparison,
  buildQuadChainModelPrompt,
  parseQuadChainModelPlan,
} from "./workbench";

describe("quad chain workbench", () => {
  it("builds an accepted comparison with a certificate", () => {
    const comparison = buildQuadChainComparison({
      prompt: "Audit oauth and keep the safe fix.",
      createdAt: "2026-06-20T00:00:00.000Z",
    });

    expect(comparison.withQuadChain.accepted).toBe(true);
    expect(comparison.withQuadChain.certificateId).toMatch(/^qchain_/);
    expect(comparison.quadChainTrace).toContain("verified evidence");
    expect(comparison.mechanisticTrace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Evidence extraction", status: "pass" }),
        expect.objectContaining({ label: "Hash binding", status: "pass" }),
        expect.objectContaining({ label: "Verifier", status: "pass" }),
      ])
    );
  });

  it("omits low-signal trace lines while preserving required evidence", () => {
    const comparison = buildQuadChainComparison({
      prompt: "Diagnose checkout.",
      rawTrace: [
        "critical evidence: `/api/checkout/confirm` returned `500`.",
        "debug: cache hit checkout-v2",
        "noise: someone mentioned button colors",
        "policy: do not skip idempotency.",
      ].join("\n"),
      createdAt: "2026-06-20T00:00:00.000Z",
    });

    expect(comparison.quadChainTrace).toContain("/api/checkout/confirm");
    expect(comparison.quadChainTrace).toContain("do not skip idempotency");
    expect(comparison.quadChainTrace).not.toContain("button colors");
    expect(comparison.omittedRanges.map((range) => range.preview)).toContain("debug: cache hit checkout-v2");
  });

  it("uses a model plan while still minting a verifier certificate", () => {
    const rawTrace = [
      "critical evidence: `/api/checkout/confirm` returned `500`.",
      "debug: cache hit checkout-v2",
      "concept: checkout evidence",
    ].join("\n");
    const comparison = buildQuadChainComparison({
      prompt: "Diagnose checkout.",
      rawTrace,
      modelPlan: {
        compressedContext: [
          "verified packet",
          "critical evidence: `/api/checkout/confirm` returned `500`.",
          "checkout",
          "evidence",
        ].join("\n"),
        evidence: ["critical evidence: `/api/checkout/confirm` returned `500`."],
        concepts: ["checkout", "evidence"],
        omitted: [{ preview: "debug: cache hit checkout-v2", reason: "debug cache noise" }],
      },
      createdAt: "2026-06-20T00:00:00.000Z",
    });

    expect(comparison.mode).toBe("anthropic");
    expect(comparison.withQuadChain.accepted).toBe(true);
    expect(comparison.omittedRanges[0].reason).toBe("debug cache noise");
  });

  it("parses a model plan from prose-wrapped json", () => {
    expect(
      parseQuadChainModelPlan(
        'result: {"compressedContext":"packet","evidence":["quote"],"concepts":["trust"],"omitted":[{"preview":"debug","reason":"noise"}]}'
      )
    ).toEqual({
      compressedContext: "packet",
      evidence: ["quote"],
      concepts: ["trust"],
      omitted: [{ preview: "debug", reason: "noise" }],
    });
  });

  it("builds a strict model prompt", () => {
    expect(buildQuadChainModelPrompt({ prompt: "audit", rawTrace: "trace" })).toContain("Return only JSON");
  });
});
