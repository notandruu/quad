-- Company brain durable store. Requires the pgvector extension.
-- Run against the DATABASE_URL Postgres instance.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS brain_memory (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL,
  source_id   TEXT NOT NULL,
  source_type TEXT NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  summary     TEXT,
  entities    TEXT[] NOT NULL DEFAULT '{}',
  embedding   VECTOR(1536),
  confidence  REAL NOT NULL DEFAULT 0.5,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  evidence    JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brain_memory_org_idx ON brain_memory (org_id);
CREATE INDEX IF NOT EXISTS brain_memory_source_type_idx ON brain_memory (source_type);
CREATE INDEX IF NOT EXISTS brain_memory_permissions_idx ON brain_memory USING gin (permissions);

-- Approximate nearest neighbor index for retrieval.
CREATE INDEX IF NOT EXISTS brain_memory_embedding_idx
  ON brain_memory USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE TABLE IF NOT EXISTS quadchain_packets (
  id             TEXT PRIMARY KEY,
  org_id         TEXT NOT NULL,
  run_id         TEXT NOT NULL,
  packet_type    TEXT NOT NULL,
  producer       TEXT NOT NULL,
  consumer       TEXT NOT NULL,
  accepted       BOOLEAN NOT NULL DEFAULT false,
  visibility     TEXT NOT NULL DEFAULT 'internal',
  source_ids     TEXT[] NOT NULL DEFAULT '{}',
  certificate_id TEXT NOT NULL,
  packet         JSONB NOT NULL,
  certificate    JSONB NOT NULL,
  summary        JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quadchain_packets_org_run_idx ON quadchain_packets (org_id, run_id);
CREATE INDEX IF NOT EXISTS quadchain_packets_type_idx ON quadchain_packets (packet_type);
CREATE INDEX IF NOT EXISTS quadchain_packets_source_ids_idx ON quadchain_packets USING gin (source_ids);

CREATE TABLE IF NOT EXISTS workflow_run_snapshots (
  id                     TEXT PRIMARY KEY,
  org_id                 TEXT NOT NULL,
  workflow_kind          TEXT NOT NULL,
  status                 TEXT NOT NULL,
  title                  TEXT NOT NULL,
  target_url             TEXT,
  created_by             TEXT NOT NULL,
  approval_count         INTEGER NOT NULL DEFAULT 0,
  pending_approval_count INTEGER NOT NULL DEFAULT 0,
  receipt_count          INTEGER NOT NULL DEFAULT 0,
  artifact_count         INTEGER NOT NULL DEFAULT 0,
  snapshot               JSONB NOT NULL,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_run_snapshots_org_idx ON workflow_run_snapshots (org_id);
CREATE INDEX IF NOT EXISTS workflow_run_snapshots_status_idx ON workflow_run_snapshots (status);
CREATE INDEX IF NOT EXISTS workflow_run_snapshots_pending_idx ON workflow_run_snapshots (org_id, pending_approval_count);
CREATE INDEX IF NOT EXISTS workflow_run_snapshots_updated_idx ON workflow_run_snapshots (updated_at DESC);

-- First-class workflow ledger. The snapshot table above is retained as a
-- compact replay/cache record, while these tables make approvals, artifacts,
-- tasks, and receipts queryable without loading opaque JSON.
CREATE TABLE IF NOT EXISTS workflow_runs (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL,
  workflow_kind   TEXT NOT NULL,
  title           TEXT NOT NULL,
  status          TEXT NOT NULL,
  created_by      TEXT NOT NULL,
  target_url      TEXT,
  failure_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_runs_org_idx ON workflow_runs (org_id);
CREATE INDEX IF NOT EXISTS workflow_runs_status_idx ON workflow_runs (status);
CREATE INDEX IF NOT EXISTS workflow_runs_updated_idx ON workflow_runs (updated_at DESC);

CREATE TABLE IF NOT EXISTS workflow_tasks (
  id             TEXT PRIMARY KEY,
  run_id         TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  status         TEXT NOT NULL,
  owner          TEXT NOT NULL,
  depends_on     TEXT[] NOT NULL DEFAULT '{}',
  capability_id  TEXT,
  detail         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_tasks_run_idx ON workflow_tasks (run_id);
CREATE INDEX IF NOT EXISTS workflow_tasks_status_idx ON workflow_tasks (status);

CREATE TABLE IF NOT EXISTS workflow_artifacts (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  artifact_kind TEXT NOT NULL,
  title       TEXT NOT NULL,
  hash        TEXT NOT NULL,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_artifacts_run_idx ON workflow_artifacts (run_id);
CREATE INDEX IF NOT EXISTS workflow_artifacts_kind_idx ON workflow_artifacts (artifact_kind);

CREATE TABLE IF NOT EXISTS workflow_approvals (
  id                TEXT PRIMARY KEY,
  run_id            TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  artifact_id       TEXT NOT NULL,
  decision          TEXT NOT NULL,
  approver          TEXT,
  evidence_visible  BOOLEAN NOT NULL DEFAULT false,
  reason            TEXT NOT NULL,
  requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS workflow_approvals_run_idx ON workflow_approvals (run_id);
CREATE INDEX IF NOT EXISTS workflow_approvals_decision_idx ON workflow_approvals (decision);
CREATE INDEX IF NOT EXISTS workflow_approvals_pending_idx ON workflow_approvals (run_id, decision);

CREATE TABLE IF NOT EXISTS workflow_receipts (
  id             TEXT PRIMARY KEY,
  run_id         TEXT NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
  approval_id    TEXT,
  artifact_id    TEXT NOT NULL,
  status         TEXT NOT NULL,
  summary        TEXT NOT NULL,
  artifact_hash  TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workflow_receipts_run_idx ON workflow_receipts (run_id);
CREATE INDEX IF NOT EXISTS workflow_receipts_status_idx ON workflow_receipts (status);

CREATE TABLE IF NOT EXISTS connector_credentials (
  id                   TEXT PRIMARY KEY,
  org_id               TEXT NOT NULL,
  capability_id        TEXT NOT NULL,
  actor                TEXT NOT NULL,
  scopes               TEXT[] NOT NULL DEFAULT '{}',
  status               TEXT NOT NULL,
  credential_hash      TEXT NOT NULL,
  encrypted_credential TEXT NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS connector_credentials_org_idx ON connector_credentials (org_id);
CREATE INDEX IF NOT EXISTS connector_credentials_capability_idx ON connector_credentials (capability_id);
CREATE INDEX IF NOT EXISTS connector_credentials_status_idx ON connector_credentials (status);
