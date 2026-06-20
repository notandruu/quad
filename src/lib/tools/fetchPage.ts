import type { RenderedPageEvidence } from "@/lib/types";

/**
 * Static fetch fallback. Used only when a Browserbase render fails. It still
 * produces a RenderedPageEvidence object so findings keep their evidence
 * contract, but it cannot capture screenshots or client-rendered content.
 */
export async function fetchPageEvidence(
  url: string
): Promise<RenderedPageEvidence> {
  const res = await fetch(url, {
    headers: { "user-agent": "KaliAuditBot/0.1 (+https://github.com/notandruu/quad)" },
    redirect: "follow",
  });
  const html = await res.text();

  return {
    url,
    title: matchOne(html, /<title[^>]*>([^<]*)<\/title>/i) ?? url,
    status: res.status,
    text: stripTags(html).slice(0, 20_000),
    headings: matchAll(html, /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi).map((m) => ({
      level: Number.parseInt(m[1], 10),
      text: stripTags(m[2]).trim(),
    })),
    links: matchAll(html, /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi).map(
      (m) => ({ href: m[1], text: stripTags(m[2]).trim() })
    ),
    buttons: matchAll(html, /<button[^>]*>([\s\S]*?)<\/button>/gi).map((m) => ({
      text: stripTags(m[1]).trim(),
    })),
    images: matchAll(html, /<img[^>]*>/gi).map((m) => ({
      src: matchOne(m[0], /src=["']([^"']+)["']/i) ?? "",
      alt: matchOne(m[0], /alt=["']([^"']*)["']/i) ?? undefined,
    })),
    forms: matchAll(html, /<form[\s\S]*?<\/form>/gi).map(() => ({ labels: [] })),
    selectors: [],
    metadata: {
      description: matchOne(html, /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ?? undefined,
      canonical: matchOne(html, /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) ?? undefined,
      ogTitle: matchOne(html, /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ?? undefined,
      ogDescription: matchOne(html, /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) ?? undefined,
    },
  };
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchOne(input: string, re: RegExp): string | null {
  const m = input.match(re);
  return m ? m[1] : null;
}

function matchAll(input: string, re: RegExp): RegExpMatchArray[] {
  return Array.from(input.matchAll(re));
}
