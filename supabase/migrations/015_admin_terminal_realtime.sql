-- ============================================================
-- 015: Realtime change notifications for the admin Command Terminal
--
-- The terminal (/cc/terminal in the admin app) no longer polls. It loads once and
-- re-fetches only when one of these tables changes, via Supabase Realtime
-- (postgres_changes). Admin sessions receive events through your existing RLS
-- policies, all of which already include `is_admin()` for these tables.
--
-- Deliberately NOT published:
--   * profiles        - UPDATEd on every user activity (last_active_at); would flood
--                       Realtime. New signups are detected through `subscriptions`
--                       instead, because handle_new_user() inserts a free
--                       subscription row for every new user.
--   * platform_analytics - high-volume event stream.
--   * agent_tasks     - progress updates can be chatty, so it is not published and the
--                       terminal does not listen for it. Failed-task counts refresh with the
--                       next change or on Refresh. To make them instant, add the table:
--                         ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_tasks;
--                       AND add 'agent_tasks' to FEED_TABLES in the admin app's
--                       src/lib/useTerminalFeed.ts (the two lists must match: a listened-to
--                       table that is not published makes the whole channel error out).
--
-- Idempotent: safe to run more than once. To switch this off for a table:
--   ALTER PUBLICATION supabase_realtime DROP TABLE public.<table>;
-- ============================================================

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'subscriptions',          -- billing events + new signups (free sub created per user)
    'invoices',               -- payments
    'marketplace_orders',     -- marketplace sales / refunds
    'expenses',               -- accounting
    'revenue_metrics',        -- daily MRR/ARR snapshot written by the cron
    'security_events',        -- security alerts
    'agent_decisions',        -- approvals queue
    'user_feedback',          -- feedback / ratings
    'newsletter_subscribers'  -- newsletter growth
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH t IN ARRAY tables LOOP
    -- skip tables that don't exist in this environment, and ones already published
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t)
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
       )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
