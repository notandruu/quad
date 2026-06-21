export type DataClassification = "public" | "internal" | "confidential" | "restricted";

export type ModelPurpose =
  | "chat"
  | "audit"
  | "embedding"
  | "evaluation"
  | "trust_packet";

export type ProviderName = "anthropic" | "openai" | "local" | "blocked";

export type Redaction = {
  kind: "secret" | "email" | "phone" | "bearer_token" | "private_key";
  count: number;
};

export type SanitizedPayload = {
  text: string;
  classification: DataClassification;
  redactions: Redaction[];
  originalLength: number;
  sanitizedLength: number;
};

export type ModelPolicy = {
  purpose: ModelPurpose;
  provider: ProviderName;
  classification: DataClassification;
  allowed: boolean;
  maxChars: number;
  redactionRequired: boolean;
  reason: string;
};

export type ModelGatewayRequest = {
  purpose: ModelPurpose;
  text: string;
  classification?: DataClassification;
  allowRestricted?: boolean;
  maxChars?: number;
};

export type ModelGatewayDecision = {
  policy: ModelPolicy;
  payload: SanitizedPayload;
};

const SECRET_PATTERNS: Array<[Redaction["kind"], RegExp]> = [
  ["private_key", /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g],
  ["bearer_token", /bearer\s+[a-z0-9._~+/=-]{20,}/gi],
  ["secret", /\b(?:sk|pk|rk|ghp|glpat|xox[baprs])-[a-z0-9_-]{16,}\b/gi],
  ["secret", /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?[^"'\s]{8,}/gi],
  ["email", /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi],
  ["phone", /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g],
];

const DEFAULT_MAX_CHARS: Record<ModelPurpose, number> = {
  chat: 12000,
  audit: 24000,
  embedding: 8000,
  evaluation: 12000,
  trust_packet: 16000,
};

export function classifyText(text: string): DataClassification {
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/i.test(text)) return "restricted";
  if (/\b(?:api[_-]?key|secret|token|password)\s*[:=]/i.test(text)) return "restricted";
  if (/\b(?:sk|pk|rk|ghp|glpat|xox[baprs])-[a-z0-9_-]{16,}\b/i.test(text)) return "restricted";
  if (/\b(?:ssn|social security|bank account|routing number|credit card)\b/i.test(text)) {
    return "restricted";
  }
  if (/\b(?:confidential|nda|customer contract|security questionnaire|soc 2|hipaa|pii)\b/i.test(text)) {
    return "confidential";
  }
  if (/\b(?:internal|employee|roadmap|incident|customer)\b/i.test(text)) return "internal";
  return "public";
}

export function buildModelPolicy(input: {
  purpose: ModelPurpose;
  classification: DataClassification;
  allowRestricted?: boolean;
  maxChars?: number;
}): ModelPolicy {
  const maxChars = input.maxChars ?? DEFAULT_MAX_CHARS[input.purpose];
  const provider = providerForPurpose(input.purpose);

  if (input.classification === "restricted" && !input.allowRestricted) {
    return {
      purpose: input.purpose,
      provider: "blocked",
      classification: input.classification,
      allowed: false,
      maxChars,
      redactionRequired: true,
      reason: "Restricted data cannot leave the tenant without an explicit override.",
    };
  }

  return {
    purpose: input.purpose,
    provider,
    classification: input.classification,
    allowed: true,
    maxChars,
    redactionRequired: input.classification !== "public",
    reason: input.classification === "public"
      ? "Public data can be sent without redaction."
      : "Non-public data must be minimized and redacted before provider calls.",
  };
}

export function prepareModelPayload(input: ModelGatewayRequest): ModelGatewayDecision {
  const classification = input.classification ?? classifyText(input.text);
  const policy = buildModelPolicy({
    purpose: input.purpose,
    classification,
    allowRestricted: input.allowRestricted,
    maxChars: input.maxChars,
  });
  const payload = sanitizePayload(input.text, {
    classification,
    maxChars: policy.maxChars,
    redact: policy.redactionRequired,
  });

  if (!policy.allowed) {
    return {
      policy,
      payload: {
        ...payload,
        text: "",
        sanitizedLength: 0,
      },
    };
  }

  return { policy, payload };
}

export function assertModelCallAllowed(decision: ModelGatewayDecision): void {
  if (!decision.policy.allowed) throw new Error(decision.policy.reason);
}

export function sanitizePayload(
  text: string,
  input: { classification?: DataClassification; maxChars?: number; redact?: boolean } = {}
): SanitizedPayload {
  const classification = input.classification ?? classifyText(text);
  const redactions: Redaction[] = [];
  const maxChars = input.maxChars ?? 12000;
  let sanitized = text.slice(0, maxChars);

  if (input.redact ?? classification !== "public") {
    for (const [kind, pattern] of SECRET_PATTERNS) {
      let count = 0;
      sanitized = sanitized.replace(pattern, () => {
        count += 1;
        return `[redacted:${kind}]`;
      });
      if (count > 0) redactions.push({ kind, count });
    }
  }

  return {
    text: sanitized,
    classification,
    redactions,
    originalLength: text.length,
    sanitizedLength: sanitized.length,
  };
}

export function tenantKey(orgId: string, ...parts: string[]): string {
  return ["org", normalizeKeyPart(orgId), ...parts.map(normalizeKeyPart)].join(":");
}

export function telemetryAttributes(input: {
  orgId: string;
  purpose: ModelPurpose;
  payload: SanitizedPayload;
  provider?: ProviderName;
}): Record<string, string | number | boolean> {
  return {
    "quad.org_hash": hashForTelemetry(input.orgId),
    "quad.model_purpose": input.purpose,
    "quad.model_provider": input.provider ?? providerForPurpose(input.purpose),
    "quad.data_classification": input.payload.classification,
    "quad.payload_original_length": input.payload.originalLength,
    "quad.payload_sanitized_length": input.payload.sanitizedLength,
    "quad.redaction_count": input.payload.redactions.reduce((sum, item) => sum + item.count, 0),
  };
}

export function securityReadiness(env: Record<string, string | undefined>): {
  modelGateway: boolean;
  telemetryRedaction: boolean;
  tenantIsolation: boolean;
  retentionPolicy: boolean;
  label: string;
} {
  const retentionPolicy = Boolean(env.QUAD_RETENTION_DAYS);
  return {
    modelGateway: true,
    telemetryRedaction: true,
    tenantIsolation: true,
    retentionPolicy,
    label: retentionPolicy ? "Security substrate wired" : "Security substrate wired, retention policy missing",
  };
}

function providerForPurpose(purpose: ModelPurpose): ProviderName {
  if (purpose === "embedding") return "openai";
  return "anthropic";
}

function normalizeKeyPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "unknown";
}

function hashForTelemetry(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
