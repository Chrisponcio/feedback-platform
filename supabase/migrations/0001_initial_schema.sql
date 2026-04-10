-- ============================================================
-- Pulse — Initial Schema Migration
-- ============================================================
-- Conventions:
--   • All PKs: UUID DEFAULT gen_random_uuid()
--   • All tables: created_at + updated_at via moddatetime trigger
--   • Soft deletes: deleted_at TIMESTAMPTZ on mutable entities
--   • Every tenant-scoped table carries organization_id
--   • RLS enabled on every table; policies enforce org isolation
-- ============================================================

-- Make extension functions (moddatetime, gen_random_uuid, etc.) visible without schema prefix.
-- Supabase installs extensions in the `extensions` schema, not `public`.
SET search_path = public, extensions;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- full-text search on survey titles
CREATE EXTENSION IF NOT EXISTS "moddatetime";   -- auto-update updated_at
-- pgvector pre-enabled for Phase 4 AI embeddings:
-- CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- Helper: current org from JWT claim
-- ============================================================
CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid;
$$;

-- ============================================================
-- Helper: current role from JWT claim
-- ============================================================
CREATE OR REPLACE FUNCTION current_org_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$;

-- ============================================================
-- organizations
-- ============================================================
CREATE TABLE organizations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL UNIQUE,
  plan                  TEXT NOT NULL DEFAULT 'starter'
                          CHECK (plan IN ('starter', 'growth', 'enterprise')),
  settings              JSONB NOT NULL DEFAULT '{}',
  custom_domain         TEXT UNIQUE,
  saml_config           JSONB,
  saml_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
  max_users             INTEGER NOT NULL DEFAULT 5,
  max_responses_month   INTEGER NOT NULL DEFAULT 1000,
  trial_ends_at         TIMESTAMPTZ,
  subscription_id       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_custom_domain ON organizations(custom_domain)
  WHERE custom_domain IS NOT NULL;

CREATE TRIGGER handle_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Users can read their own org (org_id from JWT)
CREATE POLICY "org_members_select"
  ON organizations FOR SELECT TO authenticated
  USING (id = current_organization_id());

-- Only service role can insert/update/delete orgs
CREATE POLICY "service_role_all"
  ON organizations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- profiles (extends auth.users)
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  avatar_url  TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER handle_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_self_select"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_self_update"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- organization_members
-- ============================================================
CREATE TABLE organization_members (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('owner', 'admin', 'manager', 'viewer')),
  invited_by      UUID REFERENCES auth.users(id),
  invited_at      TIMESTAMPTZ,
  accepted_at     TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('pending', 'active', 'suspended')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

CREATE TRIGGER handle_org_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select"
  ON organization_members FOR SELECT TO authenticated
  USING (organization_id = current_organization_id());

CREATE POLICY "admin_manage_members"
  ON organization_members FOR ALL TO authenticated
  USING (
    organization_id = current_organization_id()
    AND current_org_role() IN ('owner', 'admin')
  )
  WITH CHECK (
    organization_id = current_organization_id()
    AND current_org_role() IN ('owner', 'admin')
  );

-- ============================================================
-- invitations
-- ============================================================
CREATE TABLE invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('admin', 'manager', 'viewer')),
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by      UUID NOT NULL REFERENCES auth.users(id),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_org ON invitations(organization_id);
CREATE INDEX idx_invitations_email ON invitations(email);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_invitations"
  ON invitations FOR ALL TO authenticated
  USING (
    organization_id = current_organization_id()
    AND current_org_role() IN ('owner', 'admin')
  )
  WITH CHECK (
    organization_id = current_organization_id()
    AND current_org_role() IN ('owner', 'admin')
  );

-- Service role can read invitations to validate tokens (anonymous invite accept flow)
CREATE POLICY "service_role_all_invitations"
  ON invitations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- locations
-- ============================================================
CREATE TABLE locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  address         TEXT,
  city            TEXT,
  state           TEXT,
  country         TEXT NOT NULL DEFAULT 'US',
  timezone        TEXT NOT NULL DEFAULT 'UTC',
  metadata        JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_locations_org ON locations(organization_id);

CREATE TRIGGER handle_locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON locations FOR SELECT TO authenticated
  USING (organization_id = current_organization_id());
CREATE POLICY "manager_insert" ON locations FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = current_organization_id()
    AND current_org_role() IN ('owner', 'admin', 'manager')
  );
CREATE POLICY "manager_update" ON locations FOR UPDATE TO authenticated
  USING (organization_id = current_organization_id() AND current_org_role() IN ('owner', 'admin', 'manager'))
  WITH CHECK (organization_id = current_organization_id() AND current_org_role() IN ('owner', 'admin', 'manager'));
CREATE POLICY "admin_delete" ON locations FOR DELETE TO authenticated
  USING (organization_id = current_organization_id() AND current_org_role() IN ('owner', 'admin'));

-- ============================================================
-- surveys
-- ============================================================
CREATE TABLE surveys (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id         UUID REFERENCES locations(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  description         TEXT,
  status              TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'paused', 'archived', 'closed')),
  survey_type         TEXT NOT NULL DEFAULT 'standard'
                        CHECK (survey_type IN ('standard', 'pulse', 'kiosk', 'onboarding')),
  language            TEXT NOT NULL DEFAULT 'en',
  branding            JSONB NOT NULL DEFAULT '{}',
  settings            JSONB NOT NULL DEFAULT '{}',
  starts_at           TIMESTAMPTZ,
  ends_at             TIMESTAMPTZ,
  response_limit      INTEGER,
  allow_anonymous     BOOLEAN NOT NULL DEFAULT TRUE,
  require_login       BOOLEAN NOT NULL DEFAULT FALSE,
  one_response_per    TEXT CHECK (one_response_per IN ('session', 'user', 'device')),
  thank_you_message   TEXT,
  redirect_url        TEXT,
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_surveys_org ON surveys(organization_id);
CREATE INDEX idx_surveys_org_status ON surveys(organization_id, status) WHERE deleted_at IS NULL;
-- GIN index for full-text search on title
CREATE INDEX idx_surveys_title_trgm ON surveys USING gin(title gin_trgm_ops);

CREATE TRIGGER handle_surveys_updated_at
  BEFORE UPDATE ON surveys
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON surveys FOR SELECT TO authenticated
  USING (organization_id = current_organization_id());
CREATE POLICY "manager_insert" ON surveys FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = current_organization_id()
    AND current_org_role() IN ('owner', 'admin', 'manager')
  );
CREATE POLICY "manager_update" ON surveys FOR UPDATE TO authenticated
  USING (organization_id = current_organization_id() AND current_org_role() IN ('owner', 'admin', 'manager'))
  WITH CHECK (organization_id = current_organization_id() AND current_org_role() IN ('owner', 'admin', 'manager'));
CREATE POLICY "admin_delete" ON surveys FOR DELETE TO authenticated
  USING (organization_id = current_organization_id() AND current_org_role() IN ('owner', 'admin'));
CREATE POLICY "service_role_all" ON surveys FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- questions
-- ============================================================
CREATE TABLE questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN (
                    'nps', 'csat', 'ces', 'smiley', 'emoji_rating', 'star_rating',
                    'multiple_choice', 'checkbox', 'open_text',
                    'number_scale', 'date', 'email_capture', 'phone_capture', 'section_header'
                  )),
  title           TEXT NOT NULL,
  description     TEXT,
  is_required     BOOLEAN NOT NULL DEFAULT FALSE,
  position        INTEGER NOT NULL,
  settings        JSONB NOT NULL DEFAULT '{}',
  logic           JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE NULLS NOT DISTINCT (survey_id, position)
);

CREATE INDEX idx_questions_survey ON questions(survey_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_questions_org ON questions(organization_id);

CREATE TRIGGER handle_questions_updated_at
  BEFORE UPDATE ON questions
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON questions FOR SELECT TO authenticated
  USING (organization_id = current_organization_id());
CREATE POLICY "manager_insert" ON questions FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_organization_id() AND current_org_role() IN ('owner', 'admin', 'manager'));
CREATE POLICY "manager_update" ON questions FOR UPDATE TO authenticated
  USING (organization_id = current_organization_id() AND current_org_role() IN ('owner', 'admin', 'manager'))
  WITH CHECK (organization_id = current_organization_id() AND current_org_role() IN ('owner', 'admin', 'manager'));
CREATE POLICY "admin_delete" ON questions FOR DELETE TO authenticated
  USING (organization_id = current_organization_id() AND current_org_role() IN ('owner', 'admin'));
CREATE POLICY "service_role_all" ON questions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- survey_distributions
-- ============================================================
CREATE TABLE survey_distributions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL CHECK (channel IN (
                    'kiosk', 'email', 'sms', 'qr_code', 'web_embed', 'web_link', 'api'
                  )),
  name            TEXT,
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  config          JSONB NOT NULL DEFAULT '{}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  response_count  INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_distributions_survey ON survey_distributions(survey_id);
CREATE INDEX idx_distributions_org ON survey_distributions(organization_id);
CREATE INDEX idx_distributions_token ON survey_distributions(token);

CREATE TRIGGER handle_distributions_updated_at
  BEFORE UPDATE ON survey_distributions
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE survey_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON survey_distributions FOR SELECT TO authenticated
  USING (organization_id = current_organization_id());
CREATE POLICY "manager_insert" ON survey_distributions FOR INSERT TO authenticated
  WITH CHECK (organization_id = current_organization_id() AND current_org_role() IN ('owner', 'admin', 'manager'));
CREATE POLICY "manager_update" ON survey_distributions FOR UPDATE TO authenticated
  USING (organization_id = current_organization_id() AND current_org_role() IN ('owner', 'admin', 'manager'))
  WITH CHECK (organization_id = current_organization_id() AND current_org_role() IN ('owner', 'admin', 'manager'));
CREATE POLICY "service_role_all" ON survey_distributions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Helper function to safely increment response_count
CREATE OR REPLACE FUNCTION increment_distribution_count(dist_id UUID)
RETURNS VOID LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE survey_distributions
  SET response_count = response_count + 1
  WHERE id = dist_id;
$$;

-- ============================================================
-- responses
-- ============================================================
CREATE TABLE responses (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id           UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  distribution_id     UUID REFERENCES survey_distributions(id) ON DELETE SET NULL,
  location_id         UUID REFERENCES locations(id) ON DELETE SET NULL,
  respondent_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_anonymous        BOOLEAN NOT NULL DEFAULT TRUE,
  is_complete         BOOLEAN NOT NULL DEFAULT FALSE,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  duration_seconds    INTEGER,
  channel             TEXT NOT NULL CHECK (channel IN (
                        'kiosk', 'email', 'sms', 'qr_code', 'web_embed', 'web_link', 'api'
                      )),
  device_type         TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop', 'kiosk', 'unknown')),
  browser             TEXT,
  os                  TEXT,
  ip_hash             TEXT,
  session_id          TEXT UNIQUE,   -- kiosk offline dedup key
  language            TEXT NOT NULL DEFAULT 'en',
  metadata            JSONB NOT NULL DEFAULT '{}',
  respondent_email    TEXT,          -- AES-256 encrypted at application layer
  respondent_phone    TEXT,          -- AES-256 encrypted at application layer
  respondent_name     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Core analytics indexes
CREATE INDEX idx_responses_survey ON responses(survey_id);
CREATE INDEX idx_responses_org ON responses(organization_id);
CREATE INDEX idx_responses_org_created ON responses(organization_id, created_at DESC);
CREATE INDEX idx_responses_distribution ON responses(distribution_id);
-- Partial index for kiosk dedup — session_id is only set for kiosk responses
CREATE INDEX idx_responses_session ON responses(session_id) WHERE session_id IS NOT NULL;

ALTER TABLE responses ENABLE ROW LEVEL SECURITY;

-- Managers+ can read responses
CREATE POLICY "org_isolation_select" ON responses FOR SELECT TO authenticated
  USING (organization_id = current_organization_id());
-- Service role writes all responses (no user auth on submission)
CREATE POLICY "service_role_all" ON responses FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- response_answers
-- ============================================================
CREATE TABLE response_answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id     UUID NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id       UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  -- Typed value columns — only one populated per answer type
  value_numeric   NUMERIC(10, 2),
  value_text      TEXT,
  value_boolean   BOOLEAN,
  value_json      JSONB,
  -- Denormalized for fast aggregation without join back to questions
  question_type   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(response_id, question_id)
);

CREATE INDEX idx_answers_response ON response_answers(response_id);
CREATE INDEX idx_answers_question ON response_answers(question_id);
CREATE INDEX idx_answers_org_question ON response_answers(organization_id, question_id);
CREATE INDEX idx_answers_survey ON response_answers(survey_id);
-- Hot path: NPS aggregation queries
CREATE INDEX idx_answers_nps ON response_answers(survey_id, value_numeric)
  WHERE question_type = 'nps';
-- Hot path: CSAT aggregation queries
CREATE INDEX idx_answers_csat ON response_answers(survey_id, value_numeric)
  WHERE question_type = 'csat';

ALTER TABLE response_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON response_answers FOR SELECT TO authenticated
  USING (organization_id = current_organization_id());
CREATE POLICY "service_role_all" ON response_answers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- response_tags (Phase 4 — AI sentiment)
-- ============================================================
CREATE TABLE response_tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id     UUID NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  answer_id       UUID REFERENCES response_answers(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tag             TEXT NOT NULL,
  tag_type        TEXT NOT NULL CHECK (tag_type IN ('sentiment', 'topic', 'intent', 'custom')),
  confidence      NUMERIC(4, 3) CHECK (confidence BETWEEN 0 AND 1),
  source          TEXT NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'manual', 'rule')),
  model_version   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_response_tags_response ON response_tags(response_id);
CREATE INDEX idx_response_tags_org_tag ON response_tags(organization_id, tag);

ALTER TABLE response_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON response_tags FOR SELECT TO authenticated
  USING (organization_id = current_organization_id());
CREATE POLICY "service_role_all" ON response_tags FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- pulse_schedules (Phase 4 — employee pulse)
-- ============================================================
CREATE TABLE pulse_schedules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id           UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'paused', 'completed')),
  frequency           TEXT NOT NULL
                        CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly')),
  day_of_week         INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  day_of_month        INTEGER CHECK (day_of_month BETWEEN 1 AND 31),
  send_time           TIME NOT NULL DEFAULT '09:00:00',
  timezone            TEXT NOT NULL DEFAULT 'UTC',
  audience_config     JSONB NOT NULL DEFAULT '{}',
  channels            TEXT[] NOT NULL DEFAULT '{email}',
  next_run_at         TIMESTAMPTZ,
  last_run_at         TIMESTAMPTZ,
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pulse_schedules_org ON pulse_schedules(organization_id);
CREATE INDEX idx_pulse_next_run ON pulse_schedules(next_run_at) WHERE status = 'active';

CREATE TRIGGER handle_pulse_schedules_updated_at
  BEFORE UPDATE ON pulse_schedules
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE pulse_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON pulse_schedules FOR SELECT TO authenticated
  USING (organization_id = current_organization_id());
CREATE POLICY "admin_manage" ON pulse_schedules FOR ALL TO authenticated
  USING (organization_id = current_organization_id() AND current_org_role() IN ('owner', 'admin'))
  WITH CHECK (organization_id = current_organization_id() AND current_org_role() IN ('owner', 'admin'));

-- ============================================================
-- report_snapshots
-- ============================================================
CREATE TABLE report_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id       UUID REFERENCES surveys(id) ON DELETE CASCADE,
  location_id     UUID REFERENCES locations(id) ON DELETE SET NULL,
  snapshot_type   TEXT NOT NULL CHECK (snapshot_type IN ('daily', 'weekly', 'monthly', 'custom')),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  metrics         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_snapshots_org_survey ON report_snapshots(organization_id, survey_id);
CREATE INDEX idx_snapshots_period ON report_snapshots(period_start, period_end);

ALTER TABLE report_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_select" ON report_snapshots FOR SELECT TO authenticated
  USING (organization_id = current_organization_id());
CREATE POLICY "service_role_all" ON report_snapshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- audit_logs (append-only)
-- ============================================================
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id),
  action          TEXT NOT NULL,
  resource_type   TEXT NOT NULL,
  resource_id     UUID,
  old_value       JSONB,
  new_value       JSONB,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_org ON audit_logs(organization_id, created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Any org member can read their org's audit log
CREATE POLICY "org_isolation_select" ON audit_logs FOR SELECT TO authenticated
  USING (organization_id = current_organization_id());
-- Only service role can insert (application layer controls this)
CREATE POLICY "service_role_insert" ON audit_logs FOR INSERT TO service_role
  WITH CHECK (true);

-- ============================================================
-- Realtime: enable publications for live dashboard
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE responses;
ALTER PUBLICATION supabase_realtime ADD TABLE response_answers;

-- ============================================================
-- Storage buckets
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('org-assets',     'org-assets',     true,  5242880,  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']),
  ('survey-assets',  'survey-assets',  true,  10485760, ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('reports',        'reports',        false, 52428800, ARRAY['application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  ('kiosk-bundles',  'kiosk-bundles',  false, 10485760, ARRAY['application/json'])
ON CONFLICT DO NOTHING;

-- Storage RLS: org-assets — public read, org-scoped write
CREATE POLICY "public_read_org_assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'org-assets');

CREATE POLICY "org_upload_assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('org-assets', 'survey-assets')
    AND (storage.foldername(name))[1] = current_organization_id()::text
  );

-- Storage RLS: reports — org-scoped read only
CREATE POLICY "org_read_reports"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] = current_organization_id()::text
  );
