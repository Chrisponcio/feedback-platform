-- Phase 4: SSO config + geolocation support
-- ============================================================

SET search_path = public, extensions;

-- ============================================================
-- org_sso_configs — per-org SAML/OIDC SSO configuration
-- ============================================================
CREATE TABLE IF NOT EXISTS org_sso_configs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain              TEXT NOT NULL,           -- e.g. "acme.com" for signInWithSSO({ domain })
  provider_type       TEXT NOT NULL DEFAULT 'saml',
  metadata_url        TEXT,                    -- SAML metadata URL (preferred)
  metadata_xml        TEXT,                    -- raw SAML metadata XML (fallback)
  attribute_mapping   JSONB NOT NULL DEFAULT '{
    "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "first_name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
    "last_name": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"
  }',
  supabase_provider_id TEXT,                   -- SSO provider UUID from Supabase Auth admin API
  is_active           BOOLEAN NOT NULL DEFAULT false,  -- false until tested & confirmed
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id),
  UNIQUE(domain)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_org_sso_configs_updated_at') THEN
    CREATE TRIGGER handle_org_sso_configs_updated_at
      BEFORE UPDATE ON org_sso_configs
      FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
  END IF;
END$$;

ALTER TABLE org_sso_configs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_sso_configs' AND policyname = 'read_own_sso_config') THEN
    CREATE POLICY "read_own_sso_config"
      ON org_sso_configs FOR SELECT TO authenticated
      USING (organization_id = current_organization_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'org_sso_configs' AND policyname = 'service_role_sso_config') THEN
    CREATE POLICY "service_role_sso_config"
      ON org_sso_configs FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ============================================================
-- organization_members — add is_default for multi-org users
-- ============================================================
ALTER TABLE organization_members
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- responses — add geo column for geolocation tagging
-- ============================================================
ALTER TABLE responses
  ADD COLUMN IF NOT EXISTS geo JSONB;

-- Index for bounding-box queries (lat/lng stored inside geo JSONB)
CREATE INDEX IF NOT EXISTS idx_responses_geo ON responses USING gin(geo)
  WHERE geo IS NOT NULL;
