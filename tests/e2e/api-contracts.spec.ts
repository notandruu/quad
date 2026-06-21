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
    expect(JSON.stringify(json)).not.toMatch(/SUPABASE_SERVICE_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/);
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
