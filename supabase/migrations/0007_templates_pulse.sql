-- Phase 4: survey templates + pulse schedules
-- Uses IF NOT EXISTS guards — tables may already exist from 0001
-- ============================================================

SET search_path = public, extensions;

-- ============================================================
-- survey_templates — reusable survey templates (org-owned or system)
-- ============================================================
CREATE TABLE IF NOT EXISTS survey_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  survey_type     TEXT NOT NULL DEFAULT 'nps',
  is_system       BOOLEAN NOT NULL DEFAULT false,
  template_data   JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'handle_survey_templates_updated_at') THEN
    CREATE TRIGGER handle_survey_templates_updated_at
      BEFORE UPDATE ON survey_templates
      FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_templates_org ON survey_templates(organization_id);

ALTER TABLE survey_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'survey_templates' AND policyname = 'read_system_or_own_templates') THEN
    CREATE POLICY "read_system_or_own_templates"
      ON survey_templates FOR SELECT TO authenticated
      USING (is_system = true OR organization_id = current_organization_id());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'survey_templates' AND policyname = 'manage_own_templates') THEN
    CREATE POLICY "manage_own_templates"
      ON survey_templates FOR INSERT TO authenticated
      WITH CHECK (organization_id = current_organization_id() AND is_system = false);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'survey_templates' AND policyname = 'service_role_templates') THEN
    CREATE POLICY "service_role_templates"
      ON survey_templates FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
END$$;

-- ============================================================
-- pulse_schedules — add columns that may be missing
-- ============================================================
ALTER TABLE pulse_schedules
  ADD COLUMN IF NOT EXISTS anonymity_mode BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cron_expression TEXT;

-- ============================================================
-- Seed system templates (skip if already seeded)
-- ============================================================
INSERT INTO survey_templates (name, description, survey_type, is_system, template_data)
SELECT * FROM (VALUES
(
  'Net Promoter Score (NPS)',
  'Standard NPS survey with follow-up open-text question',
  'nps',
  true,
  '{
    "settings": { "title": "How likely are you to recommend us?", "language": "en", "thank_you_message": "Thank you for your feedback!", "redirect_url": "", "response_limit": null },
    "questions": [
      { "type": "nps", "title": "On a scale of 0–10, how likely are you to recommend us to a friend or colleague?", "description": null, "is_required": true, "position": 0, "settings": {} },
      { "type": "open_text", "title": "What is the main reason for your score?", "description": null, "is_required": false, "position": 1, "settings": {} }
    ]
  }'::jsonb
),
(
  'Customer Satisfaction (CSAT)',
  'Quick CSAT check with optional comment',
  'csat',
  true,
  '{
    "settings": { "title": "How satisfied are you?", "language": "en", "thank_you_message": "Thank you for your feedback!", "redirect_url": "", "response_limit": null },
    "questions": [
      { "type": "csat", "title": "How satisfied are you with our service today?", "description": null, "is_required": true, "position": 0, "settings": {} },
      { "type": "open_text", "title": "What could we do better?", "description": null, "is_required": false, "position": 1, "settings": {} }
    ]
  }'::jsonb
),
(
  'Product Feedback',
  'Multi-question product feedback with star rating and NPS',
  'mixed',
  true,
  '{
    "settings": { "title": "Product Feedback", "language": "en", "thank_you_message": "Your feedback helps us improve!", "redirect_url": "", "response_limit": null },
    "questions": [
      { "type": "star_rating", "title": "How would you rate the product overall?", "description": null, "is_required": true, "position": 0, "settings": { "scale_min": 1, "scale_max": 5 } },
      { "type": "nps", "title": "How likely are you to recommend this product?", "description": null, "is_required": true, "position": 1, "settings": {} },
      { "type": "open_text", "title": "What would make this product a 10/10 for you?", "description": null, "is_required": false, "position": 2, "settings": {} }
    ]
  }'::jsonb
),
(
  'Employee Pulse',
  'Weekly employee engagement check-in (anonymised)',
  'pulse',
  true,
  '{
    "settings": { "title": "Weekly Pulse Check", "language": "en", "thank_you_message": "Thank you — your responses are anonymous.", "redirect_url": "", "response_limit": null },
    "questions": [
      { "type": "smiley", "title": "How are you feeling this week?", "description": null, "is_required": true, "position": 0, "settings": {} },
      { "type": "nps", "title": "How likely are you to recommend this company as a great place to work?", "description": null, "is_required": true, "position": 1, "settings": {} },
      { "type": "open_text", "title": "Is there anything you''d like to share with leadership this week?", "description": "Optional — your response is completely anonymous.", "is_required": false, "position": 2, "settings": {} }
    ]
  }'::jsonb
),
(
  'Event Feedback',
  'Post-event satisfaction survey',
  'event',
  true,
  '{
    "settings": { "title": "Event Feedback", "language": "en", "thank_you_message": "Thanks for attending!", "redirect_url": "", "response_limit": null },
    "questions": [
      { "type": "star_rating", "title": "How would you rate today''s event overall?", "description": null, "is_required": true, "position": 0, "settings": { "scale_min": 1, "scale_max": 5 } },
      { "type": "nps", "title": "Would you recommend this event to a colleague?", "description": null, "is_required": true, "position": 1, "settings": {} },
      { "type": "open_text", "title": "What was your biggest takeaway?", "description": null, "is_required": false, "position": 2, "settings": {} }
    ]
  }'::jsonb
)
) AS t(name, description, survey_type, is_system, template_data)
WHERE NOT EXISTS (SELECT 1 FROM survey_templates WHERE is_system = true AND name = t.name);
