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

  test("queues external agent runs through the shared core facade", async ({ request }) => {
    test.skip(!process.env.QUAD_AGENT_RUN_SECRET, "agent run secret is required for external agent success path");
    const response = await request.post("/api/agent/run", {
      headers: process.env.QUAD_AGENT_RUN_SECRET
        ? { "x-quad-agent-secret": process.env.QUAD_AGENT_RUN_SECRET }
        : undefined,
      data: {
        orgId: "org_redcross",
        targetUrl: "https://quad.stephenhung.me",
        workflow: "enterprise_proof",
      },
    });

    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json).toMatchObject({
      agent: "quad",
      workflow: "enterprise_proof",
      summary: {
        status: "queued",
      },
      runtime: {
        surface: "fetch_agent",
      },
      job: {
        type: "agent_run",
        status: "queued",
      },
      quadChain: [
        {
          type: "agent_handoff",
          accepted: true,
        },
      ],
    });
    expect(JSON.stringify(json)).not.toMatch(/SUPABASE_SERVICE_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/);
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
    const response = await request.get("/api/runs?orgId=org_redcross&limit=5");

    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.runs)).toBe(true);
    expect(Array.isArray(json.pendingApprovals)).toBe(true);
    expect(JSON.stringify(json)).not.toMatch(/SUPABASE_SERVICE_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/);
  });

  test("returns the current org workspace boundary", async ({ request }) => {
    const response = await request.get("/api/orgs?orgId=org_redcross");

    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json).toMatchObject({
      ok: true,
      orgId: "org_redcross",
      current: {
        org: {
          id: "org_redcross",
          status: "active",
        },
        workspace: {
          orgId: "org_redcross",
          defaultVisibility: "company",
        },
        boundary: {
          tenantKeyPrefix: "org:org_redcross",
        },
      },
    });
    expect(JSON.stringify(json)).not.toMatch(/SUPABASE_SERVICE_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/);
  });

  test("returns a safe scoped context graph", async ({ request }) => {
    const response = await request.get("/api/brain/graph?orgId=org_redcross&limit=8");

    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json).toMatchObject({
      ok: true,
      orgId: "org_redcross",
      summary: {
        total: expect.any(Number),
        byVisibility: {
          company: expect.any(Number),
          team: expect.any(Number),
          personal: expect.any(Number),
        },
        stale: expect.any(Number),
        withPackets: expect.any(Number),
        edges: expect.any(Number),
        latest: expect.any(Array),
      },
      graph: {
        counts: expect.any(Object),
        nodes: expect.any(Array),
        edges: expect.any(Array),
      },
    });
    expect(JSON.stringify(json)).not.toMatch(/SUPABASE_SERVICE_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/);
    expect(JSON.stringify(json)).not.toMatch(/sk-ant-|sk-proj-|postgres:\/\/|service_role|bb_live_|gQAAAA/);
  });

  test("classifies context capture signals without leaking secrets", async ({ request }) => {
    const response = await request.post("/api/context/capture", {
      data: {
        orgId: "org_redcross",
        sourceName: "playwright context capture",
        events: [
          {
            id: "event_signal",
            sourceType: "meeting",
            text: "Maddy: The trust packet launch must include approved SOC 2 evidence by July 1.",
          },
          {
            id: "event_noise",
            sourceType: "meeting",
            text: "thanks",
          },
        ],
      },
    });

    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json).toMatchObject({
      ok: true,
      summary: {
        signalCount: 1,
        noiseCount: 1,
        suggestedWriteCount: 1,
      },
      proposals: [],
    });
    expect(json.capture.signals[0]).toMatchObject({
      sourceType: "meeting",
      suggestedVisibility: "company",
    });
    expect(JSON.stringify(json)).not.toMatch(/SUPABASE_SERVICE_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/);
    expect(JSON.stringify(json)).not.toMatch(/sk-ant-|sk-proj-|postgres:\/\/|service_role|bb_live_|gQAAAA/);
  });

  test("returns metaregistry runtime tool routing without leaking secrets", async ({ request }) => {
    const response = await request.get("/api/metaregistry/runtime-tools?orgId=org_redcross&intent=website_audit&surface=fetch_agent");

    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json).toMatchObject({
      ok: true,
      orgId: "org_redcross",
      plan: {
        intent: "website_audit",
        surface: "fetch_agent",
        requiredCapabilityIds: expect.arrayContaining(["browserbase.read_browser", "fetch.agent_bridge"]),
        eagerTools: expect.any(Array),
        deferredTools: expect.any(Array),
        blockedCapabilities: expect.any(Array),
      },
    });
    expect(JSON.stringify(json)).not.toMatch(/SUPABASE_SERVICE_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/);
    expect(JSON.stringify(json)).not.toMatch(/sk-ant-|sk-proj-|postgres:\/\/|service_role|bb_live_|gQAAAA/);
  });

  test("runs the scripted meeting agent into governed artifacts", async ({ request }) => {
    const response = await request.post("/api/meeting/scripted", {
      timeout: 60_000,
      data: {
        orgId: "org_redcross",
        title: "Playwright meeting proof",
        delayMs: 0,
      },
    });

    expect(response.ok()).toBe(true);
    const body = await response.text();
    const events = body
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)) as { type?: string; workflow?: Record<string, unknown>; agentverse?: Record<string, unknown> });
    const result = events.find((event) => event.type === "meeting.result");
    const agentverseCompleted = events.find((event) => event.type === "meeting.agentverse.completed");
    const workflow = result?.workflow as
      | { artifacts?: unknown[]; packets?: Array<{ accepted: boolean }> }
      | undefined;

    expect(events.some((event) => event.type === "fact.proposed")).toBe(true);
    expect(result?.workflow).toMatchObject({
      status: "needs_approval",
      approval: {
        decision: "pending",
      },
      receipt: {
        status: "blocked",
      },
    });
    expect(workflow?.artifacts?.length).toBeGreaterThanOrEqual(4);
    expect(workflow?.packets?.every((packet) => packet.accepted)).toBe(true);
    expect(agentverseCompleted).toBeTruthy();
    expect(result?.agentverse).toMatchObject({
      surface: "fetch_agent",
      workflow: "enterprise_proof",
      jobStatus: "queued",
    });
    expect(result?.agentverse?.selectedTools).toContain("fetch.agent_bridge");
  });

  test("runs shared core commands for chat and queued audit", async ({ request }) => {
    const chat = await request.post("/api/core/run", {
      data: {
        command: "chat",
        orgId: "org_redcross",
        runId: `run_core_chat_contract_${Date.now()}`,
        text: "hello quad",
        surface: "chat",
      },
    });
    expect(chat.ok()).toBe(true);
    const chatJson = await chat.json();
    expect(chatJson).toMatchObject({
      ok: true,
      command: "chat",
      intent: expect.any(String),
      quadChain: {
        accepted: true,
      },
    });

    const runId = `run_core_queue_contract_${Date.now()}`;
    const queued = await request.post("/api/core/run", {
      data: {
        command: "queue_audit",
        orgId: "org_redcross",
        runId,
        targetUrl: "https://example.com",
        surface: "dashboard",
      },
    });
    expect(queued.ok()).toBe(true);
    const queuedJson = await queued.json();
    expect(queuedJson).toMatchObject({
      ok: true,
      command: "queue_audit",
      runId,
      job: {
        type: "audit",
        status: "queued",
      },
    });
    expect(JSON.stringify({ chatJson, queuedJson })).not.toMatch(/sk-ant-|sk-proj-|postgres:\/\/|service_role|bb_live_|gQAAAA/);
  });

  test("replays the hosted task stream for a queued backend run", async ({ request }) => {
    const runId = `run_events_contract_${Date.now()}`;
    const created = await request.post("/api/jobs", {
      data: {
        orgId: "org_redcross",
        targetUrl: "https://example.com",
        runId,
      },
    });
    expect(created.ok()).toBe(true);

    const response = await request.get(`/api/runs/${runId}/events?after=0&limit=10`);
    expect(response.ok()).toBe(true);
    const json = await response.json();

    expect(json.ok).toBe(true);
    expect(json.stream.run).toMatchObject({
      id: runId,
      orgId: "org_redcross",
      status: "queued",
    });
    expect(json.stream.events.map((event: { kind: string }) => event.kind)).toContain("run.created");
    expect(json.stream.events.map((event: { kind: string }) => event.kind)).toContain("task.queued");
    expect(json.stream.cursor).toMatchObject({
      afterSequence: 0,
      latestSequence: expect.any(Number),
      limit: 10,
    });
    expect(JSON.stringify(json)).not.toMatch(/SUPABASE_SERVICE_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/);
  });

  test("returns a safe operator summary", async ({ request }) => {
    const response = await request.get("/api/operator?orgId=org_redcross&limit=5");

    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.workline).toEqual(["audit", "packet", "approval", "publish"]);
    expect(json.workspace).toMatchObject({
      org: {
        id: "org_redcross",
      },
      workspace: {
        defaultVisibility: "company",
      },
      boundary: {
        tenantKeyPrefix: "org:org_redcross",
      },
    });
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
    expect(json.evidence).toMatchObject({
      total: expect.any(Number),
      public: expect.any(Number),
      internal: expect.any(Number),
      restricted: expect.any(Number),
      byKind: expect.any(Object),
      latest: expect.any(Array),
    });
    expect(json.modelGateway).toMatchObject({
      total: expect.any(Number),
      completed: expect.any(Number),
      blocked: expect.any(Number),
      failed: expect.any(Number),
      skipped: expect.any(Number),
      redactions: expect.any(Number),
      latest: expect.any(Array),
    });
    expect(json.runtimeTraces).toMatchObject({
      total: expect.any(Number),
      completed: expect.any(Number),
      failed: expect.any(Number),
      averageDurationMs: expect.any(Number),
      latest: expect.any(Array),
    });
    expect(json.contextGraph).toMatchObject({
      total: expect.any(Number),
      byVisibility: {
        company: expect.any(Number),
        team: expect.any(Number),
        personal: expect.any(Number),
      },
      stale: expect.any(Number),
      verifiedOrApproved: expect.any(Number),
      withPackets: expect.any(Number),
      edges: expect.any(Number),
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
    const response = await request.post("/api/jobs/canary?orgId=org_redcross");

    expect(response.ok()).toBe(true);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.canary.job).toMatchObject({
      type: "canary",
      status: "completed",
      orgId: "org_redcross",
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
        orgId: "org_redcross",
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
    const response = await request.post("/api/jobs/canary?orgId=org_redcross&scheduled=1&minIntervalSeconds=300");

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
