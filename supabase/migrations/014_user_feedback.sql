-- ============================================================
-- USER FEEDBACK (star rating + review)
--
-- Deliberately one-directional: any authenticated user can submit
-- feedback, but RLS blocks SELECT entirely for non-admins — not
-- even a user's own submissions are readable back to them. This
-- matches "shows up only in admin, not to other users" exactly:
-- there's no read path for regular users at all, so there's
-- nothing to accidentally leak between users either.
-- ============================================================

CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review TEXT,
  context TEXT, -- which page/feature the feedback was given from, e.g. 'dashboard', 'ai-coach'
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_feedback_rating_idx ON user_feedback(rating);
CREATE INDEX IF NOT EXISTS user_feedback_created_at_idx ON user_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS user_feedback_status_idx ON user_feedback(status);

ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can submit their own feedback...
CREATE POLICY "user_feedback_insert_own" ON user_feedback
  FOR INSERT WITH CHECK (user_id = auth_user_id());

-- ...but only admins can ever read it back. No "read own" policy exists
-- on purpose — this is intentionally one-way.
CREATE POLICY "user_feedback_admin_read" ON user_feedback
  FOR SELECT USING (is_admin());

CREATE POLICY "user_feedback_admin_update" ON user_feedback
  FOR UPDATE USING (is_admin());
