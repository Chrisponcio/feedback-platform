-- Phase 3: api_keys, outbound_webhooks, alert_rules
-- ============================================================

SET search_path = public, extensions;

-- ============================================================
-- api_keys
-- ============================================================
CREATE TABLE api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  key_hash        TEXT NOT NULL UNIQUE,          -- bcrypt hash of the raw key
  key_prefix      TEXT NOT NULL,                 -- first 8 chars for display (e.g. "pk_live_")
  scopes          TEXT[] NOT NULL DEFAULT '{"read"}',
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_api_keys"
  ON api_keys FOR ALL TO authenticated
  USING (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());

CREATE POLICY "service_role_api_keys"
  ON api_keys FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- outbound_webhooks
-- ============================================================
CREATE TABLE outbound_webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL,
  secret          TEXT,                          -- HMAC signing secret
  events          TEXT[] NOT NULL DEFAULT '{"response.created"}',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  failure_count   INTEGER NOT NULL DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER handle_outbound_webhooks_updated_at
  BEFORE UPDATE ON outbound_webhooks
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE INDEX idx_webhooks_org ON outbound_webhooks(organization_id);

ALTER TABLE outbound_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_webhooks"
  ON outbound_webhooks FOR ALL TO authenticated
  USING (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());

CREATE POLICY "service_role_webhooks"
  ON outbound_webhooks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- alert_rules
-- ============================================================
CREATE TABLE alert_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  survey_id       UUID REFERENCES surveys(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  metric          TEXT NOT NULL CHECK (metric IN ('nps', 'csat', 'response_count', 'completion_rate')),
  condition       TEXT NOT NULL CHECK (condition IN ('lt', 'lte', 'gt', 'gte', 'eq')),
  threshold       NUMERIC NOT NULL,
  window_hours    INTEGER NOT NULL DEFAULT 24,
  channels        JSONB NOT NULL DEFAULT '{}',   -- { "email": true, "slack": "webhook_url" }
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  last_value      NUMERIC,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER handle_alert_rules_updated_at
  BEFORE UPDATE ON alert_rules
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE INDEX idx_alert_rules_org ON alert_rules(organization_id);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_alert_rules"
  ON alert_rules FOR ALL TO authenticated
  USING (organization_id = current_organization_id())
  WITH CHECK (organization_id = current_organization_id());

CREATE POLICY "service_role_alert_rules"
  ON alert_rules FOR ALL TO service_role
  USING (true) WITH CHECK (true);
