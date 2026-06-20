export type SourceType =
  | "doc"
  | "meeting"
  | "website"
  | "slack"
  | "email"
  | "manual"
  | "audit";

export type BrainEvidence = {
  url?: string;
  documentId?: string;
  pageTitle?: string;
  quote?: string;
  selector?: string;
  screenshotUrl?: string;
};

/**
 * A single durable memory record in the company brain.
 * Stored in Postgres with the embedding indexed via pgvector.
 */
export type BrainMemory = {
  id: string;
  orgId: string;
  sourceId: string;
  sourceType: SourceType;
  title: string;
  content: string;
  summary?: string;
  entities: string[];
  embedding: number[];
  confidence: number;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  evidence: BrainEvidence[];
};

/**
 * Kali keeps two conceptual brains. The internal brain is what the
 * organization actually knows; the external brain is what the public can
 * understand. The product magic is comparing the two.
 */
export type BrainScope = "internal" | "external";

export const INTERNAL_SOURCE_TYPES: SourceType[] = [
  "doc",
  "meeting",
  "slack",
  "email",
  "manual",
];

export const EXTERNAL_SOURCE_TYPES: SourceType[] = ["website", "audit"];
