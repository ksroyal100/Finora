-- 003_account_deletion_security_events.sql
--
-- Additive policy (does not modify or replace 002's policy) letting a user
-- log their own account-deletion-related security events — used for the
-- password re-verification rate limit on account deletion, the same pattern
-- already used for report exports in 002.

CREATE POLICY "security_events_insert_own_account_deletion" ON security_events
  FOR INSERT WITH CHECK (
    user_id = auth_user_id()
    AND event_type = ANY (ARRAY['account_deletion_auth_failed', 'account_deleted'])
  );
