import { NextRequest } from "next/server";
import { ENTERPRISE_PROOF_ORG_ID } from "@/data/demo/enterprise-proof";
import { appendTaskEvent, loadRunSnapshot, saveRunSnapshot, type WorkflowTaskEventKind } from "@/lib/runs";
import {
  buildRequestFingerprint,
  checkMutationGuards,
  idempotencyReplayBody,
  mutationGuardError,
} from "@/lib/security/mutations";
import { authorizeRequest, requestAuthError } from "@/lib/security/request";
import { uploadScreenshotWithEvidence } from "@/lib/storage/screenshots";

export const runtime = "nodejs";
export const maxDuration = 120;

type BrowserbaseEvent = {
  type: string;
  label: string;
  detail: string;
  sessionId?: string;
  screenshotUrl?: string;
};

type RequestBody = {
  orgId?: string;
  question?: string;
  questionId?: string;
  answer?: string;
  index?: number;
  runId?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const orgId = body.orgId === ENTERPRISE_PROOF_ORG_ID ? body.orgId : ENTERPRISE_PROOF_ORG_ID;
  const auth = authorizeRequest({
    headers: req.headers,
    requestedOrgId: orgId,
    defaultOrgId: ENTERPRISE_PROOF_ORG_ID,
    env: orgId === ENTERPRISE_PROOF_ORG_ID ? publicEnterpriseProofDemoEnv() : undefined,
    requiredScopes: ["browser:write"],
  });
  if (!auth.ok) {
    return jsonError(requestAuthError(auth).error, auth.status, requestAuthError(auth).code);
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  const answer = typeof body.answer === "string" ? body.answer.trim() : "";
  const questionId = typeof body.questionId === "string" && body.questionId.trim() ? body.questionId.trim() : "trust_question";
  const runId = typeof body.runId === "string" && body.runId.trim() ? body.runId.trim() : `browserbase_${crypto.randomUUID()}`;
  const index = typeof body.index === "number" ? body.index : 0;
  const answerHash = stableValueHash(answer);

  if (!question || !answer) {
    return jsonError("question and answer are required", 400);
  }

  const guard = await checkMutationGuards({
    orgId: auth.orgId,
    route: "browserbase.questionnaire_step",
    headers: req.headers,
    fingerprint: buildRequestFingerprint({
      orgId: auth.orgId,
      questionId,
      answerHash,
      index,
      runId,
    }),
    limit: 10,
    windowSeconds: 60,
  });
  if (!guard.ok) {
    return jsonError(mutationGuardError(guard).error, guard.status, guard.code);
  }
  if (guard.replay) {
    return new Response(JSON.stringify(idempotencyReplayBody(guard.replay)), {
      status: guard.replay.status,
      headers: { "content-type": "application/json" },
    });
  }

  if (!process.env.BROWSERBASE_API_KEY || !process.env.BROWSERBASE_PROJECT_ID) {
    return jsonError("browserbase is not configured", 503);
  }

  const snapshot = await loadRunSnapshot(runId);
  const ledgerRunId = snapshot?.run.orgId === auth.orgId ? snapshot.run.id : null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: BrowserbaseEvent, ledger?: BrowserbaseLedgerEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        if (!ledgerRunId || !ledger) return;
        appendBrowserbaseEvent({
          runId: ledgerRunId,
          questionId,
          questionIndex: index,
          answerHash,
          answerLength: answer.length,
          event: ledger,
        });
      };

      let browser: Awaited<ReturnType<typeof import("playwright-core").chromium.connectOverCDP>> | null = null;
      try {
        const { Browserbase } = await import("@browserbasehq/sdk");
        const { chromium } = await import("playwright-core");

        send(
          { type: "browserbase.session.creating", label: "sessions.create", detail: "creating remote browserbase session" },
          {
            kind: "browser_action.session",
            message: "Browserbase session creation started.",
            detail: "creating remote browserbase session",
          }
        );
        const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
        const session = await bb.sessions.create({
          projectId: process.env.BROWSERBASE_PROJECT_ID!,
        });
        send({
          type: "browserbase.session.created",
          label: "browserbase session",
          detail: `connected remote browser · ${session.id}`,
          sessionId: session.id,
        }, {
          kind: "browser_action.session",
          message: "Browserbase session connected.",
          detail: "connected remote browser",
          sessionId: session.id,
        });

        browser = await chromium.connectOverCDP(session.connectUrl);
        const context = browser.contexts()[0] ?? (await browser.newContext());
        const page = context.pages()[0] ?? (await context.newPage());
        const vendorUrl = `data:text/html;charset=utf-8,${encodeURIComponent(buildVendorForm({ question, questionId, index }))}`;

        send({
          type: "browserbase.page.goto",
          label: "page.goto",
          detail: "trust.secureflow.com/vendor/acme/security-questionnaire",
          sessionId: session.id,
        }, {
          kind: "browser_action.session",
          message: "Browserbase loaded the controlled questionnaire page.",
          detail: "trust.secureflow.com/vendor/acme/security-questionnaire",
          sessionId: session.id,
        });
        await page.goto(vendorUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

        const selector = `[data-question-id="${cssEscape(questionId)}"] textarea`;
        send({
          type: "browserbase.field.focus",
          label: "locator.focus",
          detail: selector,
          sessionId: session.id,
        }, {
          kind: "browser_action.field",
          message: "Browserbase focused the questionnaire answer field.",
          detail: selector,
          selector,
          sessionId: session.id,
        });
        await page.locator(selector).focus({ timeout: 10_000 });

        send({
          type: "browserbase.field.fill",
          label: "locator.fill",
          detail: `filled approved answer · ${answerHash}`,
          sessionId: session.id,
        }, {
          kind: "browser_action.field",
          message: "Browserbase filled the approved questionnaire answer.",
          detail: `filled approved answer · ${answerHash}`,
          selector,
          sessionId: session.id,
        });
        await page.locator(selector).fill(answer, { timeout: 10_000 });

        await page.locator(`[data-question-id="${cssEscape(questionId)}"] [data-status]`).evaluate((el) => {
          el.textContent = "filled by quad · waiting for operator approval";
        });
        await page.waitForTimeout(350);
        const screenshot = await page.screenshot({ type: "png", fullPage: false });
        const uploaded = await uploadScreenshotWithEvidence({
          png: screenshot,
          orgId,
          runId,
          pageUrl: `browserbase://secureflow/${questionId}`,
        }).catch(() => ({
          url: `data:image/png;base64,${screenshot.toString("base64")}`,
          evidence: null,
        }));

        send({
          type: "browserbase.screenshot",
          label: "screenshot",
          detail: "captured remote browser evidence",
          sessionId: session.id,
          screenshotUrl: uploaded.url,
        }, {
          kind: "browser_action.screenshot",
          message: "Browserbase captured questionnaire screenshot evidence.",
          detail: "captured remote browser evidence",
          screenshotUrl: uploaded.url,
          sessionId: session.id,
        });
        send({
          type: "browserbase.pause_before_submit",
          label: "pause_before_submit",
          detail: "real browserbase page is filled; final submit is held for operator approval",
          sessionId: session.id,
        }, {
          kind: "browser_action.paused",
          message: "Browserbase paused before customer submission.",
          detail: "final submit is held for operator approval",
          sessionId: session.id,
        });
      } catch (err) {
        send({
          type: "browserbase.error",
          label: "browserbase.error",
          detail: err instanceof Error ? err.message : String(err),
        }, {
          kind: "browser_action.failed",
          message: "Browserbase questionnaire write failed.",
          detail: err instanceof Error ? err.message : String(err),
        });
      } finally {
        await browser?.close().catch(() => {});
        send(
          { type: "browserbase.session.closed", label: "session.close", detail: "remote browser closed" },
          {
            kind: "browser_action.session",
            message: "Browserbase session closed.",
            detail: "remote browser closed",
          }
        );
        if (ledgerRunId) await saveRunSnapshot(ledgerRunId).catch(() => {});
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

type BrowserbaseLedgerEvent = {
  kind: Extract<
    WorkflowTaskEventKind,
    "browser_action.session" | "browser_action.field" | "browser_action.screenshot" | "browser_action.paused" | "browser_action.failed"
  >;
  message: string;
  detail: string;
  selector?: string;
  sessionId?: string;
  screenshotUrl?: string;
};

function appendBrowserbaseEvent(input: {
  runId: string;
  questionId: string;
  questionIndex: number;
  answerHash: string;
  answerLength: number;
  event: BrowserbaseLedgerEvent;
}) {
  appendTaskEvent({
    runId: input.runId,
    kind: input.event.kind,
    actor: "connector",
    message: input.event.message,
    capabilityId: "browserbase.write_browser",
    status: input.event.kind === "browser_action.failed" ? "blocked" : "completed",
    payloadSummary: {
      questionId: input.questionId,
      questionIndex: input.questionIndex,
      answerHash: input.answerHash,
      answerLength: input.answerLength,
      detail: input.event.detail,
      selector: input.event.selector ?? null,
      sessionId: input.event.sessionId ?? null,
      screenshotCaptured: Boolean(input.event.screenshotUrl),
    },
  });
}

function jsonError(error: string, status: number, code?: string) {
  return new Response(JSON.stringify({ ok: false, error, code }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function stableValueHash(value: string): `fnv1a:${string}` {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function publicEnterpriseProofDemoEnv() {
  return {
    ...process.env,
    QUAD_API_SECRET: undefined,
    QUAD_SERVICE_TOKENS: undefined,
    QUAD_ALLOWED_ORGS: ENTERPRISE_PROOF_ORG_ID,
  };
}

function cssEscape(value: string) {
  return value.replace(/["\\]/g, "\\$&");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildVendorForm(input: { question: string; questionId: string; index: number }) {
  const question = escapeHtml(input.question);
  const questionId = escapeHtml(input.questionId);
  const questionNumber = input.index + 1;
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>secureflow trust portal</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: #faf8f6; color: #171217; }
      header { display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; border-bottom: 1px solid #e7e2e6; background: #fff; }
      header span { color: #a39aa0; font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .12em; text-transform: uppercase; }
      main { max-width: 860px; margin: 0 auto; padding: 34px 24px; }
      .card { border: 1px solid #e7e2e6; border-radius: 8px; background: #fff; box-shadow: 0 18px 60px rgba(22,16,22,.07); overflow: hidden; }
      .top { padding: 18px 20px; border-bottom: 1px solid #eee8ec; }
      h1 { margin: 0; font: 24px Georgia, serif; }
      p { margin: 8px 0 0; color: #6f6670; font-size: 13px; }
      label { display: block; padding: 20px; }
      label span { display: block; margin-bottom: 8px; font-size: 13px; line-height: 1.45; }
      textarea { width: 100%; min-height: 190px; box-sizing: border-box; border: 1px solid #dad3d8; border-radius: 7px; padding: 12px; font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; resize: vertical; outline: none; }
      textarea:focus { border-color: #e24ba8; box-shadow: 0 0 0 3px #fbe8f5; }
      footer { display: flex; justify-content: space-between; align-items: center; padding: 14px 20px; border-top: 1px solid #eee8ec; background: #fdfbfc; }
      [data-status] { color: #b92e82; font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; }
      button { border: 0; border-radius: 8px; background: #e24ba8; color: #fff; padding: 10px 16px; font-weight: 700; }
    </style>
  </head>
  <body>
    <header>
      <strong>SecureFlow Trust Portal</strong>
      <span>vendor · acme software</span>
    </header>
    <main>
      <section class="card">
        <div class="top">
          <h1>Vendor Security Questionnaire</h1>
          <p>SIG-lite item ${questionNumber} · controlled browser write</p>
        </div>
        <label data-question-id="${questionId}">
          <span>${questionNumber}. ${question}</span>
          <textarea aria-label="answer for question ${questionNumber}" placeholder="waiting for quad evidence…"></textarea>
          <p data-status>browserbase focused this field</p>
        </label>
        <footer>
          <span data-status>no submit until operator approval</span>
          <button type="button">submit questionnaire</button>
        </footer>
      </section>
    </main>
  </body>
</html>`;
}
