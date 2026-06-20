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

-- Approximate nearest neighbor index for retrieval.
CREATE INDEX IF NOT EXISTS brain_memory_embedding_idx
  ON brain_memory USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
