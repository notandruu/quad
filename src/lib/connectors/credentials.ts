import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getClient } from "@/lib/brain/db";
import { getCapability } from "@/lib/metaregistry";
import { createQuadChainPacket, type QuadChainPacketSummary } from "@/lib/quad-chain";
import { saveQuadChainPacket } from "@/lib/quad-chain/registry";

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

export type ConnectorCredentialAuditAction = "installed" | "revoked";

export type ConnectorCredentialAuditLog = {
  id: string;
  orgId: string;
  action: ConnectorCredentialAuditAction;
  capabilityId: string;
  installId: string;
  actor: string;
  scopes: string[];
  credentialHash: string;
  receiptId: string;
  packetId: string;
  certificateId: string;
  createdAt: string;
};

export type ConnectorCredentialMutationResult = {
  summary: ConnectorCredentialSummary;
  receipt: ConnectorCredentialReceipt;
  durable: boolean;
  packet: QuadChainPacketSummary;
  auditLog: ConnectorCredentialAuditLog;
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
  __quadConnectorCredentialAuditLogs?: Map<string, ConnectorCredentialAuditLog>;
};
if (!g.__quadConnectorCredentials) g.__quadConnectorCredentials = new Map();
if (!g.__quadConnectorCredentialAuditLogs) g.__quadConnectorCredentialAuditLogs = new Map();
const memoryCredentials = g.__quadConnectorCredentials;
const memoryAuditLogs = g.__quadConnectorCredentialAuditLogs;

export async function installConnectorCredential(
  input: InstallConnectorCredentialInput
): Promise<ConnectorCredentialMutationResult> {
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
  const summary = summarizeConnectorCredential(record);
  const receipt = receiptFor(record, "installed");
  const packet = await createCredentialPacket({
    record,
    summary,
    receipt,
    action: "installed",
  });
  const auditLog = appendConnectorCredentialAuditLog({ record, receipt, packet, action: "installed" });
  return {
    summary,
    receipt,
    durable,
    packet,
    auditLog,
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

export async function listConnectorCredentialAuditLogs(input: {
  orgId: string;
  capabilityId?: string;
  limit?: number;
}): Promise<ConnectorCredentialAuditLog[]> {
  const limit = Math.max(1, Math.min(input.limit ?? 20, 100));

  return [...memoryAuditLogs.values()]
    .filter((entry) => entry.orgId === input.orgId)
    .filter((entry) => !input.capabilityId || entry.capabilityId === input.capabilityId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function revokeConnectorCredential(
  input: RevokeConnectorCredentialInput
): Promise<ConnectorCredentialMutationResult> {
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
  const summary = summarizeConnectorCredential(updated);
  const receipt = receiptFor(updated, "revoked");
  const packet = await createCredentialPacket({
    record: updated,
    summary,
    receipt,
    action: "revoked",
  });
  const auditLog = appendConnectorCredentialAuditLog({ record: updated, receipt, packet, action: "revoked" });

  return {
    summary,
    receipt,
    durable,
    packet,
    auditLog,
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

async function createCredentialPacket(input: {
  record: ConnectorCredentialRecord;
  summary: ConnectorCredentialSummary;
  receipt: ConnectorCredentialReceipt;
  action: ConnectorCredentialReceipt["action"];
}): Promise<QuadChainPacketSummary> {
  const actionPhrase = input.action === "installed" ? "connector credential installed" : "connector credential revoked";
  const output = [
    `${actionPhrase} for ${input.record.capabilityId}.`,
    `credential hash ${input.record.credentialHash} recorded.`,
    "no secret value included in the quadchain packet.",
  ].join(" ");
  const packet = createQuadChainPacket({
    type: "connector_action",
    orgId: input.record.orgId,
    runId: input.receipt.id,
    producer: "quad.connector_vault",
    consumer: "quad.metaregistry",
    sources: [
      {
        id: input.record.id,
        kind: "tool_result",
        content: {
          ...input.summary,
          encryptedCredential: undefined,
        },
      },
      {
        id: input.receipt.id,
        kind: "tool_result",
        content: input.receipt,
      },
    ],
    evidence: [
      {
        id: "credential-action",
        sourceId: input.receipt.id,
        quote: actionPhrase,
        required: true,
      },
      {
        id: "credential-hash-recorded",
        sourceId: input.receipt.id,
        quote: "credential hash",
        required: true,
      },
      {
        id: "secret-value-omitted",
        sourceId: input.record.id,
        quote: "no secret value included",
        required: true,
      },
    ],
    omittedRanges: [
      {
        sourceId: input.record.id,
        rangeId: "encrypted-credential",
        reason: "Encrypted connector credential bytes and plaintext secret values are intentionally omitted from quadchain packets.",
      },
    ],
    output,
    answerConcepts: ["connector credential", "credential hash", "no secret value"],
    visibility: "restricted",
    createdAt: input.record.updatedAt,
  });
  const saved = await saveQuadChainPacket(packet);
  return saved.summary;
}

function appendConnectorCredentialAuditLog(input: {
  record: ConnectorCredentialRecord;
  receipt: ConnectorCredentialReceipt;
  packet: QuadChainPacketSummary;
  action: ConnectorCredentialAuditAction;
}): ConnectorCredentialAuditLog {
  const auditLog: ConnectorCredentialAuditLog = {
    id: `connector_audit_${hashParts(input.receipt.id, input.action, input.packet.id)}`,
    orgId: input.record.orgId,
    action: input.action,
    capabilityId: input.record.capabilityId,
    installId: input.record.id,
    actor: input.record.actor,
    scopes: input.record.scopes,
    credentialHash: input.record.credentialHash,
    receiptId: input.receipt.id,
    packetId: input.packet.id,
    certificateId: input.packet.certificateId,
    createdAt: input.record.updatedAt,
  };
  memoryAuditLogs.set(auditLog.id, auditLog);
  return auditLog;
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
