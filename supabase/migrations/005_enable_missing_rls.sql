-- 005_enable_missing_rls.sql
--
-- Fixes Engineering Audit finding C-1: 20 tables had Row Level Security
-- disabled entirely, with no RLS and no compensating REVOKE/GRANT
-- statements anywhere in the schema. Since backend routes already use
-- createAdminClient() (service role, bypasses RLS) for anything that needs
-- broad access, and the frontend already scopes queries with .eq('user_id',
-- userId) as a second layer (verified in the audit), this migration should
-- not change any in-app behavior — it closes the gap for anyone bypassing
-- the app and hitting the Supabase REST API directly with just an anon or
-- user JWT.
--
-- Categorized by actual data sensitivity, not a blanket policy:

-- ── Public catalog/content (safe to read, nothing user-specific) ───────
-- These are content tables — course catalogs, achievement definitions,
-- plan pricing — the app already displays to any signed-in user. RLS is
-- still turned ON (never "off") so future columns added to these tables
-- don't accidentally become world-writable by default.
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements_public_read" ON achievements FOR SELECT USING (true);

ALTER TABLE learning_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "learning_categories_public_read" ON learning_categories FOR SELECT USING (true);

ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "learning_paths_public_read" ON learning_paths FOR SELECT USING (true);

ALTER TABLE learning_path_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "learning_path_courses_public_read" ON learning_path_courses FOR SELECT USING (true);

ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quizzes_public_read" ON quizzes FOR SELECT USING (true);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quiz_questions_public_read" ON quiz_questions FOR SELECT USING (true);
-- Note: quiz_questions typically includes correct_answer — if quizzes are
-- meant to be un-cheatable, consider serving questions through a backend
-- route (service role, answer stripped) instead of direct client reads.
-- Flagging this as a product decision, not something to silently change.

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription_plans_public_read" ON subscription_plans FOR SELECT USING (true);

-- ── User-owned records (scoped to the owning user only) ────────────────
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_achievements_own" ON user_achievements FOR SELECT USING (user_id = auth_user_id());
CREATE POLICY "user_achievements_own_insert" ON user_achievements FOR INSERT WITH CHECK (user_id = auth_user_id());

ALTER TABLE reputation_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reputation_points_own" ON reputation_points FOR SELECT USING (user_id = auth_user_id());

ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "event_attendees_own" ON event_attendees FOR SELECT USING (user_id = auth_user_id());
CREATE POLICY "event_attendees_own_write" ON event_attendees FOR ALL USING (user_id = auth_user_id());

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "referrals_own" ON referrals FOR SELECT USING (referrer_id = auth_user_id() OR referred_id = auth_user_id());

-- ── Creator-owned (marketplace) ─────────────────────────────────────────
ALTER TABLE marketplace_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplace_analytics_own" ON marketplace_analytics FOR SELECT USING (creator_id = auth_user_id());
CREATE POLICY "marketplace_analytics_admin" ON marketplace_analytics FOR ALL USING (is_admin());

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupons_own" ON coupons FOR SELECT USING (creator_id = auth_user_id());
CREATE POLICY "coupons_admin" ON coupons FOR ALL USING (is_admin());
-- Deliberately no public/anon read policy — coupon code validation at
-- checkout should go through a backend route (service role), not a direct
-- client-side table read, or every valid code becomes enumerable.

-- ── Admin/internal only — no direct end-user access at all ─────────────
-- These hold business-sensitive or system-internal data (admin identity,
-- AI agent internals, revenue figures, infrastructure metrics, and admin
-- voice-agent sessions — confirmed these are internal admin tooling data,
-- not end-user conversations, by checking the actual schema before writing
-- this policy rather than assuming).
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_users_admin_only" ON admin_users FOR ALL USING (is_admin());

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agents_admin_only" ON agents FOR ALL USING (is_admin());

ALTER TABLE agent_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_decisions_admin_only" ON agent_decisions FOR ALL USING (is_admin());

ALTER TABLE agent_memory_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agent_memory_index_admin_only" ON agent_memory_index FOR ALL USING (is_admin());

ALTER TABLE revenue_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "revenue_metrics_admin_only" ON revenue_metrics FOR ALL USING (is_admin());

ALTER TABLE infrastructure_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "infrastructure_metrics_admin_only" ON infrastructure_metrics FOR ALL USING (is_admin());

ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voice_sessions_admin_only" ON voice_sessions FOR ALL USING (is_admin());

ALTER TABLE voice_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "voice_transcripts_admin_only" ON voice_transcripts FOR ALL USING (is_admin());
