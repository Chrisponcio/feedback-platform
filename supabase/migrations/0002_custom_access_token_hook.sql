-- ============================================================
-- Custom Access Token Hook
-- ============================================================
-- Called by Supabase Auth on every JWT issuance (login, signup,
-- token refresh). Enriches app_metadata with the user's active
-- organization_id and role so middleware + RLS policies can read
-- them without an extra DB round-trip.
--
-- Multi-org note: Phase 1 uses the user's single primary org
-- (highest-privilege role, then oldest membership). Phase 4 adds
-- org-switching by re-issuing the JWT with a new organization_id.
--
-- After applying this migration, activate the hook in:
-- Supabase Dashboard → Authentication → Hooks →
--   "Custom Access Token" → select public.custom_access_token_hook
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims          jsonb;
  v_organization_id uuid;
  v_role          text;
BEGIN
  -- Look up the user's primary active membership.
  -- Priority: owner > admin > manager > viewer, then oldest membership.
  SELECT om.organization_id, om.role
    INTO v_organization_id, v_role
    FROM public.organization_members om
   WHERE om.user_id   = (event ->> 'user_id')::uuid
     AND om.status    = 'active'
     AND om.deleted_at IS NULL
   ORDER BY
     CASE om.role
       WHEN 'owner'   THEN 1
       WHEN 'admin'   THEN 2
       WHEN 'manager' THEN 3
       WHEN 'viewer'  THEN 4
       ELSE                5
     END,
     om.created_at ASC
   LIMIT 1;

  claims := event -> 'claims';

  IF v_organization_id IS NOT NULL THEN
    claims := jsonb_set(
      claims,
      '{app_metadata}',
      COALESCE(claims -> 'app_metadata', '{}'::jsonb) ||
        jsonb_build_object(
          'organization_id', v_organization_id,
          'role',            v_role
        )
    );
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Only supabase_auth_admin may invoke this function
GRANT   EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE  EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
