-- Secure public-safe view of donors (no phone/email/DOB/exact address/pin code).
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
  split_part(p.full_name, ' ', 1) as full_name,
  p.city,
  p.state
FROM public.donor_profiles dp
JOIN public.profiles p ON p.user_id = dp.user_id
WHERE p.suspended = false;

ALTER TABLE public.donor_public SET (security_invoker = false);

REVOKE ALL ON public.donor_public FROM anon;
GRANT SELECT ON public.donor_public TO authenticated;
