import { describe, expect, it } from "vitest";
import { appendVoiceTranscriptContext } from "./upload";

describe("appendVoiceTranscriptContext", () => {
  it("adds org, run, and remember fields for scoped voice memory", () => {
    const form = appendVoiceTranscriptContext(new FormData(), {
      orgId: " org_brightpath ",
      runId: " run_123 ",
      remember: true,
    });

    expect(form.get("orgId")).toBe("org_brightpath");
    expect(form.get("runId")).toBe("run_123");
    expect(form.get("remember")).toBe("true");
  });

  it("omits empty optional values", () => {
    const form = appendVoiceTranscriptContext(new FormData(), {
      orgId: " ",
      runId: null,
    });

    expect(form.has("orgId")).toBe(false);
    expect(form.has("runId")).toBe(false);
    expect(form.has("remember")).toBe(false);
  });
});
