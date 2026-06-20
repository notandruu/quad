import { traced, SPAN } from "@/lib/observability/phoenix";

/**
 * Discover candidate pages to audit, starting from a target URL. MVP strategy:
 * try /sitemap.xml, fall back to same-origin links found on the homepage.
 * Capped by `limit` so demo runs stay bounded.
 */
export async function discoverPages(
  targetUrl: string,
  limit: number
): Promise<string[]> {
  return traced(SPAN.discoverPages, { "target.url": targetUrl, "discover.limit": limit }, async () => {
    const origin = new URL(targetUrl).origin;
    const found = new Set<string>([normalize(targetUrl)]);

    // Try sitemap first.
    try {
      const res = await fetch(`${origin}/sitemap.xml`);
      if (res.ok) {
        const xml = await res.text();
        for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
          found.add(normalize(m[1]));
          if (found.size >= limit) break;
        }
      }
    } catch {
      // No sitemap; fall through to homepage link scrape.
    }

    if (found.size < limit) {
      try {
        const res = await fetch(targetUrl);
        const html = await res.text();
        for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
          const href = resolve(origin, m[1]);
          if (href && href.startsWith(origin)) found.add(normalize(href));
          if (found.size >= limit) break;
        }
      } catch {
        // Keep whatever we have.
      }
    }

    return Array.from(found).slice(0, limit);
  });
}

function normalize(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

function resolve(origin: string, href: string): string | null {
  try {
    return new URL(href, origin).toString();
  } catch {
    return null;
  }
}
