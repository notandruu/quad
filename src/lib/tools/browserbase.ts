import type { RenderedPageEvidence } from "@/lib/types";
import { traced, SPAN } from "@/lib/observability/phoenix";
import { captureHandled } from "@/lib/observability/sentry";
import { fetchPageEvidence } from "./fetchPage";

function isConfigured(): boolean {
  return Boolean(
    process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID
  );
}

/**
 * Render a page in a Browserbase cloud browser and extract structured
 * evidence: visible text, headings, links, buttons, images, forms, plus a
 * screenshot. Falls back to static fetch when Browserbase is unavailable or
 * the render fails, so the audit never hard-stops on one page.
 *
 * The Browserbase render body is left as a TODO: connect the SDK + a
 * Playwright/Stagehand session and fill in `extractEvidence`. The fallback
 * path is fully wired so the pipeline runs today.
 */
export async function renderPage(
  url: string
): Promise<RenderedPageEvidence> {
  return traced(SPAN.renderPage, { "page.url": url, "render.engine": isConfigured() ? "browserbase" : "static" }, async () => {
    if (!isConfigured()) {
      return fetchPageEvidence(url);
    }

    try {
      return await renderWithBrowserbase(url);
    } catch (err) {
      captureHandled(err, { toolName: "browserbase.render_page" });
      // Degrade to static fetch but keep the URL so findings stay grounded.
      return fetchPageEvidence(url);
    }
  });
}

/**
 * TODO(stephen): wire @browserbasehq/sdk + a CDP/Playwright session here.
 *   1. Create a session with BROWSERBASE_PROJECT_ID.
 *   2. Navigate, wait for network idle.
 *   3. Evaluate DOM extraction in the page context.
 *   4. Capture a screenshot, upload it, set screenshotUrl.
 *   5. Return RenderedPageEvidence.
 */
async function renderWithBrowserbase(url: string): Promise<RenderedPageEvidence> {
  throw new Error("Browserbase render not yet implemented; using static fallback");
}
