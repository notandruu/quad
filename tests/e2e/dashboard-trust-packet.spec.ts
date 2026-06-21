import { expect, test, type Page } from "@playwright/test";

const runId = "pw_ui_trust_packet";

const report = {
  runId,
  orgId: "org_brightpath",
  targetUrl: "https://example.com",
  summary: "Example.com is missing buyer-ready trust proof.",
  topFindings: [
    {
      id: "finding_ui_1",
      runId,
      pageUrl: "https://example.com",
      title: "Missing security proof",
      category: "missing_trust_signal",
      severity: "high",
      confidence: 0.92,
      evidence: {
        quote: "Example Domain",
        selector: "h1",
        screenshotUrl: "/screenshots/example.png",
        sourceType: "browser",
      },
      reasoning: "The page has no enterprise security statement.",
      businessImpact: "A buyer cannot verify the company posture from the public site.",
      recommendedFix: "Add a concise security proof block with controls and owner.",
      sourceComparison: {
        internalClaim: "Security posture is ready for buyers.",
        externalClaim: "The website does not show security proof.",
      },
      eval: {
        grounded: true,
        useful: true,
        duplicate: false,
        hallucinationRisk: "low",
      },
    },
  ],
  allFindings: [],
  recommendedActions: [],
  metrics: {
    pagesAnalyzed: 1,
    findingsShown: 1,
    findingsFiltered: 0,
    averageConfidence: 0.92,
  },
};

test.describe("dashboard trust packet flow", () => {
  test("turns a completed audit into an approval-ready trust packet", async ({ page }) => {
    let trustPacketBody: Record<string, unknown> | null = null;
    await mockDashboardBackends(page, async (body) => {
      trustPacketBody = body;
    });

    await page.goto("/");
    await page.getByPlaceholder(/Ask Quad/).fill("start an audit https://example.com");
    await page.getByRole("button", { name: "Send" }).click();

    await expect(page.getByRole("heading", { name: "Trust trail" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trust packet" })).toBeVisible();
    await expect(page.getByText("Missing security proof", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Build packet" }).click();

    await expect(page.getByText("Ready for approval", { exact: true })).toBeVisible();
    await expect(page.getByText("qchain_ui_packet")).toBeVisible();
    await expect(page.getByText("Review finding evidence")).toBeVisible();
    await expect(page.getByRole("button", { name: "Rebuild" })).toBeVisible();
    expect(trustPacketBody).toMatchObject({ runId, orgId: "org_brightpath" });
  });
});

async function mockDashboardBackends(
  page: Page,
  onTrustPacket: (body: Record<string, unknown>) => void | Promise<void>
) {
  await page.route("**/api/settings", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        redis: true,
        brain: true,
        voice: true,
        deepgram: true,
        security: { ok: true },
      }),
    });
  });

  await page.route("**/api/audit/stream", async (route) => {
    const body = [
      sse({ type: "run.created", runId, targetUrl: report.targetUrl }),
      sse({ type: "page.rendered", sequence: 1, payload: { url: report.targetUrl } }),
      sse({ type: "finding.created", sequence: 2, payload: { findingId: "finding_ui_1" } }),
      sse({ type: "audit.report", report }),
    ].join("");

    await route.fulfill({
      contentType: "text/event-stream",
      body,
    });
  });

  await page.route("**/api/quadchain/packets?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        summary: {
          total: 3,
          accepted: 3,
          rejected: 0,
          tokensSaved: 420,
          evidencePreserved: 2,
          evidenceRequired: 2,
          latest: [],
        },
        packets: [
          {
            id: "packet_ui_report",
            type: "audit_report",
            certificateId: "qchain_ui_report",
            accepted: true,
            tokensSaved: 210,
            evidencePreserved: 1,
            evidenceRequired: 1,
            createdAt: "2026-06-21T00:00:00.000Z",
          },
          {
            id: "packet_ui_finding",
            type: "finding",
            certificateId: "qchain_ui_finding",
            accepted: true,
            tokensSaved: 210,
            evidencePreserved: 1,
            evidenceRequired: 1,
            createdAt: "2026-06-21T00:00:00.000Z",
          },
        ],
      }),
    });
  });

  await page.route("**/api/trust-packet", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await onTrustPacket(body);

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        packet: {
          id: "packet_ui_trust",
          type: "trust_packet",
          certificateId: "qchain_ui_packet",
          accepted: true,
          tokensSaved: 867,
          evidencePreserved: 2,
          evidenceRequired: 2,
          createdAt: "2026-06-21T00:00:00.000Z",
        },
        task: {
          runId: `trust_${runId}`,
          status: "needs_approval",
          nextAction: "Human approval required before customer-facing work can ship.",
          approvals: [
            {
              id: "approval_ui_1",
              decision: "pending",
              reason: "Trust packet is ready for approval with a verifiable quad chain certificate.",
              evidenceVisible: true,
            },
          ],
          receipts: [
            {
              id: "receipt_ui_1",
              status: "ready",
              summary: "Trust packet is ready for approval with a verifiable quad chain certificate.",
              artifactHash: "fnv1a:12345678",
            },
          ],
        },
        workflow: {
          workflowId: `fde_${runId}`,
          title: "Enterprise proof trust packet",
          receiptPreview: {
            id: `receipt_${runId}`,
            status: "ready_for_approval",
            summary: "Trust packet is ready for approval with a verifiable quad chain certificate.",
          },
          steps: [
            {
              id: "quad.audit.review_findings",
              title: "Review finding evidence",
              status: "ready",
              owner: "quad",
              detail: "1 finding artifact is ready for packet assembly.",
            },
            {
              id: "quad.chain.attach_certificate",
              title: "Attach quad chain certificate",
              status: "ready",
              owner: "quad",
              detail: "Proof-carrying compressed context is attached to the handoff.",
            },
          ],
          openObligations: [],
        },
      }),
    });
  });
}

function sse(payload: unknown) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}
