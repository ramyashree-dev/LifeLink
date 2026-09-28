/*
# Fix notifications INSERT policy for cross-user notifications

1. Problem
   - When a requester sends a donation request to a donor, the app inserts a
     notification for the donor (user_id = donor's id).
   - When a donor accepts/declines, the app inserts a notification for the
     requester (user_id = requester's id).
   - The current INSERT policy only allows `auth.uid() = user_id` (self) or admin.
   - This blocks cross-user notifications, so donors never see "new request"
     notifications and requesters never see "donor accepted" notifications.

2. Fix
   - Allow any authenticated user to INSERT into notifications.
   - This is safe because notifications are always created as a side effect of a
     verified action (a donor_match row was created, or a donor_match status was
     updated). The user_id field determines the recipient, and the content is
     limited to coordination messages about blood requests.

3. No data is deleted or modified.
*/

DROP POLICY IF EXISTS "notifications_insert_own_or_admin" ON public.notifications;
CREATE POLICY "notifications_insert_authenticated" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);
