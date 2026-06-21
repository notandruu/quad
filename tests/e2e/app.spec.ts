import { expect, test } from "@playwright/test";

test.describe("quad production flows", () => {
  test("exposes backend readiness without leaking secrets", async ({ request }) => {
    const response = await request.get("/api/settings");
    expect(response.ok()).toBe(true);

    const settings = await response.json();
    expect(typeof settings.redis).toBe("boolean");
    expect(typeof settings.brain).toBe("boolean");
    expect(typeof settings.voice).toBe("boolean");
    expect(typeof settings.deepgram).toBe("boolean");
    expect(settings).not.toHaveProperty("deepgramApiKey");
    expect(settings).not.toHaveProperty("anthropicApiKey");
    expect(settings.security).toBeTruthy();
  });

  test("loads the audit workspace and debug drawer", async ({ page }) => {
    await page.goto("/app");

    await expect(page.getByRole("heading", { name: "Quad", exact: true })).toBeVisible();
    await expect(page.getByPlaceholder(/Ask Quad/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Quadchain", exact: true })).toBeVisible();

    await page.getByRole("button", { name: /Backends/ }).click();
    await expect(page.getByText("Stack status")).toBeVisible();
    await expect(page.getByText("Runtime routing")).toBeVisible();
    await expect(page.getByText("Hot", { exact: true })).toBeVisible();
    await expect(page.getByText("Deferred", { exact: true })).toBeVisible();
    await expect(page.getByText("Blocked", { exact: true })).toBeVisible();
    await expect(page.getByText(/Voice:/)).toBeVisible();
  });

  test("reveals quadchain wrapped proof after three chat turns", async ({ page }) => {
    await page.goto("/quadchain");

    await expect(page.getByRole("heading", { name: "chat with the trace first" })).toBeVisible();
    await expect(page.getByText("0/3 turns before reveal")).toBeVisible();

    await page.getByRole("button", { name: "audit this oauth trace and keep the smallest safe fix" }).click();
    await expect(page.getByText("1/3 turns before reveal")).toBeVisible();

    await page.getByRole("button", { name: "show me what would get lost without quadchain" }).click();
    await expect(page.getByText("2/3 turns before reveal")).toBeVisible();

    await page.getByRole("button", { name: "now reveal the proof packet" }).click();

    await expect(page.getByText("your context diet")).toBeVisible();
    await expect(page.getByText("proof verdict")).toBeVisible();
    await expect(page.getByText(/qchain_/).first()).toBeVisible();
    await expect(page.locator("body")).toContainText("Evidence extraction");
    await expect(page.locator("body")).toContainText("Hash binding");
  });

  test("returns a verified quadchain comparison contract", async ({ request }) => {
    const response = await request.post("/api/quadchain/compare", {
      data: {
        prompt: "audit this oauth trace and keep the smallest safe fix",
        rawTrace: [
          "critical evidence: oauth callback returns 500 when code is missing",
          "policy: preserve least privilege oauth scopes",
          "debug: retry count 3",
          "concept: oauth evidence",
        ].join("\n"),
      },
    });

    expect(response.ok()).toBe(true);
    const comparison = await response.json();
    expect(comparison.withQuadChain.accepted).toBe(true);
    expect(comparison.withQuadChain.certificateId).toMatch(/^qchain_/);
    expect(comparison.mechanisticTrace).toHaveLength(4);
    expect(comparison.mechanisticTrace.map((step: { label: string }) => step.label)).toEqual([
      "Evidence extraction",
      "Compression",
      "Hash binding",
      "Verifier",
    ]);
  });

  test("streams an audit report over sse and surfaces the trust trail", async ({ page, request }) => {
    const runId = `pw_${Date.now()}`;
    const response = await request.post("/api/audit/stream", {
      timeout: 60_000,
      data: {
        orgId: "org_redcross",
        runId,
        targetUrl: "https://example.com",
        limit: 1,
      },
    });

    expect(response.ok()).toBe(true);
    const body = await response.text();
    const events = body
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)) as { type?: string });

    expect(events.some((event) => event.type === "run.created")).toBe(true);
    expect(events.some((event) => event.type === "audit.report")).toBe(true);

    const packets = await request.get(`/api/quadchain/packets?runId=${runId}`);
    expect(packets.ok()).toBe(true);
    const packetJson = await packets.json();
    expect(packetJson.summary.total).toBeGreaterThan(0);
    expect(packetJson.packets.some((packet: { type: string }) => packet.type === "agent_handoff")).toBe(true);
    expect(packetJson.packets.some((packet: { type: string }) => packet.type === "audit_report")).toBe(true);

    const trustPacket = await request.post("/api/trust-packet", {
      data: {
        orgId: "org_redcross",
        runId,
      },
    });
    expect(trustPacket.ok()).toBe(true);
    const trustPacketJson = await trustPacket.json();
    expect(trustPacketJson.ok).toBe(true);
    expect(trustPacketJson.packet.type).toBe("trust_packet");
    expect(trustPacketJson.task.approvals).toHaveLength(1);
    expect(trustPacketJson.workflow.receiptPreview.status).toMatch(/ready_for_approval|blocked/);

    const trustPackets = await request.get(`/api/quadchain/packets?runId=${runId}&type=trust_packet`);
    expect(trustPackets.ok()).toBe(true);
    const trustPacketsJson = await trustPackets.json();
    expect(trustPacketsJson.packets.some((packet: { type: string }) => packet.type === "trust_packet")).toBe(true);

    await page.goto(`/quadchain?runId=${runId}`);
    await expect(page.getByRole("heading", { name: "Run trust trail" })).toBeVisible();
    await expect(page.getByText(new RegExp(`run ${runId}`))).toBeVisible();
  });
});
