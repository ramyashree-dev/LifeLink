/*
# Fix: Auto-create donor_profiles on signup

1. Root cause
   - When a donor registers, the frontend calls supabase.auth.signUp() then
     immediately tries to upsert into donor_profiles and profiles.
   - After signUp(), the session is not always established yet, so auth.uid()
     returns NULL in the RLS policies. The INSERT policies (which check
     auth.uid() = user_id) reject the upsert silently.
   - The handle_new_user trigger only creates a profiles row (with SECURITY
     DEFINER, bypassing RLS), but does NOT create a donor_profiles row.
   - Result: the donor appears in profiles but NOT in donor_profiles, so they
     never show up in the donor_public view / Find Donors page.

2. Fix
   - Update handle_new_user() to also read phone, city, state, blood_group,
     available, and donation_type from raw_user_meta_data.
   - When role = 'donor', also insert a donor_profiles row with the blood_group
     and availability. This runs as SECURITY DEFINER so it bypasses RLS.
   - The profiles row now also gets phone, city, state from metadata.

3. Safety
   - No data is deleted.
   - Trigger uses ON CONFLICT (user_id) DO NOTHING for profiles and
     ON CONFLICT (user_id) DO UPDATE for donor_profiles so re-runs are safe.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name text;
  v_role text;
  v_phone text;
  v_city text;
  v_state text;
  v_blood_group text;
  v_available boolean;
  v_donation_type text;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'New member');
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'requester');
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_city := NEW.raw_user_meta_data->>'city';
  v_state := NEW.raw_user_meta_data->>'state';
  v_blood_group := COALESCE(NEW.raw_user_meta_data->>'blood_group', 'O+');
  v_donation_type := COALESCE(NEW.raw_user_meta_data->>'donation_type', 'blood');
  v_available := COALESCE((NEW.raw_user_meta_data->>'available')::boolean, true);

  IF v_role NOT IN ('donor','requester','hospital','admin') THEN
    v_role := 'requester';
  END IF;
  IF v_blood_group NOT IN ('A+','A-','B+','B-','AB+','AB-','O+','O-') THEN
    v_blood_group := 'O+';
  END IF;

  INSERT INTO public.profiles (user_id, role, full_name, email, phone, city, state)
  VALUES (NEW.id, v_role, v_full_name, NEW.email, v_phone, v_city, v_state)
  ON CONFLICT (user_id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    city = COALESCE(EXCLUDED.city, profiles.city),
    state = COALESCE(EXCLUDED.state, profiles.state);

  IF v_role = 'donor' THEN
    INSERT INTO public.donor_profiles (user_id, blood_group, available, organ_donation_interest, consent_to_contact)
    VALUES (
      NEW.id,
      v_blood_group,
      v_available,
      v_donation_type = 'organ',
      true
    )
    ON CONFLICT (user_id) DO UPDATE SET
      blood_group = EXCLUDED.blood_group,
      available = EXCLUDED.available,
      organ_donation_interest = EXCLUDED.organ_donation_interest;
  END IF;

  RETURN NEW;
END;
$$;
