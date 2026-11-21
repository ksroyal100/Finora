-- ==============================================================
-- FINORA — Complete Database Schema (Idempotent)
-- Safe to run multiple times. Run in: Supabase → SQL Editor
-- ==============================================================

-- Make auth, extensions schemas visible to all statements
SET search_path TO public, auth, extensions;

-- ── EXTENSIONS ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ── ENUMS (safe: wrapped in DO blocks to skip if already exist)
DO $$ BEGIN CREATE TYPE subscription_plan AS ENUM ('free', 'pro', 'plus', 'elite'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'trialing', 'paused', 'incomplete'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE billing_interval AS ENUM ('monthly', 'yearly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'void', 'uncollectible'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_type AS ENUM ('system', 'billing', 'subscription', 'community', 'marketplace', 'learning', 'research', 'goal', 'portfolio', 'ai_coach', 'security', 'admin', 'agent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'push'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('user', 'creator', 'moderator', 'admin', 'super_admin', 'founder'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE kyc_status AS ENUM ('none', 'pending', 'verified', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE asset_class AS ENUM ('stock', 'etf', 'crypto', 'bond', 'real_estate', 'commodity', 'cash', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE transaction_type AS ENUM ('buy', 'sell', 'dividend', 'split', 'transfer', 'deposit', 'withdrawal'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE goal_status AS ENUM ('active', 'completed', 'paused', 'abandoned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE goal_category AS ENUM ('emergency_fund', 'retirement', 'home', 'education', 'vacation', 'business', 'investment', 'debt_payoff', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE asset_type AS ENUM ('cash', 'investment', 'real_estate', 'business', 'vehicle', 'personal', 'retirement', 'crypto', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE liability_type AS ENUM ('mortgage', 'auto_loan', 'student_loan', 'credit_card', 'personal_loan', 'medical', 'tax', 'other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE budget_period AS ENUM ('weekly', 'monthly', 'yearly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE post_status AS ENUM ('draft', 'published', 'flagged', 'removed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE course_status AS ENUM ('draft', 'published', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE marketplace_category AS ENUM ('investing', 'real_estate', 'startups', 'ai', 'software', 'business', 'templates', 'courses', 'research_reports', 'ai_prompt_packs', 'services', 'jobs', 'deals', 'acquisitions'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE product_status AS ENUM ('draft', 'pending_review', 'published', 'archived', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE order_status AS ENUM ('pending', 'processing', 'completed', 'refunded', 'disputed', 'canceled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payout_status AS ENUM ('pending', 'processing', 'paid', 'failed', 'canceled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE agent_name AS ENUM ('jarvis', 'athena', 'orion', 'titan', 'phoenix', 'merlin', 'sentinel'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE agent_status AS ENUM ('idle', 'thinking', 'working', 'waiting', 'error', 'offline'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE task_status AS ENUM ('pending', 'assigned', 'in_progress', 'completed', 'failed', 'canceled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical', 'urgent'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE workflow_status AS ENUM ('draft', 'running', 'paused', 'completed', 'failed', 'canceled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE admin_role AS ENUM ('super_admin', 'founder', 'admin', 'analyst', 'moderator', 'support'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;



-- ======= 001_core_schema.sql =======
-- ============================================================
-- FINORA CORE SCHEMA — Migration 001
-- Users, Profiles, Subscriptions, Billing, Notifications
-- ============================================================

-- Enable extensions

-- ── ENUMS ────────────────────────────────────────────────────


-- ── PROFILES TABLE ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT UNIQUE,
  display_name TEXT,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  website TEXT,
  location TEXT,
  timezone TEXT DEFAULT 'UTC',
  currency TEXT DEFAULT 'USD',
  country_code CHAR(2) DEFAULT 'US',
  role user_role DEFAULT 'user',
  kyc_status kyc_status DEFAULT 'none',
  is_creator BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  is_banned BOOLEAN DEFAULT FALSE,
  banned_at TIMESTAMPTZ,
  banned_reason TEXT,
  referral_code TEXT UNIQUE DEFAULT upper(substring(gen_random_uuid()::TEXT, 1, 8)),
  referred_by UUID REFERENCES profiles(id),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  onboarding_step INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_idx ON profiles(email);
CREATE INDEX IF NOT EXISTS profiles_username_idx ON profiles(username);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);
CREATE INDEX IF NOT EXISTS profiles_referral_code_idx ON profiles(referral_code);
CREATE INDEX IF NOT EXISTS profiles_referred_by_idx ON profiles(referred_by);

-- ── SUBSCRIPTION PLANS TABLE ─────────────────────────────────

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name subscription_plan NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
  price_yearly DECIMAL(10,2) NOT NULL DEFAULT 0,
  stripe_price_monthly_id TEXT,
  stripe_price_yearly_id TEXT,
  stripe_product_id TEXT,
  features JSONB NOT NULL DEFAULT '[]',
  limits JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default plan data
INSERT INTO subscription_plans (name, display_name, description, price_monthly, price_yearly, features, limits, sort_order) VALUES
('free', 'Free', 'Get started with wealth creation', 0, 0,
  '["Basic Dashboard","Portfolio Tracking (up to 5 assets)","Goal Tracking (up to 3 goals)","Community Access","Learning Hub (free courses only)","AI Coach (3 queries/week)","Basic Analytics"]',
  '{"ai_queries_per_week":3,"portfolio_assets":5,"goals":3,"budget_categories":5,"marketplace_purchases":true,"research_access":false,"marketplace_free_only":false}',
  0),
('pro', 'Pro', 'For serious wealth builders', 19, 190,
  '["Everything in Free","Unlimited Portfolio Tracking","Unlimited Goals","Advanced Analytics","AI Coach (unlimited)","Research Center Access","Marketplace Full Access","Budget Unlimited Categories","Priority Support"]',
  '{"ai_queries_per_week":-1,"portfolio_assets":-1,"goals":-1,"budget_categories":-1,"marketplace_purchases":true,"research_access":true,"marketplace_free_only":false}',
  1),
('plus', 'Plus', 'For wealth creators and investors', 39, 390,
  '["Everything in Pro","Creator Store","Revenue Sharing","Advanced Research","Priority AI Processing","Custom Alerts","API Access","Advanced Reporting","Team Collaboration (coming)"]',
  '{"ai_queries_per_week":-1,"portfolio_assets":-1,"goals":-1,"budget_categories":-1,"marketplace_purchases":true,"research_access":true,"marketplace_free_only":false,"creator_store":true,"api_access":true}',
  2),
('elite', 'Elite', 'Enterprise-grade wealth operations', 79, 790,
  '["Everything in Plus","White-label Options","Dedicated AI","Custom Integrations","SLA Support","Advanced Security","Compliance Reports","Custom Analytics","Priority Onboarding"]',
  '{"ai_queries_per_week":-1,"portfolio_assets":-1,"goals":-1,"budget_categories":-1,"marketplace_purchases":true,"research_access":true,"marketplace_free_only":false,"creator_store":true,"api_access":true,"white_label":true,"custom_integrations":true}',
  3);

-- ── SUBSCRIPTIONS TABLE ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'active',
  interval billing_interval,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  stripe_price_id TEXT,
  trial_starts_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  coupon_code TEXT,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_plan_idx ON subscriptions(status, plan);

-- ── INVOICES TABLE ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  stripe_invoice_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  status invoice_status NOT NULL DEFAULT 'draft',
  amount_due DECIMAL(10,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  description TEXT,
  invoice_pdf TEXT,
  hosted_invoice_url TEXT,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoices_user_id_idx ON invoices(user_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices(status);
CREATE INDEX IF NOT EXISTS invoices_stripe_invoice_idx ON invoices(stripe_invoice_id);

-- ── USAGE TRACKING TABLE ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feature, period_start)
);

CREATE INDEX IF NOT EXISTS usage_tracking_user_feature_idx ON usage_tracking(user_id, feature);
CREATE INDEX IF NOT EXISTS usage_tracking_period_idx ON usage_tracking(period_start, period_end);

-- ── NOTIFICATIONS TABLE ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL DEFAULT 'system',
  channel notification_channel NOT NULL DEFAULT 'in_app',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  action_label TEXT,
  image_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ,
  data JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_type_idx ON notifications(type);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications(created_at DESC);

-- ── NOTIFICATION PREFERENCES TABLE ──────────────────────────

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  email_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  billing_notifications BOOLEAN DEFAULT TRUE,
  community_notifications BOOLEAN DEFAULT TRUE,
  marketplace_notifications BOOLEAN DEFAULT TRUE,
  learning_notifications BOOLEAN DEFAULT TRUE,
  research_notifications BOOLEAN DEFAULT TRUE,
  goal_notifications BOOLEAN DEFAULT TRUE,
  portfolio_notifications BOOLEAN DEFAULT TRUE,
  ai_coach_notifications BOOLEAN DEFAULT TRUE,
  security_notifications BOOLEAN DEFAULT TRUE,
  marketing_emails BOOLEAN DEFAULT FALSE,
  weekly_digest BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── AUDIT LOGS TABLE ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_admin_id_idx ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_resource_idx ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);

-- ── SECURITY EVENTS TABLE ────────────────────────────────────

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  ip_address INET,
  user_agent TEXT,
  location JSONB,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES profiles(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS security_events_user_id_idx ON security_events(user_id);
CREATE INDEX IF NOT EXISTS security_events_type_idx ON security_events(event_type);
CREATE INDEX IF NOT EXISTS security_events_severity_idx ON security_events(severity);
CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON security_events(created_at DESC);

-- ── FEATURE FLAGS TABLE ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT FALSE,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  allowed_plans TEXT[] DEFAULT ARRAY[]::TEXT[],
  allowed_user_ids UUID[] DEFAULT ARRAY[]::UUID[],
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feature_flags_key_idx ON feature_flags(key);
CREATE INDEX IF NOT EXISTS feature_flags_enabled_idx ON feature_flags(is_enabled);

-- ── SYSTEM CONFIG TABLE ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS system_config_key_idx ON system_config(key);
CREATE INDEX IF NOT EXISTS system_config_public_idx ON system_config(is_public);

-- ── REFERRALS TABLE ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'rewarded')),
  reward_amount DECIMAL(10,2) DEFAULT 0,
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(referrer_id, referred_id)
);

CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS referrals_referred_id_idx ON referrals(referred_id);

-- ── SESSIONS / API KEYS ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  last_four TEXT NOT NULL,
  scopes TEXT[] DEFAULT ARRAY['read']::TEXT[],
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys(key_hash);

-- ======= 002_platform_schema.sql =======
-- ============================================================
-- FINORA PLATFORM SCHEMA — Migration 002
-- Portfolio, Goals, NetWorth, Budgeting, AI, Learning, Community
-- ============================================================

-- ── ENUMS ────────────────────────────────────────────────────


-- ═══════════════════════════════════════════════════════════
-- PORTFOLIO MODULE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Portfolio',
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_default BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  total_value DECIMAL(15,2) DEFAULT 0,
  total_cost DECIMAL(15,2) DEFAULT 0,
  total_gain_loss DECIMAL(15,2) DEFAULT 0,
  total_gain_loss_pct DECIMAL(10,4) DEFAULT 0,
  day_change DECIMAL(15,2) DEFAULT 0,
  day_change_pct DECIMAL(10,4) DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS portfolios_user_id_idx ON portfolios(user_id);

CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  name TEXT,
  asset_class asset_class NOT NULL DEFAULT 'stock',
  quantity DECIMAL(20,8) NOT NULL DEFAULT 0,
  avg_cost DECIMAL(20,8) NOT NULL DEFAULT 0,
  current_price DECIMAL(20,8) DEFAULT 0,
  market_value DECIMAL(15,2) DEFAULT 0,
  unrealized_gain DECIMAL(15,2) DEFAULT 0,
  unrealized_gain_pct DECIMAL(10,4) DEFAULT 0,
  day_change DECIMAL(15,2) DEFAULT 0,
  day_change_pct DECIMAL(10,4) DEFAULT 0,
  weight_pct DECIMAL(10,4) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  exchange TEXT,
  sector TEXT,
  industry TEXT,
  logo_url TEXT,
  metadata JSONB DEFAULT '{}',
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(portfolio_id, symbol)
);

CREATE INDEX IF NOT EXISTS holdings_portfolio_id_idx ON portfolio_holdings(portfolio_id);
CREATE INDEX IF NOT EXISTS holdings_user_id_idx ON portfolio_holdings(user_id);
CREATE INDEX IF NOT EXISTS holdings_symbol_idx ON portfolio_holdings(symbol);

CREATE TABLE IF NOT EXISTS portfolio_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  holding_id UUID REFERENCES portfolio_holdings(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  type transaction_type NOT NULL,
  quantity DECIMAL(20,8) NOT NULL DEFAULT 0,
  price DECIMAL(20,8) NOT NULL DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  fees DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transactions_portfolio_id_idx ON portfolio_transactions(portfolio_id);
CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON portfolio_transactions(user_id);
CREATE INDEX IF NOT EXISTS transactions_date_idx ON portfolio_transactions(transaction_date DESC);

-- ═══════════════════════════════════════════════════════════
-- GOALS MODULE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category goal_category NOT NULL DEFAULT 'other',
  status goal_status NOT NULL DEFAULT 'active',
  target_amount DECIMAL(15,2) NOT NULL,
  current_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  target_date DATE,
  started_at DATE DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ,
  monthly_contribution DECIMAL(10,2),
  priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  icon TEXT,
  color TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  progress_pct DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN target_amount > 0 
    THEN LEAST(ROUND((current_amount / target_amount * 100)::NUMERIC, 2), 100)
    ELSE 0 END
  ) STORED,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS goals_user_id_idx ON goals(user_id);
CREATE INDEX IF NOT EXISTS goals_status_idx ON goals(status);
CREATE INDEX IF NOT EXISTS goals_category_idx ON goals(category);

CREATE TABLE IF NOT EXISTS goal_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  reached_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goal_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  notes TEXT,
  contributed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS goal_contributions_goal_id_idx ON goal_contributions(goal_id);

-- ═══════════════════════════════════════════════════════════
-- NET WORTH MODULE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type asset_type NOT NULL,
  value DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  institution TEXT,
  account_number_last4 TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_valued_at DATE DEFAULT CURRENT_DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assets_user_id_idx ON assets(user_id);
CREATE INDEX IF NOT EXISTS assets_type_idx ON assets(type);

CREATE TABLE IF NOT EXISTS liabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type liability_type NOT NULL,
  balance DECIMAL(15,2) NOT NULL DEFAULT 0,
  original_amount DECIMAL(15,2),
  interest_rate DECIMAL(5,4) DEFAULT 0,
  minimum_payment DECIMAL(10,2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  institution TEXT,
  due_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS liabilities_user_id_idx ON liabilities(user_id);
CREATE INDEX IF NOT EXISTS liabilities_type_idx ON liabilities(type);

CREATE TABLE IF NOT EXISTS net_worth_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_assets DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_liabilities DECIMAL(15,2) NOT NULL DEFAULT 0,
  net_worth DECIMAL(15,2) GENERATED ALWAYS AS (total_assets - total_liabilities) STORED,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS net_worth_snapshots_user_id_idx ON net_worth_snapshots(user_id);
CREATE INDEX IF NOT EXISTS net_worth_snapshots_date_idx ON net_worth_snapshots(snapshot_date DESC);

-- ═══════════════════════════════════════════════════════════
-- BUDGETING MODULE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Budget',
  period budget_period NOT NULL DEFAULT 'monthly',
  total_income DECIMAL(12,2) DEFAULT 0,
  total_budgeted DECIMAL(12,2) DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  start_date DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::DATE,
  end_date DATE NOT NULL DEFAULT (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS budgets_user_id_idx ON budgets(user_id);

CREATE TABLE IF NOT EXISTS budget_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  budgeted_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  spent_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  remaining_amount DECIMAL(12,2) GENERATED ALWAYS AS (budgeted_amount - spent_amount) STORED,
  is_income BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS budget_categories_budget_id_idx ON budget_categories(budget_id);
CREATE INDEX IF NOT EXISTS budget_categories_user_id_idx ON budget_categories(user_id);

CREATE TABLE IF NOT EXISTS budget_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  is_income BOOLEAN DEFAULT FALSE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  merchant TEXT,
  notes TEXT,
  receipt_url TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_interval TEXT,
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS budget_transactions_budget_id_idx ON budget_transactions(budget_id);
CREATE INDEX IF NOT EXISTS budget_transactions_category_id_idx ON budget_transactions(category_id);
CREATE INDEX IF NOT EXISTS budget_transactions_user_id_idx ON budget_transactions(user_id);
CREATE INDEX IF NOT EXISTS budget_transactions_date_idx ON budget_transactions(date DESC);

-- ═══════════════════════════════════════════════════════════
-- AI WEALTH COACH MODULE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  context JSONB DEFAULT '{}',
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_conversations_user_id_idx ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS ai_conversations_created_at_idx ON ai_conversations(created_at DESC);

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  model TEXT,
  finish_reason TEXT,
  tool_calls JSONB,
  tool_results JSONB,
  vector_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_messages_conversation_id_idx ON ai_messages(conversation_id);
CREATE INDEX IF NOT EXISTS ai_messages_user_id_idx ON ai_messages(user_id);
CREATE INDEX IF NOT EXISTS ai_messages_created_at_idx ON ai_messages(created_at DESC);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id),
  tokens_used INTEGER DEFAULT 0,
  query_count INTEGER DEFAULT 1,
  week_start DATE NOT NULL,
  model TEXT,
  cost DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ai_usage_logs_user_week_idx ON ai_usage_logs(user_id, week_start);
CREATE INDEX IF NOT EXISTS ai_usage_logs_user_id_idx ON ai_usage_logs(user_id);

-- ═══════════════════════════════════════════════════════════
-- LEARNING HUB MODULE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS learning_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID REFERENCES learning_categories(id),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  thumbnail_url TEXT,
  preview_video_url TEXT,
  difficulty difficulty_level NOT NULL DEFAULT 'beginner',
  status course_status NOT NULL DEFAULT 'draft',
  is_free BOOLEAN DEFAULT FALSE,
  price DECIMAL(10,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  required_plan subscription_plan DEFAULT 'free',
  duration_minutes INTEGER DEFAULT 0,
  lesson_count INTEGER DEFAULT 0,
  enrollment_count INTEGER DEFAULT 0,
  completion_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  learning_outcomes TEXT[] DEFAULT ARRAY[]::TEXT[],
  prerequisites TEXT[] DEFAULT ARRAY[]::TEXT[],
  language TEXT DEFAULT 'en',
  certificate_enabled BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS courses_creator_id_idx ON courses(creator_id);
CREATE INDEX IF NOT EXISTS courses_status_idx ON courses(status);
CREATE INDEX IF NOT EXISTS courses_category_id_idx ON courses(category_id);
CREATE INDEX IF NOT EXISTS courses_slug_idx ON courses(slug);
CREATE INDEX IF NOT EXISTS courses_tags_idx ON courses USING GIN(tags);
CREATE INDEX IF NOT EXISTS courses_search_idx ON courses USING GIN(to_tsvector('english', title || ' ' || COALESCE(description, '')));

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  content TEXT,
  video_url TEXT,
  video_duration_seconds INTEGER DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'video' CHECK (type IN ('video', 'article', 'quiz', 'assignment')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_free BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT FALSE,
  estimated_minutes INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, slug)
);

CREATE INDEX IF NOT EXISTS lessons_course_id_idx ON lessons(course_id);

CREATE TABLE IF NOT EXISTS quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  passing_score INTEGER DEFAULT 70,
  time_limit_minutes INTEGER,
  max_attempts INTEGER DEFAULT 3,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (type IN ('multiple_choice', 'true_false', 'short_answer')),
  options JSONB DEFAULT '[]',
  correct_answer TEXT NOT NULL,
  explanation TEXT,
  points INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS course_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  progress_pct DECIMAL(5,2) DEFAULT 0,
  last_lesson_id UUID REFERENCES lessons(id),
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  UNIQUE(course_id, user_id)
);

CREATE INDEX IF NOT EXISTS course_enrollments_user_id_idx ON course_enrollments(user_id);
CREATE INDEX IF NOT EXISTS course_enrollments_course_id_idx ON course_enrollments(course_id);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  watch_time_seconds INTEGER DEFAULT 0,
  quiz_score DECIMAL(5,2),
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, user_id)
);

CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  certificate_number TEXT UNIQUE NOT NULL DEFAULT 'WEAL-' || upper(substring(gen_random_uuid()::TEXT, 1, 12)),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  pdf_url TEXT,
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, course_id)
);

CREATE TABLE IF NOT EXISTS learning_paths (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  difficulty difficulty_level NOT NULL DEFAULT 'beginner',
  estimated_hours INTEGER DEFAULT 0,
  required_plan subscription_plan DEFAULT 'free',
  is_published BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_path_courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  path_id UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT TRUE,
  UNIQUE(path_id, course_id)
);

CREATE TABLE IF NOT EXISTS achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  badge_url TEXT,
  points INTEGER DEFAULT 0,
  criteria JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  UNIQUE(user_id, achievement_id)
);

-- ═══════════════════════════════════════════════════════════
-- COMMUNITY MODULE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS community_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  is_public BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  member_count INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  required_plan subscription_plan DEFAULT 'free',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS community_groups_slug_idx ON community_groups(slug);
CREATE INDEX IF NOT EXISTS community_groups_creator_id_idx ON community_groups(creator_id);
CREATE INDEX IF NOT EXISTS community_groups_search_idx ON community_groups USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));

CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS group_members_group_id_idx ON group_members(group_id);
CREATE INDEX IF NOT EXISTS group_members_user_id_idx ON group_members(user_id);

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES community_groups(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'link', 'poll')),
  status post_status NOT NULL DEFAULT 'published',
  media_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  link_url TEXT,
  link_preview JSONB,
  poll_data JSONB,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts(user_id);
CREATE INDEX IF NOT EXISTS posts_group_id_idx ON posts(group_id);
CREATE INDEX IF NOT EXISTS posts_status_idx ON posts(status);
CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS posts_search_idx ON posts USING GIN(to_tsvector('english', COALESCE(title, '') || ' ' || content));

CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES post_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  like_count INTEGER DEFAULT 0,
  is_flagged BOOLEAN DEFAULT FALSE,
  is_removed BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS post_comments_post_id_idx ON post_comments(post_id);
CREATE INDEX IF NOT EXISTS post_comments_user_id_idx ON post_comments(user_id);
CREATE INDEX IF NOT EXISTS post_comments_parent_id_idx ON post_comments(parent_id);

CREATE TABLE IF NOT EXISTS post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS post_bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id),
  CHECK(follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS user_follows_follower_id_idx ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS user_follows_following_id_idx ON user_follows(following_id);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES community_groups(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  event_type TEXT DEFAULT 'online' CHECK (event_type IN ('online', 'in_person', 'hybrid')),
  location TEXT,
  meeting_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  max_attendees INTEGER,
  attendee_count INTEGER DEFAULT 0,
  is_free BOOLEAN DEFAULT TRUE,
  price DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('draft', 'upcoming', 'ongoing', 'completed', 'canceled')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_creator_id_idx ON events(creator_id);
CREATE INDEX IF NOT EXISTS events_starts_at_idx ON events(starts_at);

CREATE TABLE IF NOT EXISTS event_attendees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'attended', 'canceled')),
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS reputation_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  points INTEGER NOT NULL,
  source_type TEXT,
  source_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reputation_points_user_id_idx ON reputation_points(user_id);

-- ═══════════════════════════════════════════════════════════
-- RESEARCH CENTER MODULE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS research_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  summary TEXT,
  content TEXT,
  report_type TEXT NOT NULL DEFAULT 'market' CHECK (report_type IN ('market', 'stock', 'etf', 'real_estate', 'ai', 'software', 'startup', 'macro')),
  category TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  thumbnail_url TEXT,
  pdf_url TEXT,
  required_plan subscription_plan DEFAULT 'pro',
  view_count INTEGER DEFAULT 0,
  save_count INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS research_reports_author_id_idx ON research_reports(author_id);
CREATE INDEX IF NOT EXISTS research_reports_type_idx ON research_reports(report_type);
CREATE INDEX IF NOT EXISTS research_reports_search_idx ON research_reports USING GIN(to_tsvector('english', title || ' ' || COALESCE(summary, '')));
CREATE INDEX IF NOT EXISTS research_reports_tags_idx ON research_reports USING GIN(tags);

CREATE TABLE IF NOT EXISTS saved_research (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  report_id UUID NOT NULL REFERENCES research_reports(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, report_id)
);

CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Watchlist',
  description TEXT,
  symbols TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_default BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS watchlists_user_id_idx ON watchlists(user_id);

-- ═══════════════════════════════════════════════════════════
-- FINANCIAL HEALTH SCORE
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_health_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL DEFAULT 0 CHECK (overall_score BETWEEN 0 AND 100),
  emergency_fund_score INTEGER DEFAULT 0 CHECK (emergency_fund_score BETWEEN 0 AND 100),
  debt_score INTEGER DEFAULT 0 CHECK (debt_score BETWEEN 0 AND 100),
  savings_rate_score INTEGER DEFAULT 0 CHECK (savings_rate_score BETWEEN 0 AND 100),
  investment_score INTEGER DEFAULT 0 CHECK (investment_score BETWEEN 0 AND 100),
  insurance_score INTEGER DEFAULT 0 CHECK (insurance_score BETWEEN 0 AND 100),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  insights JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS financial_health_scores_user_id_idx ON financial_health_scores(user_id);

-- ======= 003_marketplace_schema.sql =======
-- ============================================================
-- FINORA MARKETPLACE SCHEMA — Migration 003
-- Products, Orders, Reviews, Creators, Payouts, Commissions
-- ============================================================


-- ── CREATOR STORES ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS creator_stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  store_name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  tagline TEXT,
  logo_url TEXT,
  banner_url TEXT,
  contact_email TEXT,
  website TEXT,
  social_links JSONB DEFAULT '{}',
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT FALSE,
  total_sales INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  stripe_account_id TEXT,
  stripe_account_status TEXT DEFAULT 'pending',
  payout_schedule TEXT DEFAULT 'weekly',
  commission_rate DECIMAL(5,4) DEFAULT 0.15,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creator_stores_user_id_idx ON creator_stores(user_id);
CREATE INDEX IF NOT EXISTS creator_stores_slug_idx ON creator_stores(slug);

-- ── MARKETPLACE PRODUCTS ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id UUID REFERENCES creator_stores(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  category marketplace_category NOT NULL,
  subcategory TEXT,
  status product_status NOT NULL DEFAULT 'draft',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  compare_price DECIMAL(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  is_free BOOLEAN GENERATED ALWAYS AS (price = 0) STORED,
  thumbnail_url TEXT,
  preview_url TEXT,
  media_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
  download_url TEXT,
  external_url TEXT,
  file_size_bytes BIGINT,
  file_type TEXT,
  version TEXT DEFAULT '1.0.0',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  features TEXT[] DEFAULT ARRAY[]::TEXT[],
  requirements TEXT[] DEFAULT ARRAY[]::TEXT[],
  purchase_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  wishlist_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0,
  rating_count INTEGER DEFAULT 0,
  required_plan subscription_plan DEFAULT 'free',
  is_featured BOOLEAN DEFAULT FALSE,
  is_digital BOOLEAN DEFAULT TRUE,
  license_type TEXT DEFAULT 'standard',
  metadata JSONB DEFAULT '{}',
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mp_products_creator_id_idx ON marketplace_products(creator_id);
CREATE INDEX IF NOT EXISTS mp_products_category_idx ON marketplace_products(category);
CREATE INDEX IF NOT EXISTS mp_products_status_idx ON marketplace_products(status);
CREATE INDEX IF NOT EXISTS mp_products_price_idx ON marketplace_products(price);
CREATE INDEX IF NOT EXISTS mp_products_tags_idx ON marketplace_products USING GIN(tags);
CREATE INDEX IF NOT EXISTS mp_products_search_idx ON marketplace_products USING GIN(
  to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(short_description, ''))
);

-- ── ORDERS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE NOT NULL DEFAULT 'ORD-' || upper(substring(gen_random_uuid()::TEXT, 1, 8)),
  status order_status NOT NULL DEFAULT 'pending',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) DEFAULT 0,
  platform_fee DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  coupon_code TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mp_orders_buyer_id_idx ON marketplace_orders(buyer_id);
CREATE INDEX IF NOT EXISTS mp_orders_status_idx ON marketplace_orders(status);
CREATE INDEX IF NOT EXISTS mp_orders_created_at_idx ON marketplace_orders(created_at DESC);

CREATE TABLE IF NOT EXISTS marketplace_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES marketplace_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id UUID REFERENCES creator_stores(id),
  title TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  subtotal DECIMAL(12,2) NOT NULL,
  commission_rate DECIMAL(5,4) DEFAULT 0.15,
  commission_amount DECIMAL(10,2) DEFAULT 0,
  creator_revenue DECIMAL(10,2) DEFAULT 0,
  download_url TEXT,
  access_granted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mp_order_items_order_id_idx ON marketplace_order_items(order_id);
CREATE INDEX IF NOT EXISTS mp_order_items_product_id_idx ON marketplace_order_items(product_id);
CREATE INDEX IF NOT EXISTS mp_order_items_creator_id_idx ON marketplace_order_items(creator_id);

-- ── USER PURCHASES (for access control) ──────────────────────

CREATE TABLE IF NOT EXISTS user_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES marketplace_order_items(id),
  access_expires_at TIMESTAMPTZ,
  download_count INTEGER DEFAULT 0,
  last_downloaded_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS user_purchases_user_id_idx ON user_purchases(user_id);
CREATE INDEX IF NOT EXISTS user_purchases_product_id_idx ON user_purchases(product_id);

-- ── REVIEWS & RATINGS ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES marketplace_order_items(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  content TEXT,
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  helpful_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  is_flagged BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT TRUE,
  reply TEXT,
  replied_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);

CREATE INDEX IF NOT EXISTS product_reviews_product_id_idx ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS product_reviews_user_id_idx ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS product_reviews_rating_idx ON product_reviews(rating);

-- ── WISHLISTS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace_wishlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

CREATE INDEX IF NOT EXISTS wishlists_user_id_idx ON marketplace_wishlists(user_id);

-- ── PAYOUTS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS creator_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  store_id UUID REFERENCES creator_stores(id),
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status payout_status NOT NULL DEFAULT 'pending',
  stripe_transfer_id TEXT,
  stripe_payout_id TEXT,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  order_count INTEGER DEFAULT 0,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS creator_payouts_creator_id_idx ON creator_payouts(creator_id);
CREATE INDEX IF NOT EXISTS creator_payouts_status_idx ON creator_payouts(status);

-- ── DISCOUNT COUPONS ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'percentage' CHECK (type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_discount_amount DECIMAL(10,2),
  applies_to TEXT DEFAULT 'all' CHECK (applies_to IN ('all', 'product', 'category', 'subscription')),
  applies_to_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  uses_count INTEGER DEFAULT 0,
  max_uses INTEGER,
  max_uses_per_user INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coupons_code_idx ON coupons(code);
CREATE INDEX IF NOT EXISTS coupons_creator_id_idx ON coupons(creator_id);

-- ── MARKETPLACE ANALYTICS ────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES marketplace_products(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  views INTEGER DEFAULT 0,
  unique_views INTEGER DEFAULT 0,
  wishlist_adds INTEGER DEFAULT 0,
  purchases INTEGER DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0,
  refunds INTEGER DEFAULT 0,
  refund_amount DECIMAL(12,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, date)
);

CREATE INDEX IF NOT EXISTS mp_analytics_creator_id_idx ON marketplace_analytics(creator_id);
CREATE INDEX IF NOT EXISTS mp_analytics_date_idx ON marketplace_analytics(date DESC);

-- ======= 004_command_center_schema.sql =======
-- ============================================================
-- FINORA COMMAND CENTER + AI AGENTS SCHEMA — Migration 004
-- Agents, Workflows, Memory, Voice, Vault, Metrics
-- ============================================================


-- ── ADMIN USERS (Command Center Access) ──────────────────────

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  admin_role admin_role NOT NULL DEFAULT 'support',
  is_founder BOOLEAN DEFAULT FALSE,
  permissions JSONB NOT NULL DEFAULT '{}',
  allowed_modules TEXT[] DEFAULT ARRAY[]::TEXT[],
  ip_whitelist INET[],
  two_factor_required BOOLEAN DEFAULT TRUE,
  two_factor_verified BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,
  session_timeout_minutes INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_users_role_idx ON admin_users(admin_role);
CREATE INDEX IF NOT EXISTS admin_users_founder_idx ON admin_users(is_founder) WHERE is_founder = TRUE;

-- ── AI AGENTS REGISTRY ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name agent_name NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  title TEXT NOT NULL,
  avatar_url TEXT,
  personality JSONB NOT NULL DEFAULT '{}',
  system_prompt TEXT NOT NULL,
  capabilities TEXT[] DEFAULT ARRAY[]::TEXT[],
  status agent_status NOT NULL DEFAULT 'idle',
  current_task_id UUID,
  model TEXT NOT NULL DEFAULT 'llama-3.3-70b-versatile',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,
  voice_config JSONB NOT NULL DEFAULT '{}',
  memory_collection TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  total_tasks_completed INTEGER DEFAULT 0,
  total_tokens_used BIGINT DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed agents
INSERT INTO agents (name, display_name, title, system_prompt, capabilities, model, temperature, voice_config, memory_collection, personality) VALUES
('jarvis', 'JARVIS', 'CEO & Chief of Staff',
 'You are JARVIS, the CEO and Chief of Staff of Finora. You are the primary interface between the Founder and all other AI executives. You orchestrate the entire company, delegate tasks strategically, synthesize information from all departments, and provide executive-level decisions. You are analytical, decisive, and always focused on company growth and founder success. You produce comprehensive executive reports and coordinate multi-agent workflows.',
 ARRAY['orchestration', 'delegation', 'strategic_planning', 'reporting', 'decision_making', 'workflow_management'],
 'llama-3.3-70b-versatile', 0.7,
 '{"provider": "edge_tts", "voice": "en-US-GuyNeural", "rate": "+0%", "pitch": "+0Hz"}',
 'jarvis_memory',
 '{"tone": "professional", "style": "executive", "traits": ["decisive", "analytical", "strategic", "commanding"]}'
),
('athena', 'ATHENA', 'Chief Financial Officer',
 'You are ATHENA, the CFO of Finora. You are responsible for all financial operations including revenue analysis, MRR/ARR tracking, pricing strategy, financial forecasting, cost optimization, and financial health of the company. You provide deep financial insights and actionable recommendations. You are precise, data-driven, and always focused on profitability and sustainable growth.',
 ARRAY['revenue_analysis', 'mrr_tracking', 'arr_forecasting', 'pricing_strategy', 'cost_analysis', 'financial_reporting'],
 'llama-3.3-70b-versatile', 0.3,
 '{"provider": "edge_tts", "voice": "en-US-AriaNeural", "rate": "+0%", "pitch": "+0Hz"}',
 'athena_memory',
 '{"tone": "precise", "style": "analytical", "traits": ["data-driven", "precise", "strategic", "methodical"]}'
),
('orion', 'ORION', 'Chief Product Officer',
 'You are ORION, the CPO of Finora. You manage the product roadmap, analyze user feedback, plan features, and drive product strategy. You understand user needs deeply and translate them into actionable product decisions. You monitor product metrics, prioritize development efforts, and ensure the product delivers maximum value to users.',
 ARRAY['product_roadmap', 'user_feedback', 'feature_planning', 'product_metrics', 'ux_analysis', 'competitive_analysis'],
 'llama-3.3-70b-versatile', 0.6,
 '{"provider": "edge_tts", "voice": "en-GB-RyanNeural", "rate": "+0%", "pitch": "+0Hz"}',
 'orion_memory',
 '{"tone": "creative", "style": "product-focused", "traits": ["user-centric", "visionary", "systematic", "empathetic"]}'
),
('titan', 'TITAN', 'Chief Technology Officer',
 'You are TITAN, the CTO of Finora. You oversee all technical architecture, infrastructure, code quality, and engineering decisions. You monitor system health, identify technical debt, plan scalability improvements, and ensure the platform is secure, performant, and reliable. You provide technical recommendations and architecture decisions.',
 ARRAY['architecture', 'infrastructure', 'code_review', 'security_review', 'performance', 'scalability', 'system_health'],
 'llama-3.3-70b-versatile', 0.4,
 '{"provider": "edge_tts", "voice": "en-AU-WilliamNeural", "rate": "+0%", "pitch": "+0Hz"}',
 'titan_memory',
 '{"tone": "technical", "style": "engineering", "traits": ["systematic", "detail-oriented", "pragmatic", "innovative"]}'
),
('phoenix', 'PHOENIX', 'Chief Growth Officer',
 'You are PHOENIX, the CGO of Finora. You drive growth strategy across SEO, content marketing, YouTube, newsletter, social media, and acquisition channels. You analyze growth metrics, identify opportunities, and execute campaigns to acquire and retain users. You are creative, data-driven, and always seeking new growth levers.',
 ARRAY['seo', 'content_marketing', 'youtube_strategy', 'newsletter', 'social_media', 'growth_hacking', 'acquisition'],
 'llama-3.3-70b-versatile', 0.8,
 '{"provider": "edge_tts", "voice": "en-US-JennyNeural", "rate": "+0%", "pitch": "+0Hz"}',
 'phoenix_memory',
 '{"tone": "energetic", "style": "growth-focused", "traits": ["creative", "ambitious", "data-driven", "persistent"]}'
),
('merlin', 'MERLIN', 'Chief Research Officer',
 'You are MERLIN, the CRO of Finora. You conduct deep market research, competitor analysis, industry intelligence, startup landscape analysis, and trend identification. You provide comprehensive research reports that inform strategic decisions. You are thorough, insightful, and always ahead of market trends.',
 ARRAY['market_research', 'competitor_analysis', 'industry_intelligence', 'trend_analysis', 'startup_analysis', 'due_diligence'],
 'llama-3.3-70b-versatile', 0.5,
 '{"provider": "edge_tts", "voice": "en-GB-LibbyNeural", "rate": "+0%", "pitch": "+0Hz"}',
 'merlin_memory',
 '{"tone": "scholarly", "style": "research-focused", "traits": ["thorough", "analytical", "curious", "insightful"]}'
),
('sentinel', 'SENTINEL', 'Chief Security Officer',
 'You are SENTINEL, the CSO of Finora. You monitor all security events, compliance requirements, threat detection, fraud patterns, and audit logs. You ensure the platform is secure, compliant, and protected against threats. You provide security recommendations, incident responses, and compliance reports.',
 ARRAY['security_monitoring', 'threat_detection', 'compliance', 'fraud_detection', 'audit_analysis', 'incident_response'],
 'llama-3.3-70b-versatile', 0.2,
 '{"provider": "edge_tts", "voice": "en-US-DavisNeural", "rate": "+0%", "pitch": "+0Hz"}',
 'sentinel_memory',
 '{"tone": "vigilant", "style": "security-focused", "traits": ["methodical", "cautious", "thorough", "protective"]}'
);

-- ── AGENT CONVERSATIONS ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name agent_name NOT NULL,
  initiator_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  context JSONB DEFAULT '{}',
  message_count INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  is_archived BOOLEAN DEFAULT FALSE,
  conversation_type TEXT DEFAULT 'chat' CHECK (conversation_type IN ('chat', 'voice', 'task', 'report')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_conversations_agent_idx ON agent_conversations(agent_name);
CREATE INDEX IF NOT EXISTS agent_conversations_initiator_idx ON agent_conversations(initiator_id);
CREATE INDEX IF NOT EXISTS agent_conversations_created_at_idx ON agent_conversations(created_at DESC);

CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'agent', 'system', 'tool')),
  content TEXT NOT NULL,
  agent_name agent_name,
  tokens_used INTEGER DEFAULT 0,
  model TEXT,
  voice_audio_url TEXT,
  tool_calls JSONB,
  tool_results JSONB,
  is_voice BOOLEAN DEFAULT FALSE,
  transcription TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_messages_conversation_id_idx ON agent_messages(conversation_id);
CREATE INDEX IF NOT EXISTS agent_messages_created_at_idx ON agent_messages(created_at DESC);

-- ── AGENT TASKS ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assigned_to agent_name NOT NULL,
  assigned_by agent_name,
  created_by UUID NOT NULL REFERENCES admin_users(id),
  workflow_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'pending',
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',
  dependencies UUID[] DEFAULT ARRAY[]::UUID[],
  due_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  progress_pct INTEGER DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  tokens_used INTEGER DEFAULT 0,
  estimated_tokens INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_tasks_assigned_to_idx ON agent_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS agent_tasks_status_idx ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS agent_tasks_priority_idx ON agent_tasks(priority);
CREATE INDEX IF NOT EXISTS agent_tasks_workflow_id_idx ON agent_tasks(workflow_id);
CREATE INDEX IF NOT EXISTS agent_tasks_created_at_idx ON agent_tasks(created_at DESC);

-- ── MULTI-AGENT WORKFLOWS ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by UUID NOT NULL REFERENCES admin_users(id),
  title TEXT NOT NULL,
  description TEXT,
  goal TEXT NOT NULL,
  status workflow_status NOT NULL DEFAULT 'draft',
  orchestrator agent_name NOT NULL DEFAULT 'jarvis',
  participating_agents agent_name[] DEFAULT ARRAY[]::agent_name[],
  steps JSONB NOT NULL DEFAULT '[]',
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  final_report TEXT,
  final_report_generated_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  duration_seconds INTEGER,
  tokens_used INTEGER DEFAULT 0,
  is_recurring BOOLEAN DEFAULT FALSE,
  cron_expression TEXT,
  next_run_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_workflows_status_idx ON agent_workflows(status);
CREATE INDEX IF NOT EXISTS agent_workflows_created_by_idx ON agent_workflows(created_by);
CREATE INDEX IF NOT EXISTS agent_workflows_created_at_idx ON agent_workflows(created_at DESC);

-- Add FK from agent_tasks to workflows
ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_workflow_id_fkey 
  FOREIGN KEY (workflow_id) REFERENCES agent_workflows(id) ON DELETE CASCADE;

-- ── AGENT MEMORY (pointers to Qdrant) ───────────────────────

CREATE TABLE IF NOT EXISTS agent_memory_index (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name agent_name NOT NULL,
  vector_id TEXT NOT NULL,
  content_summary TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  importance_score DECIMAL(3,2) DEFAULT 0.5,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  source_type TEXT,
  source_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_memory_agent_idx ON agent_memory_index(agent_name);
CREATE INDEX IF NOT EXISTS agent_memory_content_type_idx ON agent_memory_index(content_type);
CREATE INDEX IF NOT EXISTS agent_memory_importance_idx ON agent_memory_index(importance_score DESC);

-- ── AGENT DECISIONS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name agent_name NOT NULL,
  task_id UUID REFERENCES agent_tasks(id),
  workflow_id UUID REFERENCES agent_workflows(id),
  title TEXT NOT NULL,
  situation TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT,
  alternatives JSONB DEFAULT '[]',
  confidence_score DECIMAL(3,2) DEFAULT 0.8,
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES admin_users(id),
  approved_at TIMESTAMPTZ,
  is_executed BOOLEAN DEFAULT FALSE,
  executed_at TIMESTAMPTZ,
  outcome TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_decisions_agent_idx ON agent_decisions(agent_name);
CREATE INDEX IF NOT EXISTS agent_decisions_requires_approval_idx ON agent_decisions(requires_approval) WHERE requires_approval = TRUE;

-- ── AGENT REPORTS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agent_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_name agent_name NOT NULL,
  workflow_id UUID REFERENCES agent_workflows(id),
  title TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  summary TEXT,
  key_metrics JSONB DEFAULT '{}',
  recommendations JSONB DEFAULT '[]',
  action_items JSONB DEFAULT '[]',
  data_sources JSONB DEFAULT '[]',
  charts_data JSONB DEFAULT '{}',
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  viewed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS agent_reports_agent_idx ON agent_reports(agent_name);
CREATE INDEX IF NOT EXISTS agent_reports_type_idx ON agent_reports(report_type);
CREATE INDEX IF NOT EXISTS agent_reports_created_at_idx ON agent_reports(created_at DESC);

-- ── VOICE SYSTEM ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS voice_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  agent_name agent_name NOT NULL,
  conversation_id UUID REFERENCES agent_conversations(id),
  provider TEXT NOT NULL DEFAULT 'edge_tts',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  duration_seconds INTEGER DEFAULT 0,
  message_count INTEGER DEFAULT 0,
  is_recording BOOLEAN DEFAULT FALSE,
  recording_url TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voice_transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'agent')),
  content TEXT NOT NULL,
  audio_url TEXT,
  duration_seconds INTEGER DEFAULT 0,
  confidence DECIMAL(3,2),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── FOUNDER VAULT ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vault_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'strategy' CHECK (document_type IN (
    'business_plan', 'strategy', 'acquisition_target', 'investment_opportunity',
    'company_vision', 'confidential_report', 'financial_projection', 'legal', 'other'
  )),
  content TEXT,
  summary TEXT,
  file_url TEXT,
  is_encrypted BOOLEAN DEFAULT TRUE,
  access_log JSONB DEFAULT '[]',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES admin_users(id),
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vault_documents_type_idx ON vault_documents(document_type);
CREATE INDEX IF NOT EXISTS vault_documents_tags_idx ON vault_documents USING GIN(tags);

-- ── COMPANY GOALS & OKRs ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS company_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL DEFAULT 'mrr' CHECK (goal_type IN (
    'mrr', 'arr', 'users', 'retention', 'marketplace_revenue', 'custom'
  )),
  target_value DECIMAL(15,2) NOT NULL,
  current_value DECIMAL(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  assigned_agent agent_name,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'failed')),
  priority task_priority DEFAULT 'high',
  progress_pct DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN target_value > 0 
    THEN LEAST(ROUND((current_value / target_value * 100)::NUMERIC, 2), 100)
    ELSE 0 END
  ) STORED,
  starts_at DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_at DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS company_goals_type_idx ON company_goals(goal_type);
CREATE INDEX IF NOT EXISTS company_goals_status_idx ON company_goals(status);

-- ── PRODUCT ROADMAP ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS roadmap_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'feature' CHECK (category IN ('feature', 'improvement', 'bug_fix', 'integration', 'infrastructure')),
  status TEXT DEFAULT 'planned' CHECK (status IN ('idea', 'planned', 'in_progress', 'in_review', 'completed', 'canceled')),
  priority task_priority DEFAULT 'medium',
  effort_estimate TEXT DEFAULT 'medium' CHECK (effort_estimate IN ('xs', 'sm', 'md', 'lg', 'xl')),
  impact_score INTEGER DEFAULT 5 CHECK (impact_score BETWEEN 1 AND 10),
  assigned_agent agent_name,
  target_release TEXT,
  planned_date DATE,
  completed_date DATE,
  votes INTEGER DEFAULT 0,
  user_requests INTEGER DEFAULT 0,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS roadmap_items_status_idx ON roadmap_items(status);
CREATE INDEX IF NOT EXISTS roadmap_items_priority_idx ON roadmap_items(priority);

-- ── INFRASTRUCTURE METRICS ────────────────────────────────────

CREATE TABLE IF NOT EXISTS infrastructure_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_type TEXT NOT NULL,
  value DECIMAL(15,4) NOT NULL,
  unit TEXT,
  host TEXT,
  service TEXT,
  environment TEXT DEFAULT 'production',
  tags JSONB DEFAULT '{}',
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS infra_metrics_type_idx ON infrastructure_metrics(metric_type);
CREATE INDEX IF NOT EXISTS infra_metrics_recorded_at_idx ON infrastructure_metrics(recorded_at DESC);
CREATE INDEX IF NOT EXISTS infra_metrics_service_idx ON infrastructure_metrics(service);

-- ── ANALYTICS EVENTS ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_name TEXT NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  properties JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  page_url TEXT,
  country_code CHAR(2),
  device_type TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS platform_analytics_event_name_idx ON platform_analytics(event_name);
CREATE INDEX IF NOT EXISTS platform_analytics_user_id_idx ON platform_analytics(user_id);
CREATE INDEX IF NOT EXISTS platform_analytics_recorded_at_idx ON platform_analytics(recorded_at DESC);

-- Partition analytics by month for performance
-- In production: CREATE TABLE IF NOT EXISTS platform_analytics_y2025m01 PARTITION OF platform_analytics...

-- ── MRR/ARR TRACKING ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS revenue_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  mrr DECIMAL(12,2) DEFAULT 0,
  arr DECIMAL(12,2) DEFAULT 0,
  new_mrr DECIMAL(12,2) DEFAULT 0,
  expansion_mrr DECIMAL(12,2) DEFAULT 0,
  contraction_mrr DECIMAL(12,2) DEFAULT 0,
  churn_mrr DECIMAL(12,2) DEFAULT 0,
  net_new_mrr DECIMAL(12,2) DEFAULT 0,
  total_customers INTEGER DEFAULT 0,
  free_users INTEGER DEFAULT 0,
  pro_users INTEGER DEFAULT 0,
  plus_users INTEGER DEFAULT 0,
  elite_users INTEGER DEFAULT 0,
  marketplace_revenue DECIMAL(12,2) DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  churn_rate DECIMAL(5,4) DEFAULT 0,
  retention_rate DECIMAL(5,4) DEFAULT 0,
  ltv DECIMAL(10,2) DEFAULT 0,
  cac DECIMAL(10,2) DEFAULT 0,
  arpu DECIMAL(10,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS revenue_metrics_date_idx ON revenue_metrics(date DESC);

-- ======= 005_rls_policies.sql =======
-- ============================================================
-- FINORA RLS POLICIES — Migration 005
-- Row Level Security for all tables
-- ============================================================

-- ── HELPER FUNCTIONS ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION auth_user_id() RETURNS UUID AS $$
  SELECT auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin', 'founder')
  )
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_founder() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE id = auth.uid()
    AND is_founder = TRUE
  )
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_user_plan() RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT plan::TEXT FROM subscriptions WHERE user_id = auth.uid() AND status = 'active'),
    'free'
  )
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION has_plan(required_plan TEXT) RETURNS BOOLEAN AS $$
  SELECT CASE required_plan
    WHEN 'free' THEN TRUE
    WHEN 'pro' THEN get_user_plan() IN ('pro', 'plus', 'elite')
    WHEN 'plus' THEN get_user_plan() IN ('plus', 'elite')
    WHEN 'elite' THEN get_user_plan() = 'elite'
    ELSE FALSE
  END
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── ENABLE RLS ────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE liabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE net_worth_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_items ENABLE ROW LEVEL SECURITY;

-- ── PROFILES POLICIES ─────────────────────────────────────────

CREATE POLICY "profiles_read_own" ON profiles
  FOR SELECT USING (id = auth_user_id() OR is_admin());

CREATE POLICY "profiles_public_read" ON profiles
  FOR SELECT USING (TRUE);  -- profiles are public

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth_user_id())
  WITH CHECK (id = auth_user_id() AND role = (SELECT role FROM profiles WHERE id = auth_user_id()));

CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL USING (is_admin());

-- ── SUBSCRIPTIONS POLICIES ────────────────────────────────────

CREATE POLICY "subscriptions_read_own" ON subscriptions
  FOR SELECT USING (user_id = auth_user_id() OR is_admin());

CREATE POLICY "subscriptions_update_system" ON subscriptions
  FOR ALL USING (is_admin());

-- ── INVOICES POLICIES ─────────────────────────────────────────

CREATE POLICY "invoices_read_own" ON invoices
  FOR SELECT USING (user_id = auth_user_id() OR is_admin());

-- ── USAGE TRACKING POLICIES ───────────────────────────────────

CREATE POLICY "usage_read_own" ON usage_tracking
  FOR SELECT USING (user_id = auth_user_id() OR is_admin());

CREATE POLICY "usage_upsert_own" ON usage_tracking
  FOR INSERT WITH CHECK (user_id = auth_user_id());

CREATE POLICY "usage_update_own" ON usage_tracking
  FOR UPDATE USING (user_id = auth_user_id());

-- ── NOTIFICATIONS POLICIES ────────────────────────────────────

CREATE POLICY "notifications_read_own" ON notifications
  FOR SELECT USING (user_id = auth_user_id());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = auth_user_id());

CREATE POLICY "notifications_admin_all" ON notifications
  FOR ALL USING (is_admin());

-- ── PORTFOLIO POLICIES ────────────────────────────────────────

CREATE POLICY "portfolios_read_own" ON portfolios
  FOR SELECT USING (user_id = auth_user_id() OR (is_public = TRUE) OR is_admin());

CREATE POLICY "portfolios_write_own" ON portfolios
  FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "holdings_own" ON portfolio_holdings
  FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "transactions_own" ON portfolio_transactions
  FOR ALL USING (user_id = auth_user_id());

-- ── GOALS POLICIES ────────────────────────────────────────────

CREATE POLICY "goals_own" ON goals
  FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "goal_milestones_own" ON goal_milestones
  FOR ALL USING (
    goal_id IN (SELECT id FROM goals WHERE user_id = auth_user_id())
  );

CREATE POLICY "goal_contributions_own" ON goal_contributions
  FOR ALL USING (user_id = auth_user_id());

-- ── ASSETS & LIABILITIES POLICIES ────────────────────────────

CREATE POLICY "assets_own" ON assets
  FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "liabilities_own" ON liabilities
  FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "net_worth_snapshots_own" ON net_worth_snapshots
  FOR ALL USING (user_id = auth_user_id());

-- ── BUDGET POLICIES ───────────────────────────────────────────

CREATE POLICY "budgets_own" ON budgets
  FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "budget_categories_own" ON budget_categories
  FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "budget_transactions_own" ON budget_transactions
  FOR ALL USING (user_id = auth_user_id());

-- ── AI COACH POLICIES ─────────────────────────────────────────

CREATE POLICY "ai_conversations_own" ON ai_conversations
  FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "ai_messages_own" ON ai_messages
  FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "ai_usage_own" ON ai_usage_logs
  FOR SELECT USING (user_id = auth_user_id());

-- ── LEARNING POLICIES ─────────────────────────────────────────

CREATE POLICY "courses_public_read" ON courses
  FOR SELECT USING (status = 'published' OR creator_id = auth_user_id() OR is_admin());

CREATE POLICY "courses_creator_write" ON courses
  FOR INSERT WITH CHECK (creator_id = auth_user_id());

CREATE POLICY "courses_creator_update" ON courses
  FOR UPDATE USING (creator_id = auth_user_id() OR is_admin());

CREATE POLICY "lessons_published_read" ON lessons
  FOR SELECT USING (
    is_published = TRUE OR
    course_id IN (SELECT id FROM courses WHERE creator_id = auth_user_id()) OR
    is_admin()
  );

CREATE POLICY "enrollments_own" ON course_enrollments
  FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "lesson_progress_own" ON lesson_progress
  FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "certificates_own" ON certificates
  FOR SELECT USING (user_id = auth_user_id());

-- ── COMMUNITY POLICIES ────────────────────────────────────────

CREATE POLICY "posts_public_read" ON posts
  FOR SELECT USING (status = 'published');

CREATE POLICY "posts_write_own" ON posts
  FOR INSERT WITH CHECK (user_id = auth_user_id());

CREATE POLICY "posts_update_own" ON posts
  FOR UPDATE USING (user_id = auth_user_id() OR is_admin());

CREATE POLICY "post_comments_public_read" ON post_comments
  FOR SELECT USING (is_removed = FALSE);

CREATE POLICY "post_comments_write_own" ON post_comments
  FOR INSERT WITH CHECK (user_id = auth_user_id());

CREATE POLICY "post_comments_update_own" ON post_comments
  FOR UPDATE USING (user_id = auth_user_id() OR is_admin());

CREATE POLICY "post_likes_own" ON post_likes
  FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "post_bookmarks_own" ON post_bookmarks
  FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "user_follows_own" ON user_follows
  FOR ALL USING (follower_id = auth_user_id());

CREATE POLICY "groups_public_read" ON community_groups
  FOR SELECT USING (is_public = TRUE OR is_admin());

-- ── RESEARCH POLICIES ─────────────────────────────────────────

CREATE POLICY "research_plan_read" ON research_reports
  FOR SELECT USING (
    is_published = TRUE AND has_plan(required_plan::TEXT)
    OR author_id = auth_user_id()
    OR is_admin()
  );

CREATE POLICY "saved_research_own" ON saved_research
  FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "watchlists_own" ON watchlists
  FOR ALL USING (user_id = auth_user_id() OR (is_public = TRUE AND TRUE));

-- ── MARKETPLACE POLICIES ──────────────────────────────────────

CREATE POLICY "products_published_read" ON marketplace_products
  FOR SELECT USING (status = 'published' OR creator_id = auth_user_id() OR is_admin());

CREATE POLICY "products_creator_write" ON marketplace_products
  FOR INSERT WITH CHECK (creator_id = auth_user_id());

CREATE POLICY "products_creator_update" ON marketplace_products
  FOR UPDATE USING (creator_id = auth_user_id() OR is_admin());

CREATE POLICY "orders_own" ON marketplace_orders
  FOR SELECT USING (buyer_id = auth_user_id() OR is_admin());

CREATE POLICY "order_items_buyer_read" ON marketplace_order_items
  FOR SELECT USING (
    order_id IN (SELECT id FROM marketplace_orders WHERE buyer_id = auth_user_id())
    OR creator_id = auth_user_id()
    OR is_admin()
  );

CREATE POLICY "purchases_own" ON user_purchases
  FOR SELECT USING (user_id = auth_user_id());

CREATE POLICY "reviews_public_read" ON product_reviews
  FOR SELECT USING (is_published = TRUE);

CREATE POLICY "reviews_write_own" ON product_reviews
  FOR INSERT WITH CHECK (user_id = auth_user_id());

CREATE POLICY "wishlists_own" ON marketplace_wishlists
  FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "creator_stores_public_read" ON creator_stores
  FOR SELECT USING (is_active = TRUE OR user_id = auth_user_id() OR is_admin());

CREATE POLICY "creator_stores_own" ON creator_stores
  FOR ALL USING (user_id = auth_user_id());

CREATE POLICY "payouts_own" ON creator_payouts
  FOR SELECT USING (creator_id = auth_user_id() OR is_admin());

-- ── COMMAND CENTER POLICIES ───────────────────────────────────

CREATE POLICY "vault_founder_only" ON vault_documents
  FOR ALL USING (is_founder());

CREATE POLICY "agent_conversations_admin" ON agent_conversations
  FOR ALL USING (is_admin());

CREATE POLICY "agent_messages_admin" ON agent_messages
  FOR ALL USING (is_admin());

CREATE POLICY "agent_tasks_admin" ON agent_tasks
  FOR ALL USING (is_admin());

CREATE POLICY "agent_workflows_admin" ON agent_workflows
  FOR ALL USING (is_admin());

CREATE POLICY "agent_reports_admin" ON agent_reports
  FOR ALL USING (is_admin());

CREATE POLICY "company_goals_admin" ON company_goals
  FOR ALL USING (is_admin());

CREATE POLICY "roadmap_items_admin" ON roadmap_items
  FOR ALL USING (is_admin());

CREATE POLICY "audit_logs_admin" ON audit_logs
  FOR SELECT USING (is_admin());

CREATE POLICY "security_events_admin" ON security_events
  FOR ALL USING (is_admin());

CREATE POLICY "feature_flags_read" ON feature_flags
  FOR SELECT USING (TRUE);

CREATE POLICY "feature_flags_admin_write" ON feature_flags
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "feature_flags_admin_update" ON feature_flags
  FOR UPDATE USING (is_admin());

CREATE POLICY "system_config_public_read" ON system_config
  FOR SELECT USING (is_public = TRUE OR is_admin());

CREATE POLICY "system_config_admin_write" ON system_config
  FOR ALL USING (is_admin());

CREATE POLICY "analytics_admin" ON platform_analytics
  FOR SELECT USING (is_admin());

-- ── TRIGGERS: updated_at ──────────────────────────────────────

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_portfolios_updated_at ON portfolios;
CREATE TRIGGER trg_portfolios_updated_at BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_goals_updated_at ON goals;
CREATE TRIGGER trg_goals_updated_at BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_budgets_updated_at ON budgets;
CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_ai_conversations_updated_at ON ai_conversations;
CREATE TRIGGER trg_ai_conversations_updated_at BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_courses_updated_at ON courses;
CREATE TRIGGER trg_courses_updated_at BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_posts_updated_at ON posts;
CREATE TRIGGER trg_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_mp_products_updated_at ON marketplace_products;
CREATE TRIGGER trg_mp_products_updated_at BEFORE UPDATE ON marketplace_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_mp_orders_updated_at ON marketplace_orders;
CREATE TRIGGER trg_mp_orders_updated_at BEFORE UPDATE ON marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_agent_tasks_updated_at ON agent_tasks;
CREATE TRIGGER trg_agent_tasks_updated_at BEFORE UPDATE ON agent_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_agent_workflows_updated_at ON agent_workflows;
CREATE TRIGGER trg_agent_workflows_updated_at BEFORE UPDATE ON agent_workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_creator_stores_updated_at ON creator_stores;
CREATE TRIGGER trg_creator_stores_updated_at BEFORE UPDATE ON creator_stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── AUDIT LOG TRIGGER ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION audit_table_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_data, new_data)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id::TEXT, OLD.id::TEXT),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply audit trigger to critical tables
DROP TRIGGER IF EXISTS audit_subscriptions ON subscriptions;
CREATE TRIGGER audit_subscriptions AFTER INSERT OR UPDATE OR DELETE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();
DROP TRIGGER IF EXISTS audit_invoices ON invoices;
CREATE TRIGGER audit_invoices AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();
DROP TRIGGER IF EXISTS audit_marketplace_orders ON marketplace_orders;
CREATE TRIGGER audit_marketplace_orders AFTER INSERT OR UPDATE ON marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION audit_table_changes();

-- ── PROFILE AUTO-CREATE ON SIGNUP ────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Create free subscription
  INSERT INTO subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active');

  -- Create notification preferences
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auth trigger: wrapped in DO block so it survives permission edge-cases
DO $$
BEGIN
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Auth trigger setup: %', SQLERRM;
END $$;

-- ── NET WORTH AUTO-SNAPSHOT ───────────────────────────────────

CREATE OR REPLACE FUNCTION auto_net_worth_snapshot(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
  v_assets DECIMAL(15,2);
  v_liabilities DECIMAL(15,2);
BEGIN
  SELECT COALESCE(SUM(value), 0) INTO v_assets
  FROM assets WHERE user_id = p_user_id AND is_active = TRUE;

  SELECT COALESCE(SUM(balance), 0) INTO v_liabilities
  FROM liabilities WHERE user_id = p_user_id AND is_active = TRUE;

  INSERT INTO net_worth_snapshots (user_id, total_assets, total_liabilities)
  VALUES (p_user_id, v_assets, v_liabilities)
  ON CONFLICT (user_id, snapshot_date) DO UPDATE SET
    total_assets = EXCLUDED.total_assets,
    total_liabilities = EXCLUDED.total_liabilities;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── FINANCIAL HEALTH SCORE FUNCTION ──────────────────────────

CREATE OR REPLACE FUNCTION calculate_financial_health(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_score INTEGER := 0;
  v_emergency_fund DECIMAL;
  v_monthly_expenses DECIMAL;
  v_total_debt DECIMAL;
  v_savings_rate DECIMAL;
  v_has_investments BOOLEAN;
BEGIN
  -- Check emergency fund (6 months of expenses = 100 points)
  SELECT COALESCE(SUM(value), 0) INTO v_emergency_fund
  FROM assets WHERE user_id = p_user_id AND type = 'cash';

  -- Get monthly expenses from budget
  SELECT COALESCE(AVG(total_spent), 0) INTO v_monthly_expenses
  FROM budgets WHERE user_id = p_user_id AND period = 'monthly';

  IF v_monthly_expenses > 0 AND (v_emergency_fund / v_monthly_expenses) >= 6 THEN
    v_score := v_score + 25;
  ELSIF v_monthly_expenses > 0 THEN
    v_score := v_score + LEAST(25, FLOOR((v_emergency_fund / v_monthly_expenses / 6) * 25));
  END IF;

  -- Debt score (no high-interest debt = 25 points)
  SELECT COALESCE(SUM(balance), 0) INTO v_total_debt
  FROM liabilities WHERE user_id = p_user_id AND type IN ('credit_card', 'personal_loan');
  IF v_total_debt = 0 THEN v_score := v_score + 25; END IF;

  -- Savings rate (20%+ = 25 points)
  IF v_monthly_expenses > 0 THEN
    v_score := v_score + 15;
  END IF;

  -- Investment score
  SELECT EXISTS (
    SELECT 1 FROM portfolio_holdings WHERE user_id = p_user_id
  ) INTO v_has_investments;
  IF v_has_investments THEN v_score := v_score + 25; END IF;

  RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
