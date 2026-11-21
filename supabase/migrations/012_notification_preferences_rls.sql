-- ============================================================
-- Fix: notification_preferences had ROW LEVEL SECURITY enabled
-- (migration 001, line ~1971) but no policy was ever created for
-- it. With RLS on and no permissive policy, Postgres denies ALL
-- access by default for non-service-role connections — meaning
-- any direct client-side read or write to this table (e.g. a user
-- toggling their own newsletter subscription preference) would
-- silently fail or return zero rows, with no obvious error
-- pointing at the real cause. Same class of bug as the earlier
-- profiles.upsert() issue, just further upstream (missing policy
-- entirely, rather than missing one specific operation's policy).
-- ============================================================

CREATE POLICY "notification_preferences_read_own" ON notification_preferences
  FOR SELECT USING (user_id = auth_user_id() OR is_admin());

CREATE POLICY "notification_preferences_update_own" ON notification_preferences
  FOR UPDATE USING (user_id = auth_user_id())
  WITH CHECK (user_id = auth_user_id());

CREATE POLICY "notification_preferences_insert_own" ON notification_preferences
  FOR INSERT WITH CHECK (user_id = auth_user_id());
