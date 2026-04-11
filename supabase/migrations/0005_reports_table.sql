-- Phase 3b: custom reports builder
-- ============================================================

SET search_path = public, extensions;

-- ============================================================
-- reports — saved custom report definitions
-- ============================================================
CREATE TABLE reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT 'Untitled Report',
  description     TEXT,
  survey_id       UUID REFERENCES surveys(id) ON DELETE SET NULL,
  created_by      UUID REFERENCES auth.users(id),
  last_exported_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE TRIGGER handle_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE INDEX idx_reports_org ON reports(organization_id);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_reports"
  ON reports FOR ALL TO authenticated
  USING (organization_id = current_organization_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = current_organization_id());

CREATE POLICY "service_role_reports"
  ON reports FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- report_sections — ordered sections within a report
-- ============================================================
CREATE TABLE report_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('chart', 'metric', 'table', 'text')),
  position    INTEGER NOT NULL DEFAULT 0,
  config      JSONB NOT NULL DEFAULT '{}',
  -- config examples:
  --   chart:  { "chartType": "nps_trend"|"response_trend", "days": 30 }
  --   metric: { "metric": "nps"|"csat"|"response_count"|"completion_rate", "days": 30 }
  --   table:  { "limit": 50, "columns": ["created_at","channel","is_complete"] }
  --   text:   { "content": "Markdown string" }
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER handle_report_sections_updated_at
  BEFORE UPDATE ON report_sections
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

CREATE INDEX idx_report_sections_report ON report_sections(report_id, position);

ALTER TABLE report_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation_report_sections"
  ON report_sections FOR ALL TO authenticated
  USING (report_id IN (
    SELECT id FROM reports WHERE organization_id = current_organization_id() AND deleted_at IS NULL
  ))
  WITH CHECK (report_id IN (
    SELECT id FROM reports WHERE organization_id = current_organization_id() AND deleted_at IS NULL
  ));

CREATE POLICY "service_role_report_sections"
  ON report_sections FOR ALL TO service_role
  USING (true) WITH CHECK (true);
