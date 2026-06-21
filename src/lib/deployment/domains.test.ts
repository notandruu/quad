import { describe, expect, it } from "vitest";
import { isQuadLandingHost, normalizeQuadAppUrl, QUAD_APP_URL, QUAD_LANDING_URL } from "./domains";

describe("deployment domains", () => {
  it("keeps landing and app hosts separate", () => {
    expect(QUAD_LANDING_URL).toBe("https://quad.stephenhung.me");
    expect(QUAD_APP_URL).toBe("https://app.quad.stephenhung.me");
    expect(isQuadLandingHost("quad.stephenhung.me")).toBe(true);
    expect(isQuadLandingHost("app.quad.stephenhung.me")).toBe(false);
  });

  it("normalizes accidentally supplied landing urls to the app url", () => {
    expect(normalizeQuadAppUrl("https://quad.stephenhung.me/")).toBe(QUAD_APP_URL);
    expect(normalizeQuadAppUrl("quad.stephenhung.me")).toBe(QUAD_APP_URL);
    expect(normalizeQuadAppUrl("https://app.quad.stephenhung.me/")).toBe(QUAD_APP_URL);
  });
});
