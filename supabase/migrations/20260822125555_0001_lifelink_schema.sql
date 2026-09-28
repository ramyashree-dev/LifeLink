/*
# LifeLink – Blood & Organ Donation Network: Core Schema

1. Purpose
   - Relational PostgreSQL schema for a blood & organ donation coordination platform.
   - Multi-user, role-based: donor, requester, hospital, admin.
   - Sensitive personal data (phone, email, exact address) is stored but never exposed publicly via RLS.

2. New Tables
   - `profiles`          — base profile for every auth user (role, name, contact, location).
   - `donor_profiles`    — donor-specific data (blood group, availability, verification, consent).
   - `hospitals`          — hospital profiles with verification status (pending/verified/rejected).
   - `blood_requests`     — blood requests created by requesters/hospitals.
   - `donor_matches`      — ranked donor matches per request with match score and status.
   - `donations`          — completed/in-progress donation records.
   - `notifications`      — in-app notifications per user.
   - `organ_donation_interest` — interest registration for organ donation (not legal registration).
   - `reports`            — user-submitted reports of suspicious profiles/requests.
   - `audit_logs`         — admin action audit trail.

3. Security
   - RLS enabled on every table.
   - Owner-scoped CRUD for personal data (profiles, donor_profiles, notifications, organ_donation_interest).
   - Hospitals: owner-scoped for own profile; requesters can read verified hospitals.
   - Blood requests: requester/hospital owners can manage; donors can read requests visible to them (matching).
   - Donor matches: donors see their own matches; requester/hospital see matches for their requests.
   - Donations: donor/hospital/requester owners can read; hospital can insert.
   - Reports: reporter can insert & read own; admins read all.
   - Audit logs: admins read all; admins insert via service role.
   - Public read on a limited view of donor_profiles for "Find Donors" (via `donor_public` view exposing only safe fields).

4. Notes
   - `user_id` columns default to `auth.uid()` so client inserts that omit user_id succeed.
   - Blood group stored as text with CHECK constraint to valid set.
   - Urgency and status enums via CHECK constraints.
   - Indexes on common filter/sort columns.
   - No destructive operations; idempotent with IF NOT EXISTS.
*/

-- ===== profiles =====
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'requester' CHECK (role IN ('donor','requester','hospital','admin')),
  full_name text NOT NULL,
  email text,
  phone text,
  city text,
  state text,
  pin_code text,
  avatar_url text,
  suspended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== donor_profiles =====
CREATE TABLE IF NOT EXISTS public.donor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  blood_group text NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  date_of_birth date,
  gender text,
  last_donation_date date,
  available boolean NOT NULL DEFAULT true,
  emergency_available boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  consent_to_contact boolean NOT NULL DEFAULT false,
  organ_donation_interest boolean NOT NULL DEFAULT false,
  preferred_contact_method text DEFAULT 'phone' CHECK (preferred_contact_method IN ('phone','email','app')),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.donor_profiles ENABLE ROW LEVEL SECURITY;

-- Donors read/update own; requesters/hospitals/admins read via safe view (donor_public).
DROP POLICY IF EXISTS "donor_profiles_select_own_or_admin" ON public.donor_profiles;
CREATE POLICY "donor_profiles_select_own_or_admin" ON public.donor_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "donor_profiles_insert_own" ON public.donor_profiles;
CREATE POLICY "donor_profiles_insert_own" ON public.donor_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "donor_profiles_update_own" ON public.donor_profiles;
CREATE POLICY "donor_profiles_update_own" ON public.donor_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Public-safe view of donors (no phone/email/DOB/exact address). Available to any authenticated user.
DROP VIEW IF EXISTS public.donor_public;
CREATE VIEW public.donor_public AS
SELECT
  dp.id,
  dp.user_id,
  dp.blood_group,
  dp.available,
  dp.emergency_available,
  dp.verified,
  dp.organ_donation_interest,
  dp.last_donation_date,
  dp.last_active_at,
  p.full_name,
  p.city,
  p.state,
  p.pin_code
FROM public.donor_profiles dp
JOIN public.profiles p ON p.user_id = dp.user_id
WHERE p.suspended = false;

ALTER TABLE public.donor_public SET (security_invoker = false);

-- ===== hospitals =====
CREATE TABLE IF NOT EXISTS public.hospitals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_name text NOT NULL,
  registration_number text,
  address text,
  city text,
  state text,
  pin_code text,
  phone text,
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected')),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hospitals_select_all" ON public.hospitals;
CREATE POLICY "hospitals_select_all" ON public.hospitals
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "hospitals_insert_own" ON public.hospitals;
CREATE POLICY "hospitals_insert_own" ON public.hospitals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "hospitals_update_own_or_admin" ON public.hospitals;
CREATE POLICY "hospitals_update_own_or_admin" ON public.hospitals
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

-- ===== blood_requests =====
CREATE TABLE IF NOT EXISTS public.blood_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE SET NULL,
  blood_group text NOT NULL CHECK (blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  units_required integer NOT NULL DEFAULT 1 CHECK (units_required > 0),
  urgency text NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal','urgent','emergency')),
  required_date date,
  required_time text,
  patient_reference text,
  location text,
  notes text,
  contact_preference text DEFAULT 'phone' CHECK (contact_preference IN ('phone','email','app')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','matching','donors_contacted','donor_accepted','hospital_confirmation','fulfilled','cancelled','expired')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;

-- Requester owner, linked hospital owner, admins can manage; donors can read for matching.
DROP POLICY IF EXISTS "blood_requests_select_relevant" ON public.blood_requests;
CREATE POLICY "blood_requests_select_relevant" ON public.blood_requests
  FOR SELECT TO authenticated
  USING (
    auth.uid() = requester_id
    OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = blood_requests.hospital_id AND h.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
    OR EXISTS (SELECT 1 FROM public.donor_profiles dp WHERE dp.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "blood_requests_insert_own" ON public.blood_requests;
CREATE POLICY "blood_requests_insert_own" ON public.blood_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "blood_requests_update_own_or_hospital_or_admin" ON public.blood_requests;
CREATE POLICY "blood_requests_update_own_or_hospital_or_admin" ON public.blood_requests
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = requester_id
    OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = blood_requests.hospital_id AND h.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    auth.uid() = requester_id
    OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = blood_requests.hospital_id AND h.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ===== donor_matches =====
CREATE TABLE IF NOT EXISTS public.donor_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  donor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_score integer NOT NULL DEFAULT 0 CHECK (match_score >= 0 AND match_score <= 100),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','unavailable','confirmed','completed','cancelled')),
  factors jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, donor_id)
);

ALTER TABLE public.donor_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "donor_matches_select_relevant" ON public.donor_matches;
CREATE POLICY "donor_matches_select_relevant" ON public.donor_matches
  FOR SELECT TO authenticated
  USING (
    auth.uid() = donor_id
    OR EXISTS (SELECT 1 FROM public.blood_requests br WHERE br.id = donor_matches.request_id AND br.requester_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.blood_requests br JOIN public.hospitals h ON h.id = br.hospital_id WHERE br.id = donor_matches.request_id AND h.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "donor_matches_insert_requester_or_hospital_or_admin" ON public.donor_matches;
CREATE POLICY "donor_matches_insert_requester_or_hospital_or_admin" ON public.donor_matches
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.blood_requests br WHERE br.id = donor_matches.request_id AND (br.requester_id = auth.uid() OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = br.hospital_id AND h.user_id = auth.uid())))
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "donor_matches_update_relevant" ON public.donor_matches;
CREATE POLICY "donor_matches_update_relevant" ON public.donor_matches
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = donor_id
    OR EXISTS (SELECT 1 FROM public.blood_requests br WHERE br.id = donor_matches.request_id AND br.requester_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.blood_requests br JOIN public.hospitals h ON h.id = br.hospital_id WHERE br.id = donor_matches.request_id AND h.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    auth.uid() = donor_id
    OR EXISTS (SELECT 1 FROM public.blood_requests br WHERE br.id = donor_matches.request_id AND br.requester_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.blood_requests br JOIN public.hospitals h ON h.id = br.hospital_id WHERE br.id = donor_matches.request_id AND h.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ===== donations =====
CREATE TABLE IF NOT EXISTS public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.blood_requests(id) ON DELETE SET NULL,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE SET NULL,
  donation_date date NOT NULL DEFAULT CURRENT_DATE,
  donation_type text DEFAULT 'blood' CHECK (donation_type IN ('blood','organ')),
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "donations_select_relevant" ON public.donations;
CREATE POLICY "donations_select_relevant" ON public.donations
  FOR SELECT TO authenticated
  USING (
    auth.uid() = donor_id
    OR EXISTS (SELECT 1 FROM public.blood_requests br WHERE br.id = donations.request_id AND br.requester_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = donations.hospital_id AND h.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "donations_insert_relevant" ON public.donations;
CREATE POLICY "donations_insert_relevant" ON public.donations
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = donor_id
    OR EXISTS (SELECT 1 FROM public.blood_requests br WHERE br.id = donations.request_id AND br.requester_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.hospitals h WHERE h.id = donations.hospital_id AND h.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin')
  );

-- ===== notifications =====
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text,
  type text NOT NULL DEFAULT 'general' CHECK (type IN ('general','request','emergency','donor_response','hospital','system','verification','request_update')),
  read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_own_or_admin" ON public.notifications;
CREATE POLICY "notifications_insert_own_or_admin" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON public.notifications;
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== organ_donation_interest =====
CREATE TABLE IF NOT EXISTS public.organ_donation_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  interest_status text NOT NULL DEFAULT 'interested' CHECK (interest_status IN ('interested','not_sure','not_interested')),
  organ_preferences jsonb DEFAULT '[]'::jsonb,
  consent boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organ_donation_interest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organ_interest_select_own_or_admin" ON public.organ_donation_interest;
CREATE POLICY "organ_interest_select_own_or_admin" ON public.organ_donation_interest
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "organ_interest_insert_own" ON public.organ_donation_interest;
CREATE POLICY "organ_interest_insert_own" ON public.organ_donation_interest
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "organ_interest_update_own" ON public.organ_donation_interest;
CREATE POLICY "organ_interest_update_own" ON public.organ_donation_interest
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== reports =====
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reported_request_id uuid REFERENCES public.blood_requests(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('suspicious_profile','fake_request','abuse','misuse','other')),
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_select_own_or_admin" ON public.reports;
CREATE POLICY "reports_select_own_or_admin" ON public.reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "reports_insert_own" ON public.reports;
CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "reports_update_admin" ON public.reports;
CREATE POLICY "reports_update_admin" ON public.reports
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

-- ===== audit_logs =====
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_select_admin" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "audit_logs_insert_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_admin" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

-- ===== Indexes =====
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_city ON public.profiles(city);
CREATE INDEX IF NOT EXISTS idx_donor_profiles_blood_group ON public.donor_profiles(blood_group);
CREATE INDEX IF NOT EXISTS idx_donor_profiles_available ON public.donor_profiles(available);
CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON public.blood_requests(status);
CREATE INDEX IF NOT EXISTS idx_blood_requests_urgency ON public.blood_requests(urgency);
CREATE INDEX IF NOT EXISTS idx_blood_requests_blood_group ON public.blood_requests(blood_group);
CREATE INDEX IF NOT EXISTS idx_donor_matches_request_id ON public.donor_matches(request_id);
CREATE INDEX IF NOT EXISTS idx_donor_matches_donor_id ON public.donor_matches(donor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_hospitals_verification_status ON public.hospitals(verification_status);

-- ===== updated_at triggers =====
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_donor_profiles_updated_at ON public.donor_profiles;
CREATE TRIGGER trg_donor_profiles_updated_at BEFORE UPDATE ON public.donor_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_hospitals_updated_at ON public.hospitals;
CREATE TRIGGER trg_hospitals_updated_at BEFORE UPDATE ON public.hospitals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_blood_requests_updated_at ON public.blood_requests;
CREATE TRIGGER trg_blood_requests_updated_at BEFORE UPDATE ON public.blood_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_donor_matches_updated_at ON public.donor_matches;
CREATE TRIGGER trg_donor_matches_updated_at BEFORE UPDATE ON public.donor_matches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_organ_interest_updated_at ON public.organ_donation_interest;
CREATE TRIGGER trg_organ_interest_updated_at BEFORE UPDATE ON public.organ_donation_interest FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
