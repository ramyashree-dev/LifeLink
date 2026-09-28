/*
# LifeLink – Security hardening

1. View security
   - Make `donor_public` use invoker rights instead of owner rights.
   - Grant authenticated users only the safe donor columns needed for search.
   - Revoke direct access to private donor columns and keep row filtering on available, non-suspended donors.
2. Function security
   - Pin `set_updated_at` to the public schema to prevent search-path shadowing.
3. Notes
   - No user data is deleted or changed.
*/

ALTER VIEW public.donor_public SET (security_invoker = true);

DROP POLICY IF EXISTS "donor_profiles_select_public_available" ON public.donor_profiles;
CREATE POLICY "donor_profiles_select_public_available" ON public.donor_profiles
  FOR SELECT TO authenticated
  USING (
    available = true
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = donor_profiles.user_id AND p.suspended = false)
  );

REVOKE SELECT ON public.donor_profiles FROM anon, authenticated;
GRANT SELECT (id, user_id, blood_group, available, emergency_available, verified, last_active_at) ON public.donor_profiles TO authenticated;
GRANT SELECT (id, user_id, blood_group, available, emergency_available, verified, last_active_at) ON public.donor_profiles TO anon;
GRANT SELECT ON public.donor_public TO authenticated;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
