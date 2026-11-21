-- ============================================================
-- Fix: profiles table had SELECT + UPDATE policies for regular
-- users, but no INSERT policy (only profiles_admin_all, which
-- requires is_admin()). This is harmless for normal signups
-- (the profile row is created by a SECURITY DEFINER trigger,
-- which bypasses RLS entirely) but breaks any client-side
-- .upsert() call, since Postgres requires the INSERT policy's
-- WITH CHECK to pass before it even considers the ON CONFLICT
-- UPDATE branch -- regardless of whether the row already exists.
--
-- The immediate bug (Settings page using .upsert() instead of
-- .update()) is fixed in application code. This migration closes
-- the underlying RLS gap so the same class of bug can't recur
-- from a different code path later.
-- ============================================================

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth_user_id());
