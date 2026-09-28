/*
# Fix: infinite recursion in profiles RLS policy

## Root cause
The `profiles_select_own_or_admin` policy contains:
  EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role='admin')

This subquery hits the `profiles` table, which triggers the same RLS policy,
which contains the same subquery → infinite recursion. PostgreSQL detects
this and errors out. Any query whose RLS policy references `profiles` in an
EXISTS subquery (blood_requests, donor_profiles, donor_matches, donations,
hospitals, organ_donation_interest, reports, audit_logs, notifications)
fails silently from the client's perspective — the Supabase JS client
returns an error object, but the FindDonors component only checks
`r.data`, not `r.error`, so `activeRequests` stays empty and the user sees
"You need to create a blood request first."

## Fix
1. Create `public.is_admin()` SECURITY DEFINER function that reads profiles
   with RLS bypassed (owner = postgres, no recursion).
2. Create `public.is_suspended(uid uuid)` for the donor_profiles public policy.
3. Replace every `EXISTS (SELECT 1 FROM profiles p WHERE p.user_id = auth.uid() AND p.role='admin')`
   with `public.is_admin()`.
4. Replace the suspended check in donor_profiles with `public.is_suspended(...)`.

No data is changed.
*/

-- ===== helper functions (SECURITY DEFINER to bypass RLS, breaking recursion) =====

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_suspended(target_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT p.suspended FROM public.profiles p WHERE p.user_id = target_uid),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_suspended(uuid) TO authenticated, anon;

-- ===== profiles: fix recursive policy =====
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ===== donor_profiles: fix public-available policy (referenced profiles) =====
DROP POLICY IF EXISTS "donor_profiles_select_public_available" ON public.donor_profiles;
CREATE POLICY "donor_profiles_select_public_available" ON public.donor_profiles
  FOR SELECT TO authenticated
  USING (available = true AND NOT public.is_suspended(donor_profiles.user_id));

DROP POLICY IF EXISTS "donor_profiles_select_own_or_admin" ON public.donor_profiles;
CREATE POLICY "donor_profiles_select_own_or_admin" ON public.donor_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ===== blood_requests: replace profiles admin check =====
DROP POLICY IF EXISTS "blood_requests_select_relevant" ON public.blood_requests;
CREATE POLICY "blood_requests_select_relevant" ON public.blood_requests
  FOR SELECT TO authenticated
  USING (
    auth.uid() = requester_id
    OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = blood_requests.hospital_id AND h.user_id = auth.uid())
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.donor_profiles dp WHERE dp.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "blood_requests_update_own_or_hospital_or_admin" ON public.blood_requests;
CREATE POLICY "blood_requests_update_own_or_hospital_or_admin" ON public.blood_requests
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = requester_id
    OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = blood_requests.hospital_id AND h.user_id = auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = requester_id
    OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = blood_requests.hospital_id AND h.user_id = auth.uid())
    OR public.is_admin()
  );

-- ===== donor_matches: replace profiles admin check =====
DROP POLICY IF EXISTS "donor_matches_select_relevant" ON public.donor_matches;
CREATE POLICY "donor_matches_select_relevant" ON public.donor_matches
  FOR SELECT TO authenticated
  USING (
    auth.uid() = donor_id
    OR EXISTS (SELECT 1 FROM public.blood_requests br WHERE br.id = donor_matches.request_id AND br.requester_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.blood_requests br JOIN public.hospitals h ON h.id = br.hospital_id WHERE br.id = donor_matches.request_id AND h.user_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "donor_matches_insert_requester_or_hospital_or_admin" ON public.donor_matches;
CREATE POLICY "donor_matches_insert_requester_or_hospital_or_admin" ON public.donor_matches
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.blood_requests br WHERE br.id = donor_matches.request_id AND (br.requester_id = auth.uid() OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = br.hospital_id AND h.user_id = auth.uid())))
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "donor_matches_update_relevant" ON public.donor_matches;
CREATE POLICY "donor_matches_update_relevant" ON public.donor_matches
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = donor_id
    OR EXISTS (SELECT 1 FROM public.blood_requests br WHERE br.id = donor_matches.request_id AND br.requester_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.blood_requests br JOIN public.hospitals h ON h.id = br.hospital_id WHERE br.id = donor_matches.request_id AND h.user_id = auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    auth.uid() = donor_id
    OR EXISTS (SELECT 1 FROM public.blood_requests br WHERE br.id = donor_matches.request_id AND br.requester_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.blood_requests br JOIN public.hospitals h ON h.id = br.hospital_id WHERE br.id = donor_matches.request_id AND h.user_id = auth.uid())
    OR public.is_admin()
  );

-- ===== donations: replace profiles admin check =====
DROP POLICY IF EXISTS "donations_select_relevant" ON public.donations;
CREATE POLICY "donations_select_relevant" ON public.donations
  FOR SELECT TO authenticated
  USING (
    auth.uid() = donor_id
    OR EXISTS (SELECT 1 FROM public.blood_requests br WHERE br.id = donations.request_id AND br.requester_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = donations.hospital_id AND h.user_id = auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "donations_insert_relevant" ON public.donations;
CREATE POLICY "donations_insert_relevant" ON public.donations
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = donor_id
    OR EXISTS (SELECT 1 FROM public.blood_requests br WHERE br.id = donations.request_id AND br.requester_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = donations.hospital_id AND h.user_id = auth.uid())
    OR public.is_admin()
  );

-- ===== hospitals: replace profiles admin check =====
DROP POLICY IF EXISTS "hospitals_update_own_or_admin" ON public.hospitals;
CREATE POLICY "hospitals_update_own_or_admin" ON public.hospitals
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- ===== organ_donation_interest: replace profiles admin check =====
DROP POLICY IF EXISTS "organ_interest_select_own_or_admin" ON public.organ_donation_interest;
CREATE POLICY "organ_interest_select_own_or_admin" ON public.organ_donation_interest
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ===== reports: replace profiles admin check =====
DROP POLICY IF EXISTS "reports_select_own_or_admin" ON public.reports;
CREATE POLICY "reports_select_own_or_admin" ON public.reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.is_admin());

DROP POLICY IF EXISTS "reports_update_admin" ON public.reports;
CREATE POLICY "reports_update_admin" ON public.reports
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ===== audit_logs: replace profiles admin check =====
DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "audit_logs_insert_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_admin" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- ===== notifications: replace profiles admin check =====
DROP POLICY IF EXISTS "notifications_insert_own_or_admin" ON public.notifications;
CREATE POLICY "notifications_insert_own_or_admin" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR public.is_admin());
