-- ==============================================================
-- FINORA — Admin User Setup
-- Run in: Supabase Dashboard → SQL Editor
--
-- Step 1: Sign up normally via the admin app (localhost:3002)
-- Step 2: Copy your user UUID from:
--         Supabase → Authentication → Users → click your user → copy ID
-- Step 3: Paste your UUID below and run this SQL
-- ==============================================================

-- ── REPLACE THIS with your actual user UUID ──────────────────
DO $$
DECLARE
  v_user_id UUID := 'PASTE-YOUR-USER-UUID-HERE';  -- ← change this
BEGIN

  -- Validate the user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'User % not found in auth.users. Check the UUID.', v_user_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'User % not found in profiles. Did the signup trigger run?', v_user_id;
  END IF;

  -- Grant admin role on profile
  UPDATE profiles
  SET role = 'admin'
  WHERE id = v_user_id;

  -- Create admin_users row (super_admin = full access)
  INSERT INTO admin_users (
    id,
    user_id,
    admin_role,
    is_founder,
    is_active,
    two_factor_required,
    two_factor_verified,
    permissions,
    allowed_modules
  )
  VALUES (
    v_user_id,
    v_user_id,
    'super_admin',          -- full access: super_admin | founder | admin | analyst | moderator | support
    true,                   -- is_founder: set false if not the project founder
    true,                   -- is_active
    false,                  -- two_factor_required: set true in production
    true,                   -- two_factor_verified: pre-verified for dev
    '{
      "view_analytics": true,
      "manage_users": true,
      "manage_subscriptions": true,
      "manage_content": true,
      "manage_marketplace": true,
      "access_command_center": true,
      "manage_agents": true,
      "view_financials": true,
      "system_settings": true
    }'::jsonb,
    ARRAY['analytics','users','subscriptions','content','marketplace','ai','agents','financials','settings']
  )
  ON CONFLICT (id) DO UPDATE SET
    admin_role          = EXCLUDED.admin_role,
    is_founder          = EXCLUDED.is_founder,
    is_active           = EXCLUDED.is_active,
    two_factor_verified = EXCLUDED.two_factor_verified,
    permissions         = EXCLUDED.permissions,
    allowed_modules     = EXCLUDED.allowed_modules;

  RAISE NOTICE '✅ Admin access granted to user %', v_user_id;
  RAISE NOTICE '   Role: super_admin | is_founder: true | 2FA: bypassed for dev';

END $$;
