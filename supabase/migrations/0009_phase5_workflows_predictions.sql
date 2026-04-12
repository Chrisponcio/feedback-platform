-- ============================================================
-- Phase 5: Workflows, Predictions, Media Questions, Signage
-- ============================================================
SET search_path = public, extensions;

-- ============================================================
-- workflow_triggers — automated follow-up actions
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_triggers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT,
  survey_id        UUID REFERENCES surveys(id) ON DELETE SET NULL,
  -- trigger condition
  trigger_type     TEXT NOT NULL CHECK (trigger_type IN (
    'nps_detractor', 'nps_passive', 'nps_promoter',
    'csat_low', 'csat_high',
    'keyword_match', 'sentiment_negative',
    'response_created'
  )),
  condition        JSONB NOT NULL DEFAULT '{}',
  -- action config
  action_type      TEXT NOT NULL CHECK (action_type IN (
    'zendesk_ticket', 'slack_message', 'email_notification',
    'webhook', 'tag_response'
  )),
  action_config    JSONB NOT NULL DEFAULT '{}',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER workflow_triggers_updated_at
  BEFORE UPDATE ON workflow_triggers
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

ALTER TABLE workflow_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own org workflow triggers"
  ON workflow_triggers FOR SELECT
  USING (organization_id = current_organization_id());

CREATE POLICY "Admins can manage workflow triggers"
  ON workflow_triggers FOR ALL
  USING (organization_id = current_organization_id()
    AND current_org_role() IN ('owner', 'admin'));

CREATE POLICY "Service role full access on workflow_triggers"
  ON workflow_triggers FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- workflow_logs — execution log for audit trail
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  trigger_id       UUID NOT NULL REFERENCES workflow_triggers(id) ON DELETE CASCADE,
  response_id      UUID REFERENCES responses(id) ON DELETE SET NULL,
  status           TEXT NOT NULL CHECK (status IN ('success', 'failure', 'skipped')),
  result           JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_workflow_logs_trigger ON workflow_logs(trigger_id, created_at DESC);

ALTER TABLE workflow_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own org workflow logs"
  ON workflow_logs FOR SELECT
  USING (organization_id = current_organization_id());

CREATE POLICY "Service role full access on workflow_logs"
  ON workflow_logs FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- org_predictions — ML-derived churn/satisfaction predictions
-- ============================================================
CREATE TABLE IF NOT EXISTS org_predictions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prediction_type  TEXT NOT NULL CHECK (prediction_type IN (
    'churn_risk', 'satisfaction_trend', 'response_volume_forecast'
  )),
  score            NUMERIC(5,2) NOT NULL,          -- 0.00–100.00
  confidence       NUMERIC(3,2) NOT NULL DEFAULT 0.50, -- 0.00–1.00
  factors          JSONB NOT NULL DEFAULT '[]',    -- contributing factor breakdown
  period_start     DATE NOT NULL,
  period_end       DATE NOT NULL,
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_predictions_org_type
  ON org_predictions(organization_id, prediction_type, period_end DESC);

ALTER TABLE org_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own org predictions"
  ON org_predictions FOR SELECT
  USING (organization_id = current_organization_id());

CREATE POLICY "Service role full access on org_predictions"
  ON org_predictions FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- Add media support columns to questions
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'media_url'
  ) THEN
    ALTER TABLE questions ADD COLUMN media_url TEXT;
    ALTER TABLE questions ADD COLUMN media_type TEXT CHECK (
      media_type IS NULL OR media_type IN ('image', 'video', 'audio')
    );
  END IF;
END $$;

-- ============================================================
-- Add incentive code support to surveys
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'surveys' AND column_name = 'incentive_config'
  ) THEN
    ALTER TABLE surveys ADD COLUMN incentive_config JSONB;
    -- { enabled: true, code: "THANKS20", message: "Use code THANKS20 for 20% off!" }
  END IF;
END $$;

-- ============================================================
-- Add signage token to survey_distributions
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'survey_distributions' AND column_name = 'signage_config'
  ) THEN
    ALTER TABLE survey_distributions ADD COLUMN signage_config JSONB;
    -- { metric: 'nps', refresh_interval: 5, show_trend: true, theme: 'dark' }
  END IF;
END $$;

-- ============================================================
-- Add Realtime publication for workflow_logs
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE workflow_logs;
