import { describe, expect, it, vi } from "vitest";
import {
  buildRequestFingerprint,
  checkMutationGuards,
  idempotencyReplayBody,
  saveIdempotentResult,
} from "./mutations";

function headers(input: Record<string, string> = {}) {
  return new Headers(input);
}

describe("mutation safety", () => {
  it("builds stable fingerprints independent of object key order", () => {
    expect(buildRequestFingerprint({ b: 2, a: 1 })).toBe(
      buildRequestFingerprint({ a: 1, b: 2 })
    );
  });

  it("rate limits mutations per org and route", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");

    const first = await checkMutationGuards({
      orgId: "org_rate",
      route: "jobs.create.test",
      headers: headers(),
      fingerprint: "fnv1a:first",
      limit: 1,
      windowSeconds: 60,
    });
    const second = await checkMutationGuards({
      orgId: "org_rate",
      route: "jobs.create.test",
      headers: headers(),
      fingerprint: "fnv1a:second",
      limit: 1,
      windowSeconds: 60,
    });

    expect(first.ok).toBe(true);
    expect(second).toMatchObject({
      ok: false,
      status: 429,
      code: "rate_limited",
    });
  });

  it("replays an idempotent result for the same key and fingerprint", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");
    const requestHeaders = headers({ "idempotency-key": "job-123" });
    const fingerprint = buildRequestFingerprint({ targetUrl: "https://example.com" });

    const first = await checkMutationGuards({
      orgId: "org_idempotent",
      route: "jobs.create.test",
      headers: requestHeaders,
      fingerprint,
    });
    expect(first).toMatchObject({ ok: true, replay: null, idempotencyKey: "job-123" });

    await saveIdempotentResult({
      orgId: "org_idempotent",
      route: "jobs.create.test",
      headers: requestHeaders,
      fingerprint,
      body: { ok: true, jobId: "job_a" },
    });

    const second = await checkMutationGuards({
      orgId: "org_idempotent",
      route: "jobs.create.test",
      headers: requestHeaders,
      fingerprint,
    });

    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error("expected idempotent replay");
    expect(second.replay?.body).toEqual({ ok: true, jobId: "job_a" });
    expect(idempotencyReplayBody(second.replay!)).toMatchObject({
      ok: true,
      jobId: "job_a",
      idempotency: {
        replayed: true,
        key: "job-123",
      },
    });
  });

  it("rejects reused idempotency keys with a different fingerprint", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");
    const requestHeaders = headers({ "idempotency-key": "same-key" });

    await saveIdempotentResult({
      orgId: "org_conflict",
      route: "ingest.test",
      headers: requestHeaders,
      fingerprint: buildRequestFingerprint({ title: "first" }),
      body: { ok: true },
    });

    const result = await checkMutationGuards({
      orgId: "org_conflict",
      route: "ingest.test",
      headers: requestHeaders,
      fingerprint: buildRequestFingerprint({ title: "second" }),
    });

    expect(result).toMatchObject({
      ok: false,
      status: 409,
      code: "idempotency_conflict",
    });
  });
});
