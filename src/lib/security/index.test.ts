import { describe, expect, it } from "vitest";
import {
  assertModelCallAllowed,
  classifyText,
  prepareModelPayload,
  sanitizePayload,
  securityReadiness,
  telemetryAttributes,
  tenantKey,
} from ".";

describe("security governance", () => {
  it("classifies restricted secrets before model calls", () => {
    expect(classifyText("OPENAI_API_KEY=sk-proj-abcdefghijklmnop123456")).toBe("restricted");
    expect(classifyText("SOC 2 security questionnaire for customer")).toBe("confidential");
    expect(classifyText("public marketing page")).toBe("public");
  });

  it("redacts sensitive fields in non-public payloads", () => {
    const payload = sanitizePayload("email ceo@example.com token=supersecretvalue", {
      classification: "confidential",
      redact: true,
    });

    expect(payload.text).toContain("[redacted:email]");
    expect(payload.text).toContain("[redacted:secret]");
    expect(payload.redactions.map((item) => item.kind)).toEqual(["secret", "email"]);
  });

  it("blocks restricted model payloads without explicit override", () => {
    const decision = prepareModelPayload({
      purpose: "audit",
      text: "password=supersecretvalue",
    });

    expect(decision.policy.allowed).toBe(false);
    expect(decision.payload.text).toBe("");
    expect(() => assertModelCallAllowed(decision)).toThrow("Restricted data");
  });

  it("allows restricted payloads only after redaction and override", () => {
    const decision = prepareModelPayload({
      purpose: "evaluation",
      text: "password=supersecretvalue",
      allowRestricted: true,
    });

    expect(decision.policy.allowed).toBe(true);
    expect(decision.payload.text).toContain("[redacted:secret]");
  });

  it("builds normalized tenant keys", () => {
    expect(tenantKey("Acme Inc.", "audit run", "ABC 123")).toBe("org:acme_inc:audit_run:abc_123");
  });

  it("emits telemetry metadata without raw org ids or payloads", () => {
    const payload = sanitizePayload("internal roadmap", { classification: "internal" });
    const attrs = telemetryAttributes({ orgId: "org-secret", purpose: "chat", payload });

    expect(attrs["quad.org_hash"]).not.toBe("org-secret");
    expect(attrs["quad.model_purpose"]).toBe("chat");
    expect(attrs["quad.payload_original_length"]).toBe("internal roadmap".length);
  });

  it("reports security substrate readiness", () => {
    expect(securityReadiness({}).retentionPolicy).toBe(false);
    expect(securityReadiness({ QUAD_RETENTION_DAYS: "30" }).label).toBe("Security substrate wired");
  });
});
