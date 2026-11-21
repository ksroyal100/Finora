-- 004_password_reset_completed_event.sql
--
-- Completes the password reset flow fix: now that users can actually set a
-- new password (see update-password/page.tsx), this lets them log that
-- completion themselves — same narrow, event-type-scoped pattern as 002/003.

CREATE POLICY "security_events_insert_own_password_reset" ON security_events
  FOR INSERT WITH CHECK (
    user_id = auth_user_id()
    AND event_type = 'password_reset_completed'
  );
