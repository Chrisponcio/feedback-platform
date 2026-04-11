-- Phase 4: AI sentiment — pgvector, response_tags, pending_ai_jobs
-- ============================================================

SET search_path = public, extensions;

-- Enable pgvector (pre-provisioned on Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add columns to response_tags if they don't already exist
-- (response_tags was created in 0001 without AI fields)
ALTER TABLE response_tags
  ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS topics          TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS summary         TEXT,
  ADD COLUMN IF NOT EXISTS embedding       vector(1536),
  ADD COLUMN IF NOT EXISTS model_version   TEXT NOT NULL DEFAULT 'gpt-4o-mini';

-- Vector similarity index for semantic search (only if embedding col was just added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'response_tags' AND indexname = 'idx_response_tags_embedding'
  ) THEN
    CREATE INDEX idx_response_tags_embedding
      ON response_tags USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100);
  END IF;
END$$;

-- ============================================================
-- pending_ai_jobs — queue for async AI processing
-- ============================================================
CREATE TABLE IF NOT EXISTS pending_ai_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  response_id     UUID NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text_value      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_pending
  ON pending_ai_jobs(status, created_at) WHERE status = 'pending';

ALTER TABLE pending_ai_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pending_ai_jobs' AND policyname = 'service_role_ai_jobs'
  ) THEN
    CREATE POLICY "service_role_ai_jobs"
      ON pending_ai_jobs FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END$$;
