import { expect, test, type Page } from "@playwright/test";

const runId = "pw_ui_trust_packet";

const report = {
  runId,
  orgId: "org_redcross",
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
    let approvalDecisionBody: Record<string, unknown> | null = null;
    let dryRunPublishBody: Record<string, unknown> | null = null;
    let executePublishBody: Record<string, unknown> | null = null;
    let verifyFixBody: Record<string, unknown> | null = null;
    let installRequestBody: Record<string, unknown> | null = null;
    await mockDashboardBackends(page, async (body) => {
      trustPacketBody = body;
    }, async (body) => {
      approvalDecisionBody = body;
    }, async (body) => {
      dryRunPublishBody = body;
    }, async (body) => {
      executePublishBody = body;
    }, async (body) => {
      verifyFixBody = body;
    }, async (body) => {
      installRequestBody = body;
    });

    await page.goto("/app");
    await page.getByPlaceholder(/Ask Quad/).fill("start an audit https://example.com");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: "Operator console" })).toBeVisible();
    await expect(page.getByText("audit --> packet --> approval --> publish")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Backend readiness" })).toBeVisible();
    await expect(page.getByText("8/8 systems ready")).toBeVisible();
    await expect(page.getByText("production ready")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quadchain trust trail" })).toBeVisible();
    await expect(page.getByText("2/2 accepted")).toBeVisible();
    await expect(page.getByText("agent handoff")).toBeVisible();
    await expect(page.getByText("Artifact sidecar")).toBeVisible();
    await expect(page.getByRole("button", { name: "preview", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "proof", exact: true })).toBeVisible();
    await expect(page.getByText("ready receipts")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Approval queue" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Capability registry" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Starter install plan" })).toBeVisible();
    await expect(page.getByText("dry run")).toBeVisible();
    await expect(page.getByText(/missing env: CMS_API_KEY/)).toBeVisible();
    await page.getByRole("button", { name: "Request install" }).click();
    await expect(page.getByRole("button", { name: "Install requested" })).toBeVisible();
    expect(installRequestBody).toMatchObject({
      orgId: "org_redcross",
      actor: "demo.operator",
      includeWriteTools: true,
    });
    await expect(page.getByRole("heading", { name: "Task stream" })).toBeVisible();
    await expect(page.getByText("approval.decided")).toBeVisible();
    await expect(page.getByRole("link", { name: /task\.blocked.*cms\.publisher/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trust trail", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trust packet", exact: true })).toBeVisible();
    await expect(page.getByText("Missing security proof", { exact: true })).toBeVisible();

    const operatorConsole = page.locator("section").filter({ has: page.getByRole("heading", { name: "Operator console" }) });
    await operatorConsole.getByRole("button", { name: "Approve packet", exact: true }).click();
    await expect(operatorConsole.getByText("No pending approvals.")).toBeVisible();
    expect(approvalDecisionBody).toMatchObject({
      runId: `trust_${runId}`,
      decision: "approved",
      approver: "demo.operator",
    });
    await operatorConsole.getByRole("button", { name: "Stage fix", exact: true }).click();
    await expect(operatorConsole.getByText("Fix staged")).toBeVisible();
    await expect(page.getByText("Cms proof block draft")).toBeVisible();
    expect(dryRunPublishBody).toMatchObject({
      runId: `trust_${runId}`,
      actor: "demo.operator",
    });
    await operatorConsole.getByRole("button", { name: "Execute fix", exact: true }).click();
    await expect(operatorConsole.getByText("Fix executed")).toBeVisible();
    await expect(page.getByText("Execution: Cms proof block draft")).toBeVisible();
    await expect(operatorConsole.getByRole("link", { name: /Browser field.*Browserbase filled.*browserbase\.write_browser/ })).toBeVisible();
    await expect(operatorConsole.getByText("Browser screenshot")).toBeVisible();
    await expect(operatorConsole.getByText("Browser pause")).toBeVisible();
    await expect(operatorConsole.getByRole("heading", { name: "Outcome summary" })).toBeVisible();
    await expect(operatorConsole.getByText("not submitted")).toBeVisible();
    await expect(operatorConsole.getByText("Before capture")).toBeVisible();
    await expect(operatorConsole.getByText("After capture")).toBeVisible();
    await expect(operatorConsole.getByText("quad.post_ship_verifier")).toBeVisible();
    await expect(operatorConsole.getByText(/Human must review/)).toBeVisible();
    expect(executePublishBody).toMatchObject({
      runId: `trust_${runId}`,
      actor: "demo.operator",
    });
    await operatorConsole.getByRole("button", { name: "Verify fix", exact: true }).click();
    await expect(operatorConsole.getByText("Fix verified")).toBeVisible();
    await expect(operatorConsole.getByRole("heading", { name: "Verification report" })).toBeVisible();
    expect(verifyFixBody).toMatchObject({
      runId: `trust_${runId}`,
      actor: "demo.operator",
    });

    await page.getByRole("button", { name: "Build packet" }).click();

    await expect(page.getByText("Ready for approval", { exact: true })).toBeVisible();
    await expect(page.getByText("qchain_ui_packet")).toBeVisible();
    await expect(page.getByText("Review finding evidence")).toBeVisible();
    await expect(page.getByRole("button", { name: "Rebuild" })).toBeVisible();
    expect(trustPacketBody).toMatchObject({ runId, orgId: "org_redcross" });
  });
});

async function mockDashboardBackends(
  page: Page,
  onTrustPacket: (body: Record<string, unknown>) => void | Promise<void>,
  onApprovalDecision?: (body: Record<string, unknown>) => void | Promise<void>,
  onDryRunPublish?: (body: Record<string, unknown>) => void | Promise<void>,
  onExecutePublish?: (body: Record<string, unknown>) => void | Promise<void>,
  onVerifyFix?: (body: Record<string, unknown>) => void | Promise<void>,
  onInstallRequest?: (body: Record<string, unknown>) => void | Promise<void>
) {
  let approvalDecision: "pending" | "approved" = "pending";
  let publishStaged = false;
  let publishExecuted = false;
  let fixVerified = false;
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

  await page.route("**/api/operator?**", async (route) => {
    const pendingApprovals = approvalDecision === "pending"
      ? [
          {
            id: "approval_ui_1",
            runId: `trust_${runId}`,
            runTitle: "Enterprise proof trust packet",
            decision: "pending",
            reason: "Trust packet is ready for approval with a verifiable quad chain certificate.",
            evidenceVisible: true,
            targetUrl: "https://example.com",
          },
        ]
      : [];

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        orgId: "org_redcross",
        workline: ["audit", "packet", "approval", "publish"],
        runs: [
          {
            runId: `trust_${runId}`,
            status: approvalDecision === "approved" ? "completed" : "needs_approval",
            title: "Enterprise proof trust packet",
            targetUrl: "https://example.com",
            artifacts: [
              ...(publishStaged
                ? [
                    {
                      id: "artifact_publish_ui",
                      kind: "cms_draft",
                      title: "Cms proof block draft",
                      hash: "fnv1a:stage1234",
                    },
                  ]
                : []),
              ...(publishExecuted
                ? [
                    {
                      id: "artifact_execute_ui",
                      kind: "connector_execution",
                      title: "Execution: Cms proof block draft",
                      hash: "fnv1a:execute1234",
                    },
                  ]
                : []),
              ...(fixVerified
                ? [
                    {
                      id: "artifact_verify_ui",
                      kind: "verification_report",
                      title: "Verification report",
                      hash: "fnv1a:verify1234",
                    },
                  ]
                : []),
            ],
            approvals: [
              {
                id: "approval_ui_1",
                decision: approvalDecision,
                reason: "Trust packet is ready for approval with a verifiable quad chain certificate.",
                evidenceVisible: true,
              },
            ],
            receipts: [
              {
                id: publishStaged ? "receipt_ui_publish" : "receipt_ui_1",
                status: "ready",
                summary: publishStaged
                  ? "Cms proof block draft staged in dry-run mode."
                  : "Trust packet is ready for approval with a verifiable quad chain certificate.",
                artifactHash: publishStaged ? "fnv1a:stage1234" : "fnv1a:12345678",
              },
              ...(publishExecuted
                ? [
                    {
                      id: "receipt_ui_execute",
                      status: "executed",
                      summary: "Cms proof block draft executed after approval.",
                      artifactHash: "fnv1a:execute1234",
                    },
                  ]
                : []),
            ],
            taskEvents: [
              {
                id: "event_ui_created",
                sequence: 1,
                kind: "run.created",
                actor: "dashboard",
                message: "Enterprise proof trust packet created.",
                createdAt: "2026-06-21T00:00:00.000Z",
                status: "queued",
              },
              {
                id: "event_ui_approval",
                sequence: 2,
                kind: "approval.decided",
                actor: "human",
                message: "Approval approved by demo.operator.",
                createdAt: "2026-06-21T00:00:03.000Z",
                approvalId: "approval_ui_1",
                status: approvalDecision,
              },
              {
                id: "event_ui_publish",
                sequence: 3,
                kind: publishStaged ? "task.completed" : "task.blocked",
                actor: "connector",
                message: publishStaged
                  ? "Stage cms proof block: Dry-run artifact staged. No customer-facing write was executed."
                  : "Stage cms proof block: Capability is not allowlisted for this org.",
                createdAt: "2026-06-21T00:00:04.000Z",
                taskId: "task_ui_publish",
                capabilityId: "cms.publisher",
                status: publishStaged ? "completed" : "blocked",
              },
              ...(publishExecuted
                ? [
                    {
                      id: "event_ui_execute",
                      sequence: 4,
                      kind: "task.completed",
                      actor: "connector",
                      message: "Execute Cms proof block draft: Approved connector draft executed into a customer-write artifact receipt.",
                      createdAt: "2026-06-21T00:00:05.000Z",
                      taskId: "task_ui_execute",
                      capabilityId: "cms.publisher",
                      status: "completed",
                    },
                    {
                      id: "event_ui_browser_focus",
                      sequence: 5,
                      kind: "browser_action.field",
                      actor: "connector",
                      message: "Browserbase focused the questionnaire answer field.",
                      createdAt: "2026-06-21T00:00:06.000Z",
                      taskId: "task_ui_execute",
                      capabilityId: "browserbase.write_browser",
                      status: "completed",
                    },
                    {
                      id: "event_ui_browser_fill",
                      sequence: 6,
                      kind: "browser_action.field",
                      actor: "connector",
                      message: "Browserbase filled the approved questionnaire answer.",
                      createdAt: "2026-06-21T00:00:07.000Z",
                      taskId: "task_ui_execute",
                      capabilityId: "browserbase.write_browser",
                      status: "completed",
                    },
                    {
                      id: "event_ui_browser_screenshot",
                      sequence: 7,
                      kind: "browser_action.screenshot",
                      actor: "connector",
                      message: "Browserbase captured questionnaire screenshot evidence.",
                      createdAt: "2026-06-21T00:00:08.000Z",
                      taskId: "task_ui_execute",
                      capabilityId: "browserbase.write_browser",
                      status: "completed",
                    },
                    {
                      id: "event_ui_browser_pause",
                      sequence: 8,
                      kind: "browser_action.paused",
                      actor: "connector",
                      message: "Browserbase paused before customer submission.",
                      createdAt: "2026-06-21T00:00:09.000Z",
                      taskId: "task_ui_execute",
                      capabilityId: "browserbase.write_browser",
                      status: "paused",
                    },
                  ]
                : []),
            ],
            nextAction: "Human approval required before customer-facing work can ship.",
          },
        ],
        shipTrails: {
          [`trust_${runId}`]: [
            shipStep("audit", "Audit", "complete"),
            shipStep("packet", "Packet", "complete"),
            shipStep("approval", "Approval", approvalDecision === "approved" ? "complete" : "active"),
            shipStep("publish", "Publish", publishExecuted || publishStaged ? "complete" : approvalDecision === "approved" ? "active" : "pending"),
            shipStep("verify", "Verify", fixVerified ? "complete" : publishExecuted ? "active" : "pending"),
          ],
        },
        artifacts: publishStaged
          ? [
              {
                id: fixVerified ? "artifact_verify_ui" : publishExecuted ? "artifact_execute_ui" : "artifact_publish_ui",
                runId: `trust_${runId}`,
                title: fixVerified ? "Verification report" : publishExecuted ? "Execution: Cms proof block draft" : "Cms proof block draft",
                kind: fixVerified ? "verification_report" : publishExecuted ? "connector_execution" : "cms_draft",
                status: fixVerified || publishExecuted ? "executed" : "ready",
                headline: fixVerified
                  ? "Post-ship verification passed for staged connector artifacts."
                  : publishExecuted
                    ? "Approved connector execution recorded with rollback and verification proof."
                    : "Dry-run publisher artifact staged. No customer-facing write was executed.",
                outcome: publishExecuted
                  ? {
                      summary: "Approved connector execution completed and a controlled Browserbase form-fill proof was captured before submit.",
                      status: fixVerified ? "verified" : "executed",
                      submitted: false,
                      target: {
                        connectorId: "cms.publisher",
                        destination: "website_cms",
                        selector: "[data-quad-proof-block]",
                        url: "https://example.com",
                      },
                      evidence: [
                        {
                          label: "Before capture",
                          storageMode: "external_provider",
                          hash: "fnv1a:before1234",
                          storageKey: "trust_pw_ui_trust_packet/artifact_publish_ui/browser-before.json",
                          sourceUrl: "https://example.com",
                        },
                        {
                          label: "After capture",
                          storageMode: "external_provider",
                          hash: "fnv1a:after1234",
                          storageKey: "trust_pw_ui_trust_packet/artifact_publish_ui/browser-after.json",
                          sourceUrl: "https://example.com",
                        },
                      ],
                      fields: [
                        {
                          label: "section title",
                          selector: "[data-quad-proof-block] [data-field='title']",
                          valueHash: "fnv1a:title1234",
                        },
                        {
                          label: "section body",
                          selector: "[data-quad-proof-block] [data-field='body']",
                          valueHash: "fnv1a:body1234",
                        },
                      ],
                      rollback: ["restore previous cms section at [data-quad-proof-block]"],
                      verifier: {
                        required: true,
                        name: "quad.post_ship_verifier",
                        checks: ["source draft still exists", "execution receipt exists", "proof binding preserved"],
                      },
                      openObligations: ["Human must review the filled browser session before final submit."],
                    }
                  : null,
                preview: {
                  label: fixVerified ? "Verification artifact" : publishExecuted ? "Connector execution" : "Publisher artifact",
                  primaryMetric: fixVerified ? "pass" : publishExecuted ? "executed" : "dry",
                  primaryLabel: fixVerified ? "status" : publishExecuted ? "receipt" : "run mode",
                  secondaryMetric: fixVerified ? "3" : publishExecuted ? "cms.publisher" : "cms draft",
                  secondaryLabel: fixVerified ? "checks" : "connector",
                  risk: fixVerified ? "verified" : publishExecuted ? "approved execution" : "staged only",
                },
                proof: [
                  {
                    id: fixVerified ? "receipt_ui_verify" : publishExecuted ? "receipt_ui_execute" : "receipt_ui_publish",
                    status: fixVerified || publishExecuted ? "executed" : "ready",
                    summary: fixVerified
                      ? "Cms proof block draft passed post-ship verification."
                      : publishExecuted
                        ? "Cms proof block draft executed after approval."
                      : "Cms proof block draft staged in dry-run mode.",
                    artifactHash: fixVerified ? "fnv1a:verify1234" : publishExecuted ? "fnv1a:execute1234" : "fnv1a:stage1234",
                  },
                ],
              },
            ]
          : [
              {
                id: `artifact_trust_${runId}`,
                runId: `trust_${runId}`,
                title: "Enterprise proof trust packet",
                kind: "run_snapshot",
                status: "needs_approval",
                headline: "Human approval required before customer-facing work can ship.",
                preview: {
                  label: "Run artifact",
                  primaryMetric: "1/1",
                  primaryLabel: "ready receipts",
                  secondaryMetric: "1",
                  secondaryLabel: "approvals",
                  risk: "human gate",
                },
                proof: [
                  {
                    id: "receipt_ui_1",
                    status: "ready",
                    summary: "Trust packet is ready for approval with a verifiable quad chain certificate.",
                    artifactHash: "fnv1a:12345678",
                  },
                ],
              },
            ],
        pendingApprovals,
        capabilities: {
          active: [
            {
              id: "quad.chain_verifier",
              name: "Quad chain verifier",
              kind: "verifier",
              approvalMode: "none",
              sponsor: undefined,
            },
            {
              id: "fetch.agent_bridge",
              name: "Fetch agent bridge",
              kind: "surface",
              approvalMode: "none",
              sponsor: "Fetch.ai",
            },
          ],
          blocked: [
            {
              id: "cms.publisher",
              status: "unavailable",
              reason: "Capability is available in the registry but not enabled by default.",
              missingEnv: ["CMS_API_KEY"],
            },
          ],
          starterBundle: ["quad.chain_verifier", "fetch.agent_bridge"],
        },
        backendReadiness: {
          ok: true,
          mode: "production_ready",
          generatedAt: "2026-06-21T00:00:00.000Z",
          nextActions: [],
          components: {
            supabase: {
              status: "ready",
              configured: true,
              detail: "Supabase is configured and all platform tables responded.",
            },
            redis: {
              status: "ready",
              configured: true,
              detail: "Redis is reachable for events, queue state, and packet cache.",
            },
            auth: {
              status: "ready",
              configured: true,
              detail: "Hosted API secret is configured.",
            },
            serviceTokens: {
              status: "ready",
              configured: true,
              detail: "Scoped service tokens are configured for 1 runtime.",
            },
            encryption: {
              status: "ready",
              configured: true,
              detail: "Connector credential encryption key is configured.",
            },
            observability: {
              status: "ready",
              configured: true,
              detail: "Sentry and Phoenix are configured.",
            },
            voice: {
              status: "ready",
              configured: true,
              detail: "A voice backend is configured.",
            },
            worker: {
              status: "ready",
              configured: true,
              detail: "Backend worker is heartbeating.",
            },
          },
        },
        quadChain: {
          total: 2,
          accepted: 2,
          rejected: 0,
          tokensSaved: 42,
          evidencePreserved: 1,
          evidenceRequired: 1,
          latest: [
            {
              id: "qpacket_ui_handoff",
              type: "agent_handoff",
              runId,
              certificateId: "qchain_ui_handoff",
              accepted: true,
              failures: [],
              evidencePreserved: 0,
              evidenceRequired: 0,
              tokensSaved: 12,
              visibility: "internal",
              createdAt: "2026-06-21T00:00:01.000Z",
            },
            {
              id: "qpacket_ui_trust",
              type: "trust_packet",
              runId: `trust_${runId}`,
              certificateId: "qchain_ui_trust",
              accepted: true,
              failures: [],
              evidencePreserved: 1,
              evidenceRequired: 1,
              tokensSaved: 30,
              visibility: "internal",
              createdAt: "2026-06-21T00:00:02.000Z",
            },
          ],
        },
      }),
    });
  });

  await page.route("**/api/metaregistry/install-plan?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        orgId: "org_redcross",
        plan: {
          bundleId: "enterprise_proof_starter",
          knownIds: ["quad.chain_verifier", "trust_packet.exporter", "cms.publisher", "task.publisher"],
          unknownIds: [],
          alreadyActive: ["quad.chain_verifier", "trust_packet.exporter"],
          newlyAllowlisted: ["cms.publisher", "task.publisher"],
          newlyForceInstalled: ["cms.publisher", "task.publisher"],
          envRequired: [
            { id: "cms.publisher", missingEnv: ["CMS_API_KEY"] },
            { id: "task.publisher", missingEnv: ["LINEAR_API_KEY"] },
          ],
          blockedAfterInstall: [
            { id: "cms.publisher", reason: "Missing CMS_API_KEY.", missingEnv: ["CMS_API_KEY"] },
            { id: "task.publisher", reason: "Missing LINEAR_API_KEY.", missingEnv: ["LINEAR_API_KEY"] },
          ],
          activeAfterInstall: [
            { id: "quad.chain_verifier", name: "Quad chain verifier", kind: "verifier" },
            { id: "trust_packet.exporter", name: "Trust packet exporter", kind: "publisher" },
          ],
        },
      }),
    });
  });

  await page.route("**/api/metaregistry/install-request", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await onInstallRequest?.(body);

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        runId: "run_install_ui",
        approvalId: "approval_install_ui",
        task: {
          runId: "run_install_ui",
          status: "needs_approval",
          title: "Capability install request",
          approvals: [
            {
              id: "approval_install_ui",
              decision: "pending",
              reason: "Review capability blockers before enabling this bundle.",
              evidenceVisible: true,
            },
          ],
          artifacts: [],
          receipts: [],
          taskEvents: [],
          nextAction: "Human approval required before customer-facing work can ship.",
        },
        plan: {
          bundleId: "enterprise_proof_starter",
          requestedIds: ["cms.publisher"],
          knownIds: ["cms.publisher"],
          unknownIds: [],
        },
      }),
    });
  });

  await page.route("**/api/approvals/*/decision", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await onApprovalDecision?.(body);
    approvalDecision = body.decision === "approved" ? "approved" : "pending";

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        approval: {
          id: "approval_ui_1",
          decision: approvalDecision,
          decidedAt: "2026-06-21T00:00:03.000Z",
          approver: "demo.operator",
        },
        receipt: {
          id: "receipt_ui_decision",
          status: "executed",
          summary: "Human approval recorded. The packet is cleared for staged publisher work.",
          artifactHash: "fnv1a:87654321",
        },
        packet: {
          id: "packet_ui_approval",
          type: "approval",
          certificateId: "qchain_ui_approval",
          accepted: true,
          tokensSaved: 0,
          evidencePreserved: 0,
          evidenceRequired: 0,
          createdAt: "2026-06-21T00:00:03.000Z",
        },
      }),
    });
  });

  await page.route("**/api/publish/dry-run", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await onDryRunPublish?.(body);
    publishStaged = true;

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        staged: [
          {
            artifact: {
              id: "artifact_publish_ui",
              kind: "cms_draft",
              title: "Cms proof block draft",
              hash: "fnv1a:stage1234",
            },
            receiptId: "receipt_ui_publish",
            packet: {
              id: "packet_ui_publish",
              type: "connector_action",
              certificateId: "qchain_ui_publish",
              accepted: true,
              tokensSaved: 0,
              evidencePreserved: 1,
              evidenceRequired: 1,
              createdAt: "2026-06-21T00:00:04.000Z",
            },
          },
        ],
      }),
    });
  });

  await page.route("**/api/publish/execute", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await onExecutePublish?.(body);
    publishExecuted = true;

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        executed: [
          {
            sourceDraft: {
              id: "artifact_publish_ui",
              kind: "cms_draft",
              title: "Cms proof block draft",
              hash: "fnv1a:stage1234",
            },
            artifact: {
              id: "artifact_execute_ui",
              kind: "connector_execution",
              title: "Execution: Cms proof block draft",
              hash: "fnv1a:execute1234",
            },
            receiptId: "receipt_ui_execute",
            packet: {
              id: "packet_ui_execute",
              type: "connector_action",
              certificateId: "qchain_ui_execute",
              accepted: true,
              tokensSaved: 0,
              evidencePreserved: 2,
              evidenceRequired: 2,
              createdAt: "2026-06-21T00:00:05.000Z",
            },
          },
        ],
      }),
    });
  });

  await page.route("**/api/verify-fix", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await onVerifyFix?.(body);
    fixVerified = true;

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        status: "passed",
        items: [
          {
            artifactId: "artifact_publish_ui",
            artifactKind: "cms_draft",
            title: "Cms proof block draft",
            status: "passed",
            checks: [],
          },
        ],
        task: {
          runId: `trust_${runId}`,
          status: "completed",
          artifacts: [
            {
              id: "artifact_verify_ui",
              kind: "verification_report",
              title: "Verification report",
              hash: "fnv1a:verify1234",
            },
          ],
        },
        packets: [],
      }),
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

function shipStep(
  id: "audit" | "packet" | "approval" | "publish" | "verify",
  label: string,
  status: "pending" | "active" | "blocked" | "complete"
) {
  return {
    id,
    label,
    status,
    summary: `${label} ${status}`,
    href: `/api/runs/trust_${runId}`,
    createdAt: "2026-06-21T00:00:00.000Z",
  };
}
