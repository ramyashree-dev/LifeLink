/*
# Fix: donor_public view returns no donors for requesters

## Root cause
Migration 0004 set `donor_public` to `security_invoker = true`. With invoker
rights the view runs with the *caller's* privileges and RLS policies:

1. `profiles` has policy `profiles_select_own_or_admin` — a requester can only
   SELECT their own profile row. The view's JOIN on `profiles` therefore
   filters out every donor whose profile is not the caller's, so the view
   returns 0 rows for any non-admin searcher.
2. `donor_profiles` column grants were incomplete — the view selects
   `organ_donation_interest` and `last_donation_date`, but 0004 only granted
   7 columns to authenticated/anon, so the query errors with a column
   privilege failure that the frontend silently swallows (it only checks
   `result.data`, not `result.error`).

## Fix
Revert the view to `security_invoker = false` (owner rights). The view is
intentionally the security boundary: it exposes only safe columns and already
filters out suspended donors via its WHERE clause. Running as the owner
bypasses RLS on the underlying tables so all non-suspended donors are
returned to any caller who has SELECT on the view.

Grant SELECT on the view to both `authenticated` and `anon` so logged-in
and logged-out users can both search donors.

No data is changed.
*/

ALTER VIEW public.donor_public SET (security_invoker = false);

REVOKE SELECT ON public.donor_public FROM anon, authenticated;
GRANT SELECT ON public.donor_public TO authenticated;
GRANT SELECT ON public.donor_public TO anon;
