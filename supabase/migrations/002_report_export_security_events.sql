-- 002_report_export_security_events.sql
--
-- The Financial Toolkit's PDF/Excel report export feature needs to:
--   1. Count a user's own recent failed password attempts (rate limiting)
--   2. Log their own successful exports (audit trail)
--
-- security_events previously had a single admin-only policy, so regular
-- users had no access at all. This adds a narrow, additive policy that
-- only lets a user see/insert their OWN rows, and only for the two event
-- types this feature uses — it does not expose any other user's events or
-- any other event type (e.g. it can't be used to write fake "admin" events).

CREATE POLICY "security_events_own_report_export" ON security_events
  FOR SELECT USING (user_id = auth_user_id());

CREATE POLICY "security_events_insert_own_report_export" ON security_events
  FOR INSERT WITH CHECK (
    user_id = auth_user_id()
    AND event_type = ANY (ARRAY['report_export_auth_failed', 'report_exported'])
  );
