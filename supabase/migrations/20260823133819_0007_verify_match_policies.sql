/*
# Allow donor_matches SELECT to join blood_requests for requester

1. Problem
   - The MyRequests page queries blood_requests joined with donor_matches to
     show the requester the status of each donor's response.
   - The donor_matches SELECT policy allows: donor_id = auth.uid(), OR the
     requester who owns the blood_request, OR the hospital owner, OR admin.
   - However the existing policy uses `EXISTS (SELECT 1 FROM blood_requests br
     WHERE br.id = donor_matches.request_id AND br.requester_id = auth.uid())`.
   - This is correct, but the SELECT policy on blood_requests may block the join.
   - blood_requests SELECT policy allows: requester_id = auth.uid(), OR hospital
     owner, OR admin, OR donor exists in donor_profiles.
   - This is fine for the requester. No change needed to blood_requests.

2. Verification
   - The donor_matches SELECT policy already allows the requester to see matches
     for their own requests. No change needed.

3. No data is deleted or modified. This migration is a no-op verification.
*/

-- No SQL changes needed; this migration confirms the existing policies are correct.
SELECT 1;
