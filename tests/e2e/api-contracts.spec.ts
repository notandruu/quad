import { expect, test } from "@playwright/test";

test.describe("api contracts", () => {
  test("creates sessions with stable metadata", async ({ request }) => {
    const response = await request.post("/api/sessions");

    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(json.createdAt)).not.toBeNaN();
  });

  test("rejects malformed writes before touching workers", async ({ request }) => {
    const ingest = await request.post("/api/ingest", { data: {} });
    expect(ingest.status()).toBe(400);
    await expect(ingest.json()).resolves.toMatchObject({ error: "title and content required" });

    const agent = await request.post("/api/agent/run", { data: { workflow: "enterprise_proof" } });
    expect([400, 401, 500]).toContain(agent.status());
    const agentJson = await agent.json();
    expect(agentJson.error).toMatch(/targetUrl required|Invalid agent secret|Agent secret is not configured/);

    const trustPacket = await request.post("/api/trust-packet", { data: {} });
    expect(trustPacket.status()).toBe(400);
    await expect(trustPacket.json()).resolves.toMatchObject({ ok: false, error: "runId is required" });

    const approval = await request.post("/api/approvals/missing/decision", { data: {} });
    expect(approval.status()).toBe(400);
    await expect(approval.json()).resolves.toMatchObject({ ok: false });

    const publish = await request.post("/api/publish/dry-run", { data: {} });
    expect(publish.status()).toBe(400);
    await expect(publish.json()).resolves.toMatchObject({ ok: false });

    const refresh = await request.post("/api/brain/refresh", { data: {} });
    expect(refresh.status()).toBe(400);
    await expect(refresh.json()).resolves.toMatchObject({ ok: false, error: "memoryId or sourceId required" });

    const verify = await request.post("/api/quadchain/verify", { data: {} });
    expect(verify.status()).toBe(400);
    await expect(verify.json()).resolves.toMatchObject({ error: "packetId required" });
  });

  test("returns safe empty packet registry summaries", async ({ request }) => {
    const response = await request.get(`/api/quadchain/packets?runId=missing_${Date.now()}&limit=5`);

    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.summary).toMatchObject({
      total: 0,
      accepted: 0,
      rejected: 0,
      tokensSaved: 0,
    });
    expect(json.packets).toEqual([]);
  });

  test("returns a safe run ledger summary", async ({ request }) => {
    const response = await request.get("/api/runs?orgId=org_brightpath&limit=5");

    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.runs)).toBe(true);
    expect(Array.isArray(json.pendingApprovals)).toBe(true);
    expect(JSON.stringify(json)).not.toMatch(/SUPABASE_SERVICE_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/);
  });

  test("returns a safe operator summary", async ({ request }) => {
    const response = await request.get("/api/operator?orgId=org_brightpath&limit=5");

    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.workline).toEqual(["audit", "packet", "approval", "publish"]);
    expect(Array.isArray(json.runs)).toBe(true);
    expect(Array.isArray(json.pendingApprovals)).toBe(true);
    expect(Array.isArray(json.artifacts)).toBe(true);
    expect(Array.isArray(json.capabilities.active)).toBe(true);
    expect(Array.isArray(json.capabilities.blocked)).toBe(true);
    expect(json.worker).toMatchObject({
      queue: expect.objectContaining({
        queueDepth: expect.any(Number),
        retrying: expect.any(Number),
        deadLetter: expect.any(Number),
      }),
      runtime: expect.objectContaining({
        alive: expect.any(Boolean),
        seen: expect.any(Boolean),
      }),
      canary: expect.objectContaining({
        seen: expect.any(Boolean),
        ok: expect.any(Boolean),
      }),
    });
    expect(json.backendReadiness).toMatchObject({
      ok: expect.any(Boolean),
      mode: expect.any(String),
      components: expect.any(Object),
      nextActions: expect.any(Array),
    });
    expect(json.backendReadiness.components).toHaveProperty("supabase");
    expect(json.backendReadiness.components).toHaveProperty("redis");
    expect(json.backendReadiness.components).toHaveProperty("worker");
    expect(json.backendReadiness.components).toHaveProperty("observability");
    expect(json.modelGateway).toMatchObject({
      total: expect.any(Number),
      completed: expect.any(Number),
      blocked: expect.any(Number),
      failed: expect.any(Number),
      skipped: expect.any(Number),
      redactions: expect.any(Number),
      latest: expect.any(Array),
    });
    expect(JSON.stringify(json)).not.toMatch(/SUPABASE_SERVICE_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/);
    expect(JSON.stringify(json)).not.toMatch(/QUAD_REDIS_REST_TOKEN|SENTRY_DSN|PHOENIX_API_KEY/);
  });

  test("returns a booth-safe sponsor proof runbook", async ({ request }) => {
    const response = await request.get("/api/sponsor/proof");

    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json).toMatchObject({
      generatedAt: expect.any(String),
      liveCount: expect.any(Number),
      total: expect.any(Number),
      safeToClaim: expect.any(Array),
      doNotClaim: expect.any(Array),
      demoRunbook: {
        headline: expect.stringContaining("Sponsor proof runbook"),
        sequence: expect.any(Array),
        judgeScript: expect.any(Array),
        boothChecklist: expect.any(Array),
      },
    });
    expect(json.demoRunbook.sequence.length).toBe(json.total);
    expect(json.demoRunbook.sequence[0]).toMatchObject({
      sponsor: "Redis",
      routeOrSurface: expect.any(String),
      safeToSay: expect.any(Boolean),
    });
    expect(JSON.stringify(json)).not.toMatch(/sk-ant-|sk-proj-|bb_live_|gQAAAA|eyJhbGciOi/);
  });

  test("runs a protected worker canary without exposing secrets", async ({ request }) => {
    const response = await request.post("/api/jobs/canary?orgId=org_brightpath");

    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.canary.job).toMatchObject({
      type: "canary",
      status: "completed",
      orgId: "org_brightpath",
      attempts: 1,
    });
    expect(json.canary.enqueuedJobId).toMatch(/^job_/);
    expect(JSON.stringify(json)).not.toMatch(/SUPABASE_SERVICE_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/);

    const health = await request.get("/api/jobs/health");
    expect(health.ok()).toBe(true);
    await expect(health.json()).resolves.toMatchObject({
      canary: {
        seen: true,
        ok: true,
      },
    });
  });

  test("refuses manual retry for queued jobs through the public api", async ({ request }) => {
    const created = await request.post("/api/jobs", {
      data: {
        orgId: "org_brightpath",
        targetUrl: "https://example.com",
        runId: `run_retry_contract_${Date.now()}`,
      },
    });

    expect(created.ok()).toBe(true);
    const createdJson = await created.json();
    const retry = await request.post(`/api/jobs/${createdJson.job.id}/retry`, {
      data: {
        reason: "contract test should not retry queued work",
      },
    });

    expect(retry.status()).toBe(409);
    const retryJson = await retry.json();
    expect(retryJson).toMatchObject({
      ok: false,
      code: "job_not_retryable",
      job: {
        id: createdJson.job.id,
        status: "queued",
      },
    });
    expect(JSON.stringify(retryJson)).not.toMatch(/SUPABASE_SERVICE_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/);
  });

  test("supports scheduled worker canary calls for cron monitors", async ({ request }) => {
    const response = await request.post("/api/jobs/canary?orgId=org_brightpath&scheduled=1&minIntervalSeconds=300");

    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json).toMatchObject({
      ok: true,
      scheduled: true,
      skipped: expect.any(Boolean),
      reason: expect.stringMatching(/ran|recent|locked/),
    });
    expect(JSON.stringify(json)).not.toMatch(/SUPABASE_SERVICE_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/);
  });

  test("exposes a cron-friendly worker canary endpoint", async ({ request }) => {
    const response = await request.get("/api/cron/worker-canary?minIntervalSeconds=300");

    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json).toMatchObject({
      ok: true,
      scheduled: true,
      skipped: expect.any(Boolean),
      reason: expect.stringMatching(/ran|recent|locked/),
    });
    expect(JSON.stringify(json)).not.toMatch(/SUPABASE_SERVICE_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/);
  });

  test("returns a 404 for unknown approval decisions", async ({ request }) => {
    const response = await request.post("/api/approvals/missing/decision", {
      data: {
        runId: `missing_${Date.now()}`,
        decision: "approved",
        approver: "demo.operator",
      },
    });

    expect(response.status()).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ ok: false, code: "run_not_found" });
  });

  test("returns a 404 for unknown dry-run publish requests", async ({ request }) => {
    const response = await request.post("/api/publish/dry-run", {
      data: {
        runId: `missing_${Date.now()}`,
        actor: "demo.operator",
      },
    });

    expect(response.status()).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ ok: false, code: "run_not_found" });
  });

  test("returns a 404 for unknown packet verification", async ({ request }) => {
    const response = await request.post("/api/quadchain/verify", {
      data: { packetId: `missing_${Date.now()}` },
    });

    expect(response.status()).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "packet not found" });
  });

  test("keeps voice transcription guarded when audio is absent", async ({ request }) => {
    const response = await request.post("/api/voice/transcribe", {
      multipart: {},
    });

    expect([400, 503]).toContain(response.status());
    const json = await response.json();
    expect(json.error).toMatch(/Deepgram is not configured|Missing audio upload/);
    expect(json).not.toHaveProperty("apiKey");
  });
});
