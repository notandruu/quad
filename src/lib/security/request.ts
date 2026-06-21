import { DEMO_ORG_ID } from "@/data/seed";

export type RequestAuthContext = {
  orgId: string;
  mode: "secret" | "service_token" | "demo_fallback";
  scopes: string[];
};

export type RequestAuthResult =
  | ({ ok: true } & RequestAuthContext)
  | {
      ok: false;
      status: 401 | 403;
      code: "missing_secret" | "invalid_secret" | "org_not_allowed" | "scope_not_allowed";
      error: string;
    };

export type AuthorizeRequestInput = {
  headers: Headers;
  requestedOrgId?: string | null;
  env?: Record<string, string | undefined>;
  allowDemoFallback?: boolean;
  requiredSecretEnv?: string;
  defaultOrgId?: string;
  requiredScopes?: string[];
};

export type QuadServiceToken = {
  token: string;
  orgs: string[];
  scopes: string[];
  label?: string;
};

export type ServiceTokenReadiness = {
  configured: boolean;
  count: number;
  scopedCount: number;
  unscopedCount: number;
  orgScopedCount: number;
  scopes: string[];
  tokens: Array<{
    label: string;
    orgScoped: boolean;
    scopes: string[];
  }>;
};

const ADMIN_SCOPE = "*";

export function authorizeRequest(input: AuthorizeRequestInput): RequestAuthResult {
  const env = input.env ?? process.env;
  const defaultOrgId = normalizeOrgId(input.defaultOrgId ?? DEMO_ORG_ID);
  const orgId = normalizeOrgId(
    input.requestedOrgId ??
      input.headers.get("x-quad-org-id") ??
      defaultOrgId
  );
  const allowDemoFallback = input.allowDemoFallback ?? true;
  const configuredSecrets = getConfiguredSecrets(env, input.requiredSecretEnv);
  const serviceTokens = parseServiceTokens(env.QUAD_SERVICE_TOKENS);
  const allowedOrgs = parseAllowedOrgs(env.QUAD_ALLOWED_ORGS);
  const requiredScopes = input.requiredScopes ?? [];

  if (configuredSecrets.length > 0 || serviceTokens.length > 0) {
    const providedSecret = getProvidedSecret(input.headers);
    if (!providedSecret) {
      return {
        ok: false,
        status: 401,
        code: "missing_secret",
        error: "Missing API secret.",
      };
    }

    if (configuredSecrets.includes(providedSecret)) {
      if (allowedOrgs.size > 0 && !allowedOrgs.has(orgId)) {
        return orgForbidden(orgId);
      }
      return { ok: true, orgId, mode: "secret", scopes: [ADMIN_SCOPE] };
    }

    const serviceToken = serviceTokens.find((candidate) => candidate.token === providedSecret);
    if (!serviceToken) {
      return {
        ok: false,
        status: 401,
        code: "invalid_secret",
        error: "Invalid API secret.",
      };
    }

    if (allowedOrgs.size > 0 && !allowedOrgs.has(orgId)) {
      return orgForbidden(orgId);
    }
    if (serviceToken.orgs.length > 0 && !serviceToken.orgs.includes(orgId)) {
      return orgForbidden(orgId);
    }
    if (!hasRequiredScopes(serviceToken.scopes, requiredScopes)) {
      return {
        ok: false,
        status: 403,
        code: "scope_not_allowed",
        error: `Token is missing required scope: ${requiredScopes.join(", ")}.`,
      };
    }
    return { ok: true, orgId, mode: "service_token", scopes: serviceToken.scopes };
  }

  if (!allowDemoFallback) {
    return {
      ok: false,
      status: 401,
      code: "missing_secret",
      error: "API secret is required for this route.",
    };
  }

  if (orgId !== defaultOrgId) return orgForbidden(orgId);
  if (allowedOrgs.size > 0 && !allowedOrgs.has(orgId)) return orgForbidden(orgId);
  return { ok: true, orgId, mode: "demo_fallback", scopes: [ADMIN_SCOPE] };
}

export function requestAuthError(result: Exclude<RequestAuthResult, { ok: true }>) {
  return {
    ok: false,
    error: result.error,
    code: result.code,
  };
}

export function getServiceTokenReadiness(
  env: Record<string, string | undefined> = process.env
): ServiceTokenReadiness {
  const tokens = parseServiceTokens(env.QUAD_SERVICE_TOKENS);
  const summaries = tokens.map((token, index) => ({
    label: token.label?.trim() || `service-token-${index + 1}`,
    orgScoped: token.orgs.length > 0,
    scopes: token.scopes,
  }));
  const scopes = [...new Set(tokens.flatMap((token) => token.scopes))].sort();

  return {
    configured: tokens.length > 0,
    count: tokens.length,
    scopedCount: tokens.filter((token) => !token.scopes.includes(ADMIN_SCOPE)).length,
    unscopedCount: tokens.filter((token) => token.scopes.includes(ADMIN_SCOPE)).length,
    orgScopedCount: tokens.filter((token) => token.orgs.length > 0).length,
    scopes,
    tokens: summaries,
  };
}

function getConfiguredSecrets(
  env: Record<string, string | undefined>,
  requiredSecretEnv?: string
): string[] {
  const secrets = [env.QUAD_API_SECRET];
  if (requiredSecretEnv) secrets.push(env[requiredSecretEnv]);
  return [...new Set(secrets.map((secret) => secret?.trim()).filter(Boolean) as string[])];
}

function getProvidedSecret(headers: Headers): string | null {
  const apiKey = headers.get("x-quad-api-key")?.trim();
  if (apiKey) return apiKey;

  const authorization = headers.get("authorization")?.trim() ?? "";
  const match = /^bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() ?? null;
}

function parseAllowedOrgs(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => normalizeOrgId(item))
  );
}

function parseServiceTokens(raw: string | undefined): QuadServiceToken[] {
  if (!raw?.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    const values = Array.isArray(parsed) ? parsed : [parsed];
    return values
      .map((item) => normalizeServiceToken(item))
      .filter((item): item is QuadServiceToken => Boolean(item));
  } catch {
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((token) => ({
        token,
        orgs: [],
        scopes: [ADMIN_SCOPE],
      }));
  }
}

function normalizeServiceToken(value: unknown): QuadServiceToken | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const token = typeof item.token === "string" ? item.token.trim() : "";
  if (!token) return null;

  return {
    token,
    label: typeof item.label === "string" ? item.label : undefined,
    orgs: normalizeList(item.orgs).map(normalizeOrgId),
    scopes: normalizeList(item.scopes, [ADMIN_SCOPE]),
  };
}

function normalizeList(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  }
  if (typeof value === "string") {
    return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  }
  return fallback;
}

function hasRequiredScopes(tokenScopes: string[], requiredScopes: string[]): boolean {
  if (requiredScopes.length === 0) return true;
  if (tokenScopes.includes(ADMIN_SCOPE)) return true;
  return requiredScopes.every((scope) => tokenScopes.includes(scope));
}

function normalizeOrgId(value: string): string {
  return value.trim() || DEMO_ORG_ID;
}

function orgForbidden(orgId: string): Exclude<RequestAuthResult, { ok: true }> {
  return {
    ok: false,
    status: 403,
    code: "org_not_allowed",
    error: `Org ${orgId} is not allowed for this request.`,
  };
}
