export const QUAD_LANDING_URL = "https://quad.stephenhung.me";
export const QUAD_APP_URL = "https://app.quad.stephenhung.me";

export const QUAD_LANDING_HOSTS = new Set(["quad.stephenhung.me", "www.quad.stephenhung.me"]);

export function normalizeHost(value: string | null | undefined): string {
  return (value ?? "").split(":")[0]?.trim().toLowerCase() ?? "";
}

export function isQuadLandingHost(value: string | null | undefined): boolean {
  return QUAD_LANDING_HOSTS.has(normalizeHost(value));
}

export function normalizeQuadAppUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return QUAD_APP_URL;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    if (isQuadLandingHost(url.host)) return QUAD_APP_URL;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return QUAD_APP_URL;
  }
}

export function defaultAuditTargetForOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname === "[::1]") {
      return new URL("/demo", url.origin).toString();
    }
  } catch {
    return QUAD_LANDING_URL;
  }
  return QUAD_LANDING_URL;
}
