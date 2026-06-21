import { DEMO_ORG_ID } from "@/data/seed";

export type RequestAuthContext = {
  orgId: string;
  mode: "secret" | "demo_fallback";
};

export type RequestAuthResult =
  | ({ ok: true } & RequestAuthContext)
  | {
      ok: false;
      status: 401 | 403;
      code: "missing_secret" | "invalid_secret" | "org_not_allowed";
      error: string;
    };

export type AuthorizeRequestInput = {
  headers: Headers;
  requestedOrgId?: string | null;
  env?: Record<string, string | undefined>;
  allowDemoFallback?: boolean;
  requiredSecretEnv?: string;
  defaultOrgId?: string;
};

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
  const allowedOrgs = parseAllowedOrgs(env.QUAD_ALLOWED_ORGS);

  if (configuredSecrets.length > 0) {
    const providedSecret = getProvidedSecret(input.headers);
    if (!providedSecret) {
      return {
        ok: false,
        status: 401,
        code: "missing_secret",
        error: "Missing API secret.",
      };
    }
    if (!configuredSecrets.includes(providedSecret)) {
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
    return { ok: true, orgId, mode: "secret" };
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
  return { ok: true, orgId, mode: "demo_fallback" };
}

export function requestAuthError(result: Exclude<RequestAuthResult, { ok: true }>) {
  return {
    ok: false,
    error: result.error,
    code: result.code,
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
