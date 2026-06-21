/**
 * Connector document abstraction. Every external source system (Jira, GitHub,
 * Confluence, Slack) implements ConnectorDocumentProvider. Local fixture data
 * uses connectorId "local". The retrieval path is the same regardless of source.
 */

export type ConnectorKind =
  | "local"
  | "jira"
  | "github"
  | "confluence"
  | "slack"
  | "email";

export type ConnectorDocumentKind =
  | "policy"
  | "ticket"
  | "log"
  | "note"
  | "pr"
  | "message"
  | "audit_report";

export type ConnectorDocument = {
  id: string;
  connectorId: ConnectorKind;
  orgId: string;
  kind: ConnectorDocumentKind;
  title: string;
  content: string;
  url?: string;
  metadata: Record<string, unknown>;
  retrievedAt: string;
};

export type ConnectorDocumentQuery = {
  orgId: string;
  query: string;
  limit?: number;
};

export type ConnectorDocumentProvider = {
  connectorId: ConnectorKind;
  listDocuments(query: ConnectorDocumentQuery): Promise<ConnectorDocument[]>;
};

/**
 * Global registry of active connector providers. Register providers at startup
 * before calling listConnectorDocuments. Each connector handles its own auth
 * and rate limiting internally.
 */
const PROVIDERS: Map<ConnectorKind, ConnectorDocumentProvider> = new Map();

export function registerConnectorProvider(provider: ConnectorDocumentProvider): void {
  PROVIDERS.set(provider.connectorId, provider);
}

export function getRegisteredConnectors(): ConnectorKind[] {
  return Array.from(PROVIDERS.keys());
}

/**
 * Query all registered connector providers and return the most relevant
 * documents for the given query. Scores by keyword overlap since connector
 * docs are not embedded in pgvector yet.
 */
export async function listConnectorDocuments(
  query: ConnectorDocumentQuery
): Promise<ConnectorDocument[]> {
  const { orgId, query: queryText, limit = 6 } = query;
  if (PROVIDERS.size === 0) return [];

  const results = await Promise.all(
    Array.from(PROVIDERS.values()).map((provider) =>
      provider.listDocuments({ orgId, query: queryText, limit }).catch(() => [] as ConnectorDocument[])
    )
  );

  const flat = results.flat().filter((doc) => doc.orgId === orgId);
  const queryWords = tokenize(queryText);

  return flat
    .map((doc) => ({ doc, score: overlapScore(queryWords, doc.title + " " + doc.content) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ doc }) => doc);
}

/**
 * Register a static list of documents as a local connector provider.
 * Used for demo fixtures and test data.
 */
export function registerLocalDocuments(docs: ConnectorDocument[]): void {
  registerConnectorProvider({
    connectorId: "local",
    listDocuments: async ({ orgId }) => docs.filter((d) => d.orgId === orgId),
  });
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function overlapScore(queryWords: Set<string>, docText: string): number {
  const docWords = tokenize(docText);
  let hits = 0;
  for (const word of queryWords) {
    if (docWords.has(word)) hits++;
  }
  return queryWords.size > 0 ? hits / queryWords.size : 0;
}
