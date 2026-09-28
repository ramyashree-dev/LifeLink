/*
# LifeLink – Fix auth identities and auto-profile creation

1. Root cause of "Database error querying schema"
   - Migration 0002 inserted demo users directly into `auth.users`, bypassing GoTrue's normal signup flow.
   - This left `auth.identities` completely empty: 10 users in `auth.users`, 0 rows in `auth.identities`.
   - GoTrue requires every user to have at least one identity record. When it tries to sign up or sign in,
     it queries `auth.identities` and fails with "Database error querying schema" because the table is
     in an inconsistent state.
   - This blocked ALL sign-ups and sign-ins, including the real user priya@gmail.com.

2. Fix
   a) Backfill `auth.identities` with the missing email-provider identity for every existing demo user.
      Note: `email` is a generated column in `auth.identities`, so it is omitted from the INSERT.
   b) Add a trigger on `auth.users` that auto-creates a `public.profiles` row whenever a new auth user is
      created (via `signUp`). This makes the registration flow reliable: the profile always exists, even
      if the frontend insert fails or is skipped.
   c) The trigger reads `full_name` and `role` from `raw_user_meta_data` (which `signUp` populates via
      `options.data`), defaulting to 'requester' role and 'New member' name.

3. Safety
   - No user data is deleted.
   - Existing profiles are preserved (trigger only fires on INSERT, and checks NOT EXISTS).
   - Idempotent identity backfill (NOT EXISTS guard).
*/

-- Backfill missing auth.identities records for all existing users (email column is generated, omitted)
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT u.email, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', u.last_sign_in_at, u.created_at, u.updated_at
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = u.id);

-- Auto-create a public.profiles row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_role text;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'New member');
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'requester');
  IF v_role NOT IN ('donor','requester','hospital','admin') THEN
    v_role := 'requester';
  END IF;
  INSERT INTO public.profiles (user_id, role, full_name, email)
  VALUES (NEW.id, v_role, v_full_name, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for any existing auth users that somehow lack one
INSERT INTO public.profiles (user_id, role, full_name, email)
SELECT u.id, COALESCE((u.raw_user_meta_data->>'role'), 'requester'), COALESCE(u.raw_user_meta_data->>'full_name', 'New member'), u.email
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;
