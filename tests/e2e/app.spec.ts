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
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Quad" })).toBeVisible();
    await expect(page.getByPlaceholder(/Ask Quad/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Quadchain" })).toBeVisible();

    await page.getByRole("button", { name: /Backends/ }).click();
    await expect(page.getByText("Stack status")).toBeVisible();
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

    await expect(page.getByRole("heading", { name: "Mechanistic verifier trace" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Without quadchain" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "With quadchain" })).toBeVisible();
    await expect(page.getByText(/certificate qchain_/)).toBeVisible();
    await expect(page.getByText("Evidence extraction")).toBeVisible();
    await expect(page.getByText("Hash binding")).toBeVisible();
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

  test("streams an audit report over sse", async ({ request }) => {
    const response = await request.post("/api/audit/stream", {
      timeout: 60_000,
      data: {
        orgId: "org_brightpath",
        runId: `pw_${Date.now()}`,
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
  });
});
