import { describe, expect, it } from "vitest";
import {
  expectPublicPayloadHasNoSecrets,
  findPublicPayloadSecretLeaks,
} from "./publicPayload";

describe("public payload secret scanning", () => {
  const env = {
    OPENAI_API_KEY: "sk-proj-public-payload-test-secret",
    ANTHROPIC_API_KEY: "sk-ant-public-payload-test-secret",
    QUAD_API_SECRET: "quad-public-payload-secret",
    SENTRY_DSN: "https://public:secret@sentry.example/1",
  };

  it("detects configured secret values anywhere in a public payload", () => {
    expect(findPublicPayloadSecretLeaks({
      nested: {
        value: `bearer ${env.QUAD_API_SECRET}`,
      },
    }, env)).toEqual([
      expect.objectContaining({
        path: "$.nested.value",
        envKey: "QUAD_API_SECRET",
      }),
    ]);
  });

  it("allows env key names and boolean readiness without secret values", () => {
    expect(() => expectPublicPayloadHasNoSecrets({
      configured: true,
      missing: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
      note: "set api keys before claiming live integration",
    }, env)).not.toThrow();
  });
});
