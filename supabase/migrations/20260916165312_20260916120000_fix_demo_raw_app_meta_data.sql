/*
# Fix demo auth: populate raw_app_meta_data

1. Root cause of "Database error querying schema"
   - Migration 0002 inserted demo users directly into auth.users, bypassing GoTrue's signUp flow.
   - This left raw_app_meta_data as empty jsonb `{}` for all demo users.
   - Real users created via supabase.auth.signUp() get raw_app_meta_data = {"provider":"email","providers":["email"]}.
   - GoTrue's signInWithPassword reads raw_app_meta_data to locate the auth provider.
   - When it is empty, GoTrue cannot resolve the provider and fails with "Database error querying schema".

2. Fix
   - Set raw_app_meta_data to {"provider":"email","providers":["email"]} for all users
     whose raw_app_meta_data is empty `{}`.
   - This matches what GoTrue normally sets during signUp.

3. Safety
   - Only touches users with empty raw_app_meta_data (the demo users inserted via SQL).
   - Real users already have correct metadata and are not affected.
   - No user data is deleted.
*/

UPDATE auth.users
SET raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
    updated_at = now()
WHERE raw_app_meta_data = '{}'::jsonb;