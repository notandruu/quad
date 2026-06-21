import { CAPABILITY_CATALOG, type ApprovalMode, type CapabilityManifest } from "@/lib/metaregistry";
import type { PlaybookManifest } from "@/lib/playbooks";
import { PLAYBOOK_CATALOG } from "@/lib/playbooks";
import { listConnectorCredentials, type ConnectorCredentialSummary } from "./credentials";

export type ConnectorRegistryKind = "source" | "publisher" | "browser" | "agent" | "voice" | "observability" | "internal";

export type ConnectorAuthMode =
  | "none"
  | "service_account"
  | "api_key"
  | "oauth_user"
  | "hosted_provider";

export type ConnectorRegistryEntry = {
  id: string;
  name: string;
  kind: ConnectorRegistryKind;
  capabilityId: string;
  capabilityKind: CapabilityManifest["kind"];
  sponsor?: CapabilityManifest["sponsor"];
  authMode: ConnectorAuthMode;
  scopes: string[];
  writes: boolean;
  approvalMode: ApprovalMode;
  credentialRequired: boolean;
  credentialStatus: "not_required" | "missing" | "installed" | "revoked";
  installedCredentialCount: number;
  revokedCredentialCount: number;
  boundPlaybooks: Array<Pick<PlaybookManifest, "id" | "name" | "approvalTier">>;
  risk: "low" | "medium" | "high";
  nextAction: string;
};

export type ConnectorRegistrySummary = {
  orgId: string;
  total: number;
  installed: number;
  missingCredentials: number;
  writeCapable: number;
  approvalGated: number;
  byKind: Record<ConnectorRegistryKind, number>;
  entries: ConnectorRegistryEntry[];
};

const CONNECTOR_KIND_BY_CAPABILITY: Record<string, ConnectorRegistryKind> = {
  "quad.company_brain": "source",
  "openai.embeddings": "source",
  "redis.event_spine": "internal",
  "browserbase.read_browser": "browser",
  "browserbase.write_browser": "browser",
  "trust_packet.exporter": "publisher",
  "cms.publisher": "publisher",
  "task.publisher": "publisher",
  "fetch.agent_bridge": "agent",
  "deepgram.voice_memory": "voice",
  "arize.phoenix": "observability",
  "sentry.reliability": "observability",
};

const AUTH_MODE_BY_CAPABILITY: Record<string, ConnectorAuthMode> = {
  "quad.company_brain": "service_account",
  "openai.embeddings": "api_key",
  "redis.event_spine": "service_account",
  "browserbase.read_browser": "hosted_provider",
  "browserbase.write_browser": "hosted_provider",
  "trust_packet.exporter": "none",
  "cms.publisher": "api_key",
  "task.publisher": "api_key",
  "fetch.agent_bridge": "none",
  "deepgram.voice_memory": "api_key",
  "arize.phoenix": "hosted_provider",
  "sentry.reliability": "hosted_provider",
};

export async function buildConnectorRegistry(input: {
  orgId: string;
  credentials?: ConnectorCredentialSummary[];
}): Promise<ConnectorRegistrySummary> {
  const credentials = input.credentials ?? await listConnectorCredentials({ orgId: input.orgId });
  const credentialGroups = groupCredentials(credentials);
  const entries = CAPABILITY_CATALOG
    .filter((capability) => isConnectorRegistryCapability(capability))
    .map((capability) => buildConnectorRegistryEntry(capability, credentialGroups.get(capability.id) ?? []));

  return {
    orgId: input.orgId,
    total: entries.length,
    installed: entries.filter((entry) => entry.credentialStatus === "installed" || entry.credentialStatus === "not_required").length,
    missingCredentials: entries.filter((entry) => entry.credentialStatus === "missing").length,
    writeCapable: entries.filter((entry) => entry.writes).length,
    approvalGated: entries.filter((entry) => entry.approvalMode !== "none").length,
    byKind: summarizeConnectorKinds(entries),
    entries,
  };
}

export function buildConnectorRegistryEntry(
  capability: CapabilityManifest,
  credentials: ConnectorCredentialSummary[] = []
): ConnectorRegistryEntry {
  const installedCredentialCount = credentials.filter((credential) => credential.status === "installed").length;
  const revokedCredentialCount = credentials.filter((credential) => credential.status === "revoked").length;
  const authMode = AUTH_MODE_BY_CAPABILITY[capability.id] ?? fallbackAuthMode(capability);
  const credentialRequired = capability.env.length > 0 || authMode === "api_key" || authMode === "service_account" || authMode === "hosted_provider";
  const credentialStatus = !credentialRequired
    ? "not_required"
    : installedCredentialCount > 0
      ? "installed"
      : revokedCredentialCount > 0
        ? "revoked"
        : "missing";
  const boundPlaybooks = PLAYBOOK_CATALOG
    .filter((playbook) => playbook.requiredCapabilities.includes(capability.id))
    .map((playbook) => ({
      id: playbook.id,
      name: playbook.name,
      approvalTier: playbook.approvalTier,
    }));

  return {
    id: `connector.${capability.id}`,
    name: capability.name,
    kind: CONNECTOR_KIND_BY_CAPABILITY[capability.id] ?? fallbackConnectorKind(capability),
    capabilityId: capability.id,
    capabilityKind: capability.kind,
    sponsor: capability.sponsor,
    authMode,
    scopes: capability.scopes,
    writes: capability.writes,
    approvalMode: capability.approvalMode,
    credentialRequired,
    credentialStatus,
    installedCredentialCount,
    revokedCredentialCount,
    boundPlaybooks,
    risk: connectorRisk(capability, credentialRequired),
    nextAction: connectorNextAction(capability, credentialStatus),
  };
}

function isConnectorRegistryCapability(capability: CapabilityManifest): boolean {
  return capability.kind === "connector" ||
    capability.kind === "publisher" ||
    capability.kind === "surface" ||
    capability.kind === "agent";
}

function groupCredentials(credentials: ConnectorCredentialSummary[]): Map<string, ConnectorCredentialSummary[]> {
  const groups = new Map<string, ConnectorCredentialSummary[]>();
  for (const credential of credentials) {
    const existing = groups.get(credential.capabilityId) ?? [];
    existing.push(credential);
    groups.set(credential.capabilityId, existing);
  }
  return groups;
}

function summarizeConnectorKinds(entries: ConnectorRegistryEntry[]): Record<ConnectorRegistryKind, number> {
  const summary: Record<ConnectorRegistryKind, number> = {
    source: 0,
    publisher: 0,
    browser: 0,
    agent: 0,
    voice: 0,
    observability: 0,
    internal: 0,
  };
  for (const entry of entries) summary[entry.kind] += 1;
  return summary;
}

function fallbackConnectorKind(capability: CapabilityManifest): ConnectorRegistryKind {
  if (capability.kind === "publisher") return "publisher";
  if (capability.kind === "agent") return "agent";
  if (capability.tags.includes("voice")) return "voice";
  if (capability.tags.includes("observability")) return "observability";
  return capability.writes ? "publisher" : "source";
}

function fallbackAuthMode(capability: CapabilityManifest): ConnectorAuthMode {
  if (capability.env.length === 0) return "none";
  return capability.writes ? "service_account" : "api_key";
}

function connectorRisk(capability: CapabilityManifest, credentialRequired: boolean): ConnectorRegistryEntry["risk"] {
  if (capability.writes) return "high";
  if (credentialRequired || capability.approvalMode !== "none") return "medium";
  return "low";
}

function connectorNextAction(
  capability: CapabilityManifest,
  credentialStatus: ConnectorRegistryEntry["credentialStatus"]
): string {
  if (credentialStatus === "missing") return "install scoped connector credentials.";
  if (credentialStatus === "revoked") return "install a fresh credential before routing.";
  if (capability.writes) return "keep writes behind approval receipts.";
  return "ready for read-only routing.";
}
