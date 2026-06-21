import { afterEach, describe, expect, it, vi } from "vitest";
import { publishAuditEvent } from "./publisher";
import { replayAuditEvents } from "./replay";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("audit event stream publisher", () => {
  it("keeps zero-key events replayable in memory with stable sequence numbers", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");
    const runId = `run_event_memory_${crypto.randomUUID()}`;

    await publishAuditEvent(runId, "audit.started", { targetUrl: "https://example.com" }, { orgId: "org_events" });
    await publishAuditEvent(runId, "page.rendered", { url: "https://example.com" }, { orgId: "org_events" });

    await expect(replayAuditEvents(runId, { orgId: "org_events" })).resolves.toMatchObject([
      {
        type: "audit.started",
        sequence: 0,
        runId,
        orgId: "org_events",
        storage: "memory",
      },
      {
        type: "page.rendered",
        sequence: 1,
        runId,
        orgId: "org_events",
        storage: "memory",
      },
    ]);
  });

  it("isolates memory replay by org id when run ids collide", async () => {
    vi.stubEnv("QUAD_REDIS_REST_URL", "");
    vi.stubEnv("QUAD_REDIS_REST_TOKEN", "");
    const runId = `run_event_collision_${crypto.randomUUID()}`;

    await publishAuditEvent(runId, "audit.started", { org: "a" }, { orgId: "org_a" });
    await publishAuditEvent(runId, "audit.started", { org: "b" }, { orgId: "org_b" });

    const orgA = await replayAuditEvents(runId, { orgId: "org_a" });
    const orgB = await replayAuditEvents(runId, { orgId: "org_b" });

    expect(orgA).toHaveLength(1);
    expect(orgB).toHaveLength(1);
    expect(orgA[0]).toMatchObject({ orgId: "org_a", payload: { org: "a" } });
    expect(orgB[0]).toMatchObject({ orgId: "org_b", payload: { org: "b" } });
  });
});
