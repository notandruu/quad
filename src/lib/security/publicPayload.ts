export type PublicPayloadLeak = {
  path: string;
  envKey: string;
  valuePreview: string;
};

const SECRET_ENV_KEY_RE = /(secret|token|api[_-]?key|dsn|database_url|service_key|private_key|password|anthropic|openai|deepgram|browserbase|sentry)/i;

export function findPublicPayloadSecretLeaks(
  payload: unknown,
  env: Record<string, string | undefined> = process.env
): PublicPayloadLeak[] {
  const secretValues = Object.entries(env)
    .filter(([key, value]) => SECRET_ENV_KEY_RE.test(key) && isSensitiveValue(value))
    .map(([key, value]) => ({ key, value: value as string }));
  if (secretValues.length === 0) return [];

  const leaks: PublicPayloadLeak[] = [];
  walkPayload(payload, "$", (path, value) => {
    for (const secret of secretValues) {
      if (value.includes(secret.value)) {
        leaks.push({
          path,
          envKey: secret.key,
          valuePreview: preview(value),
        });
      }
    }
  });
  return leaks;
}

export function expectPublicPayloadHasNoSecrets(
  payload: unknown,
  env: Record<string, string | undefined> = process.env
): void {
  const leaks = findPublicPayloadSecretLeaks(payload, env);
  if (leaks.length > 0) {
    throw new Error(`public payload leaked secret values: ${JSON.stringify(leaks)}`);
  }
}

function walkPayload(
  value: unknown,
  path: string,
  visit: (path: string, value: string) => void
): void {
  if (typeof value === "string") {
    visit(path, value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkPayload(item, `${path}[${index}]`, visit));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    walkPayload(child, `${path}.${key}`, visit);
  }
}

function isSensitiveValue(value: string | undefined): value is string {
  if (!value || value.length < 8) return false;
  if (/^(true|false|null|undefined)$/i.test(value)) return false;
  return true;
}

function preview(value: string): string {
  if (value.length <= 12) return "[redacted]";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
