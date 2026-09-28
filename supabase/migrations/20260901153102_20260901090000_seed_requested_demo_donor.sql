/*
# Add the requested donor demo account

1. Purpose
- The sign-in page promises a donor demo account at donor@lifelink.demo.
- Earlier demo data used donor1@lifelink.demo for the seeded donor, so the requested email did not exist in authentication and its button could not sign in.

2. Authentication
- Create donor@lifelink.demo in Supabase Auth only when it is missing.
- Use the existing fictional demo password `Demo1234!` and mark the email confirmed, matching the existing demo-account architecture.
- Add the required email identity record so password authentication can establish a normal Supabase session.

3. Profile data
- Create or repair the matching public profile with the donor role and complete demo contact/location fields.
- Create or repair the donor profile with blood group, availability, emergency availability, verification, consent, and donation-history fields required by the donor dashboard.

4. Safety
- This migration is idempotent and does not delete users or change real-user accounts.
- Existing records for donor@lifelink.demo are preserved where possible; only the requested demo account's fictional role/profile fields are normalized.
- No RLS policies are changed. The account uses the existing authenticated policies.
*/

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'donor@lifelink.demo';

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id,
      'authenticated', 'authenticated', 'donor@lifelink.demo',
      crypt('Demo1234!', gen_salt('bf')),
      now(), now(), now(),
      '{}'::jsonb,
      '{"full_name":"Donor Demo","role":"donor"}'::jsonb
    );
  END IF;

  INSERT INTO auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    'donor@lifelink.demo', v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', 'donor@lifelink.demo', 'email_verified', true),
    'email', NULL, now(), now()
  )
  ON CONFLICT (provider_id, provider) DO NOTHING;

  INSERT INTO public.profiles (
    user_id, role, full_name, email, phone, city, state, pin_code
  ) VALUES (
    v_user_id, 'donor', 'Donor Demo', 'donor@lifelink.demo',
    '+919811100000', 'Bengaluru', 'Karnataka', '560001'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role = 'donor',
    full_name = 'Donor Demo',
    email = 'donor@lifelink.demo',
    phone = COALESCE(public.profiles.phone, '+919811100000'),
    city = COALESCE(public.profiles.city, 'Bengaluru'),
    state = COALESCE(public.profiles.state, 'Karnataka'),
    pin_code = COALESCE(public.profiles.pin_code, '560001');

  INSERT INTO public.donor_profiles (
    user_id, blood_group, date_of_birth, gender, last_donation_date,
    available, emergency_available, verified, consent_to_contact,
    organ_donation_interest, preferred_contact_method
  ) VALUES (
    v_user_id, 'O+', '1994-06-15', 'unspecified', '2025-01-15',
    true, true, true, true, false, 'app'
  )
  ON CONFLICT (user_id) DO UPDATE SET
    blood_group = COALESCE(public.donor_profiles.blood_group, 'O+'),
    available = true,
    emergency_available = true,
    verified = true,
    consent_to_contact = true,
    preferred_contact_method = COALESCE(public.donor_profiles.preferred_contact_method, 'app');
END $$;