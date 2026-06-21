export type AgentWorkflow = "enterprise_proof" | "website_audit";

export type AgentRunRequestBody = {
  orgId?: string;
  targetUrl?: string;
  workflow?: AgentWorkflow;
  limit?: number;
};

export type AgentRunRequestValidation =
  | {
      ok: true;
      orgId: string;
      targetUrl: string;
      workflow: AgentWorkflow;
      limit: number;
    }
  | {
      ok: false;
      status: 400 | 401 | 403 | 500;
      error: string;
    };

const DEFAULT_LIMIT = 4;
const MAX_LIMIT = 8;

export function validateAgentRunRequest(input: {
  body: AgentRunRequestBody;
  headers: Headers;
  defaultOrgId: string;
  env: Record<string, string | undefined>;
}): AgentRunRequestValidation {
  const expectedSecret = input.env.QUAD_AGENT_RUN_SECRET;
  if (!expectedSecret && input.env.NODE_ENV === "production") {
    return { ok: false, status: 500, error: "Agent secret is not configured." };
  }
  if (expectedSecret) {
    const actualSecret = input.headers.get("x-quad-agent-secret");
    if (actualSecret !== expectedSecret) {
      return { ok: false, status: 401, error: "Invalid agent secret." };
    }
  }

  const targetUrl = normalizeTargetUrl(input.body.targetUrl);
  if (!targetUrl) return { ok: false, status: 400, error: "targetUrl required" };

  const orgId = input.body.orgId ?? input.defaultOrgId;
  const allowedOrgs = parseCsv(input.env.QUAD_AGENT_ALLOWED_ORGS);
  if (allowedOrgs.length > 0 && !allowedOrgs.includes(orgId)) {
    return { ok: false, status: 403, error: "orgId is not allowlisted." };
  }

  const allowedHosts = parseAllowedHosts(input.env.QUAD_AGENT_ALLOWED_HOSTS);
  if (allowedHosts.length > 0 && !allowedHosts.includes(new URL(targetUrl).hostname)) {
    return { ok: false, status: 403, error: "targetUrl host is not allowlisted." };
  }

  return {
    ok: true,
    orgId,
    targetUrl,
    workflow: input.body.workflow === "website_audit" ? "website_audit" : "enterprise_proof",
    limit: clampLimit(input.body.limit),
  };
}

function normalizeTargetUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function clampLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(value ?? DEFAULT_LIMIT)));
}

function parseAllowedHosts(value: string | undefined): string[] {
  return parseCsv(value);
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}
