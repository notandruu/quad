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
 * Render a page in a Browserbase cloud browser via Playwright over CDP, then
 * extract structured evidence and a screenshot. Each call uses a fresh session
 * and tears it down in a finally block so we never leak browser minutes.
 */
async function renderWithBrowserbase(url: string): Promise<RenderedPageEvidence> {
  const { Browserbase } = await import("@browserbasehq/sdk");
  const { chromium } = await import("playwright-core");

  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
  });

  const browser = await chromium.connectOverCDP(session.connectUrl);
  try {
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    // Give client-rendered content a beat to settle without hanging forever.
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

    const status = response?.status() ?? 0;
    const title = await page.title();

    // Extract everything in one page-context evaluation to limit round trips.
    const extracted = await page.evaluate(() => {
      const text = (el: Element | null) => (el?.textContent ?? "").trim();
      const attr = (sel: string, name: string) =>
        document.querySelector(sel)?.getAttribute(name) ?? undefined;

      return {
        text: (document.body?.innerText ?? "").slice(0, 20_000),
        headings: Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => ({
          level: Number(h.tagName[1]),
          text: text(h),
        })),
        links: Array.from(document.querySelectorAll("a[href]")).map((a) => ({
          text: text(a),
          href: (a as HTMLAnchorElement).href,
        })),
        buttons: Array.from(document.querySelectorAll("button,[role=button]")).map((b) => ({
          text: text(b),
        })),
        images: Array.from(document.querySelectorAll("img")).map((img) => ({
          src: (img as HTMLImageElement).src,
          alt: (img as HTMLImageElement).alt || undefined,
        })),
        forms: Array.from(document.querySelectorAll("form")).map((f) => ({
          labels: Array.from(f.querySelectorAll("label")).map((l) => text(l)).filter(Boolean),
        })),
        metadata: {
          description: attr("meta[name=description]", "content"),
          canonical: attr("link[rel=canonical]", "href"),
          ogTitle: attr("meta[property='og:title']", "content"),
          ogDescription: attr("meta[property='og:description']", "content"),
        },
      };
    });

    const shot = await page.screenshot({ type: "png", fullPage: false });
    const screenshotUrl = `data:image/png;base64,${shot.toString("base64")}`;

    return {
      url,
      title: title || url,
      status,
      screenshotUrl,
      text: extracted.text,
      headings: extracted.headings,
      links: extracted.links,
      buttons: extracted.buttons,
      images: extracted.images,
      forms: extracted.forms,
      selectors: [],
      metadata: extracted.metadata,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
