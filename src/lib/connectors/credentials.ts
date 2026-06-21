import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getClient } from "@/lib/brain/db";
import { getCapability } from "@/lib/metaregistry";

export type ConnectorCredentialStatus = "installed" | "revoked";

export type ConnectorCredentialRecord = {
  id: string;
  orgId: string;
  capabilityId: string;
  actor: string;
  scopes: string[];
  status: ConnectorCredentialStatus;
  credentialHash: string;
  encryptedCredential: string;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};

export type ConnectorCredentialSummary = Omit<ConnectorCredentialRecord, "encryptedCredential"> & {
  hasCredential: boolean;
};

export type InstallConnectorCredentialInput = {
  orgId: string;
  capabilityId: string;
  credential: Record<string, unknown>;
  scopes?: string[];
  actor?: string;
  now?: string;
};

export type RevokeConnectorCredentialInput = {
  orgId: string;
  installId?: string;
  capabilityId?: string;
  actor?: string;
  now?: string;
};

export type ConnectorCredentialReceipt = {
  id: string;
  action: "installed" | "revoked";
  orgId: string;
  capabilityId: string;
  installId: string;
  actor: string;
  scopes: string[];
  createdAt: string;
  credentialHash: string;
};

export class ConnectorCredentialError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "capability_not_found"
      | "invalid_capability"
      | "scope_not_allowed"
      | "credential_required"
      | "credential_not_found",
    public readonly status: 400 | 404
  ) {
    super(message);
  }
}

const g = globalThis as typeof globalThis & {
  __quadConnectorCredentials?: Map<string, ConnectorCredentialRecord>;
};
if (!g.__quadConnectorCredentials) g.__quadConnectorCredentials = new Map();
const memoryCredentials = g.__quadConnectorCredentials;

export async function installConnectorCredential(
  input: InstallConnectorCredentialInput
): Promise<{ summary: ConnectorCredentialSummary; receipt: ConnectorCredentialReceipt; durable: boolean }> {
  const manifest = getCapability(input.capabilityId);
  if (!manifest) {
    throw new ConnectorCredentialError("Capability not found.", "capability_not_found", 404);
  }
  if (manifest.kind !== "connector" && manifest.kind !== "publisher") {
    throw new ConnectorCredentialError("Only connector and publisher capabilities can store credentials.", "invalid_capability", 400);
  }
  if (!input.credential || Object.keys(input.credential).length === 0) {
    throw new ConnectorCredentialError("Credential payload is required.", "credential_required", 400);
  }

  const scopes = input.scopes?.length ? input.scopes : manifest.scopes;
  const illegalScope = scopes.find((scope) => !manifest.scopes.includes(scope));
  if (illegalScope) {
    throw new ConnectorCredentialError(`Scope ${illegalScope} is not allowed for ${manifest.id}.`, "scope_not_allowed", 400);
  }

  const now = input.now ?? new Date().toISOString();
  const credentialHash = hashCredential(input.credential);
  const record: ConnectorCredentialRecord = {
    id: `conn_${hashParts(input.orgId, input.capabilityId, now, credentialHash)}`,
    orgId: input.orgId,
    capabilityId: input.capabilityId,
    actor: input.actor ?? "demo.operator",
    scopes,
    status: "installed",
    credentialHash,
    encryptedCredential: encryptCredential(input.credential),
    createdAt: now,
    updatedAt: now,
    revokedAt: null,
  };

  memoryCredentials.set(record.id, record);
  const durable = await upsertCredential(record);
  return {
    summary: summarizeConnectorCredential(record),
    receipt: receiptFor(record, "installed"),
    durable,
  };
}

export async function listConnectorCredentials(input: {
  orgId: string;
  status?: ConnectorCredentialStatus;
}): Promise<ConnectorCredentialSummary[]> {
  const db = getClient();
  if (db) {
    try {
      let query = db
        .from("connector_credentials")
        .select("*")
        .eq("org_id", input.orgId)
        .order("updated_at", { ascending: false });
      if (input.status) query = query.eq("status", input.status);
      const { data, error } = await query;
      if (!error && data) {
        return data.map(fromCredentialRow).map(summarizeConnectorCredential);
      }
    } catch {
      // Fall back to memory below.
    }
  }

  return [...memoryCredentials.values()]
    .filter((credential) => credential.orgId === input.orgId)
    .filter((credential) => !input.status || credential.status === input.status)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(summarizeConnectorCredential);
}

export async function revokeConnectorCredential(
  input: RevokeConnectorCredentialInput
): Promise<{ summary: ConnectorCredentialSummary; receipt: ConnectorCredentialReceipt; durable: boolean }> {
  const existing = await findCredential(input);
  if (!existing) {
    throw new ConnectorCredentialError("Connector credential not found.", "credential_not_found", 404);
  }

  const now = input.now ?? new Date().toISOString();
  const updated: ConnectorCredentialRecord = {
    ...existing,
    actor: input.actor ?? existing.actor,
    status: "revoked",
    updatedAt: now,
    revokedAt: now,
  };
  memoryCredentials.set(updated.id, updated);
  const durable = await upsertCredential(updated);

  return {
    summary: summarizeConnectorCredential(updated),
    receipt: receiptFor(updated, "revoked"),
    durable,
  };
}

export function summarizeConnectorCredential(record: ConnectorCredentialRecord): ConnectorCredentialSummary {
  const { encryptedCredential: _encryptedCredential, ...summary } = record;
  return {
    ...summary,
    hasCredential: Boolean(record.encryptedCredential),
  };
}

export function decryptConnectorCredentialForUse(record: ConnectorCredentialRecord): Record<string, unknown> {
  return decryptCredential(record.encryptedCredential);
}

function receiptFor(record: ConnectorCredentialRecord, action: ConnectorCredentialReceipt["action"]): ConnectorCredentialReceipt {
  return {
    id: `connector_receipt_${hashParts(record.id, action, record.updatedAt)}`,
    action,
    orgId: record.orgId,
    capabilityId: record.capabilityId,
    installId: record.id,
    actor: record.actor,
    scopes: record.scopes,
    createdAt: record.updatedAt,
    credentialHash: record.credentialHash,
  };
}

async function findCredential(input: RevokeConnectorCredentialInput): Promise<ConnectorCredentialRecord | null> {
  const memory = [...memoryCredentials.values()]
    .find((credential) =>
      credential.orgId === input.orgId &&
      (input.installId ? credential.id === input.installId : true) &&
      (input.capabilityId ? credential.capabilityId === input.capabilityId : true)
    );
  if (memory) return memory;

  const db = getClient();
  if (!db) return null;
  try {
    let query = db
      .from("connector_credentials")
      .select("*")
      .eq("org_id", input.orgId)
      .limit(1);
    if (input.installId) query = query.eq("id", input.installId);
    if (input.capabilityId) query = query.eq("capability_id", input.capabilityId);
    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return fromCredentialRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
}

async function upsertCredential(record: ConnectorCredentialRecord): Promise<boolean> {
  const db = getClient();
  if (!db) return false;
  try {
    const { error } = await db.from("connector_credentials").upsert(toCredentialRow(record), { onConflict: "id" });
    return !error;
  } catch {
    return false;
  }
}

function toCredentialRow(record: ConnectorCredentialRecord) {
  return {
    id: record.id,
    org_id: record.orgId,
    capability_id: record.capabilityId,
    actor: record.actor,
    scopes: record.scopes,
    status: record.status,
    credential_hash: record.credentialHash,
    encrypted_credential: record.encryptedCredential,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    revoked_at: record.revokedAt,
  };
}

function fromCredentialRow(row: Record<string, unknown>): ConnectorCredentialRecord {
  return {
    id: String(row.id),
    orgId: String(row.org_id),
    capabilityId: String(row.capability_id),
    actor: String(row.actor),
    scopes: Array.isArray(row.scopes) ? row.scopes.map(String) : [],
    status: row.status as ConnectorCredentialStatus,
    credentialHash: String(row.credential_hash),
    encryptedCredential: String(row.encrypted_credential),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
  };
}

function encryptCredential(credential: Record<string, unknown>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credential), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptCredential(envelope: string): Record<string, unknown> {
  const [version, rawIv, rawTag, rawEncrypted] = envelope.split(".");
  if (version !== "v1" || !rawIv || !rawTag || !rawEncrypted) {
    throw new Error("Unsupported credential envelope.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(rawIv, "base64url"));
  decipher.setAuthTag(Buffer.from(rawTag, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(rawEncrypted, "base64url")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as Record<string, unknown>;
}

function encryptionKey(): Buffer {
  const secret =
    process.env.QUAD_CONNECTOR_ENCRYPTION_KEY ||
    process.env.QUAD_API_SECRET ||
    "quad-local-dev-connector-key";
  return createHash("sha256").update(secret).digest();
}

function hashCredential(credential: Record<string, unknown>): string {
  return `sha256:${createHash("sha256").update(stableStringify(credential)).digest("hex").slice(0, 24)}`;
}

function hashParts(...parts: string[]): string {
  return createHash("sha256").update(parts.join(":")).digest("hex").slice(0, 16);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
}
