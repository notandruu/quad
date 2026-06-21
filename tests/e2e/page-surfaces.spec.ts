import { expect, test } from "@playwright/test";

test.describe("page surfaces", () => {
  test("renders the core product pages", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Quad" })).toBeVisible();
    await expect(page.getByPlaceholder(/Ask Quad/)).toBeVisible();

    await page.goto("/quadchain");
    await expect(page.getByRole("heading", { name: "chat with the trace first" })).toBeVisible();
    await expect(page.getByText("Live trust packet")).toBeVisible();

    await page.goto("/demo");
    await expect(page.getByText("BrightPath Foundation").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Empowering Youth Through Education" })).toBeVisible();
  });

  test("renders a run trust trail on quadchain when packets exist", async ({ page, request }) => {
    const runId = `pw_surface_${Date.now()}`;
    const audit = await request.post("/api/audit/stream", {
      timeout: 60_000,
      data: {
        orgId: "org_brightpath",
        runId,
        targetUrl: "https://example.com",
        limit: 1,
      },
    });
    expect(audit.ok()).toBe(true);

    await page.goto(`/quadchain?runId=${runId}`);
    await expect(page.getByRole("heading", { name: "Run trust trail" })).toBeVisible();
    await expect(page.getByText(new RegExp(`run ${runId}`))).toBeVisible();
    await expect(page.getByText(/accepted/)).toBeVisible();
  });
});
