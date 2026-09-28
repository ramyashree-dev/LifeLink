/*
# LifeLink – Demo auth users

1. Purpose
   - Create demo accounts (admin, donors, requesters, hospitals) in auth.users so the app can be logged into and demo data can reference real user IDs.
   - Passwords are bcrypt-hashed via pgcrypto. All demo accounts share password: Demo1234!
   - Idempotent: only inserts users that do not already exist (by email).

2. Notes
   - Email confirmation is bypassed (email_confirmed_at set) so login works immediately.
   - These are fictional demo accounts, clearly marked via email domain @lifelink.demo.
*/

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
SELECT '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', lower(email), crypt('Demo1234!', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb
FROM (VALUES
  ('admin@lifelink.demo'),
  ('donor1@lifelink.demo'),
  ('donor2@lifelink.demo'),
  ('donor3@lifelink.demo'),
  ('donor4@lifelink.demo'),
  ('donor5@lifelink.demo'),
  ('donor6@lifelink.demo'),
  ('requester@lifelink.demo'),
  ('hospital@lifelink.demo'),
  ('hospital2@lifelink.demo')
) AS t(email)
WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.email = lower(t.email));
