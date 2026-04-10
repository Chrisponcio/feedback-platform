-- Development seed data
-- Run with: supabase db reset
-- Only for local development — never runs in production

-- Note: Auth users are created via Supabase Dashboard or the API.
-- This seed creates org + member records assuming a pre-existing user with ID below.

-- To use: replace the placeholder UUID with the actual user ID from `supabase status`

DO $$
DECLARE
  v_org_id UUID := gen_random_uuid();
BEGIN
  -- Insert demo organization
  INSERT INTO organizations (id, name, slug, plan, settings)
  VALUES (
    v_org_id,
    'Acme Corp',
    'acme',
    'growth',
    '{"logo_url": null, "primary_color": "#2563eb", "timezone": "America/New_York"}'
  )
  ON CONFLICT (slug) DO NOTHING;

  -- Insert demo location
  INSERT INTO locations (organization_id, name, city, state, country, timezone)
  VALUES
    (v_org_id, 'Main Office', 'New York', 'NY', 'US', 'America/New_York'),
    (v_org_id, 'West Coast HQ', 'San Francisco', 'CA', 'US', 'America/Los_Angeles')
  ON CONFLICT DO NOTHING;

  -- Insert demo survey
  INSERT INTO surveys (
    organization_id,
    title,
    status,
    survey_type,
    language,
    branding,
    settings,
    thank_you_message
  )
  VALUES (
    v_org_id,
    'Customer Satisfaction Survey',
    'active',
    'standard',
    'en',
    '{"primary_color": "#2563eb", "show_progress_bar": true}',
    '{"auto_advance": true, "auto_advance_delay_ms": 500}',
    'Thank you for your feedback! We really appreciate it.'
  )
  ON CONFLICT DO NOTHING;
END $$;
