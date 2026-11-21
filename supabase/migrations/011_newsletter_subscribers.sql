-- ============================================================
-- NEWSLETTER SUBSCRIBERS (anonymous / pre-signup)
--
-- The landing page's newsletter signup form only ever updated
-- local React state and showed a fake "You're in!" message — it
-- never called an API or wrote anywhere, which is exactly why
-- nothing showed up in the database or the admin subscriber
-- count. That's fixed in application code; this table is what it
-- now actually writes to.
--
-- This is intentionally separate from notification_preferences,
-- which is keyed to an authenticated profiles.id — a landing-page
-- visitor typically doesn't have an account yet. Sending logic
-- treats both sources as one deduplicated-by-email recipient list.
-- ============================================================

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed')),
  source TEXT DEFAULT 'landing_page',
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_status_idx ON newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS newsletter_subscribers_email_idx ON newsletter_subscribers(email);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- No public read/write via the client — all access goes through the
-- public subscribe API route and admin routes, both using the
-- service-role client, which bypasses RLS. This table has no direct
-- client-side Supabase access at all.
CREATE POLICY "newsletter_subscribers_admin_only" ON newsletter_subscribers
  FOR ALL USING (is_admin());
