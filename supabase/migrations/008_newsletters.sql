-- ============================================================
-- NEWSLETTER SYSTEM
-- Campaign storage, per-recipient send tracking (for audit trail
-- and idempotency), and the marketing-consent field it relies on
-- (notification_preferences.marketing_emails, already exists).
-- ============================================================

CREATE TABLE IF NOT EXISTS newsletters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject TEXT NOT NULL,
  preheader TEXT DEFAULT '',
  from_name TEXT NOT NULL DEFAULT 'Finora',
  -- Structured content blocks (headline, intro, body sections, CTA) —
  -- stored as JSON so the composer can re-open and edit a draft, with
  -- html_snapshot capturing exactly what was actually sent.
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  html_snapshot TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
  recipient_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS newsletters_status_idx ON newsletters(status);
CREATE INDEX IF NOT EXISTS newsletters_created_at_idx ON newsletters(created_at DESC);

-- Per-recipient log. This is what makes "send to all" safe to retry:
-- a recipient already marked 'sent' is skipped on a re-run, and it's
-- a real audit trail of exactly who got what, when.
CREATE TABLE IF NOT EXISTS newsletter_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  newsletter_id UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped_unsubscribed')),
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (newsletter_id, email)
);

CREATE INDEX IF NOT EXISTS newsletter_recipients_newsletter_idx ON newsletter_recipients(newsletter_id);
CREATE INDEX IF NOT EXISTS newsletter_recipients_status_idx ON newsletter_recipients(status);

ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_recipients ENABLE ROW LEVEL SECURITY;

-- Admin-only. Newsletters are a founder/admin tool, not user-facing data.
-- (Sending itself is done via the admin/service-role client from the API
-- route, which bypasses RLS entirely — these policies cover direct
-- client access, e.g. if the admin app ever queries Supabase directly.)
CREATE POLICY "newsletters_admin_all" ON newsletters
  FOR ALL USING (is_admin());

CREATE POLICY "newsletter_recipients_admin_all" ON newsletter_recipients
  FOR ALL USING (is_admin());
