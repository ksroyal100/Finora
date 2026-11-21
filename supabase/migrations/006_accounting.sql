-- ============================================================
-- 006_accounting.sql
-- Chart of accounts, double-entry journal, and expense tracking
-- for the founder app's /cc/accounting page. None of this existed
-- before — the founder frontend was built ahead of the backend
-- for this specific feature.
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS journal_entry_number_seq START 1;

-- ── CHART OF ACCOUNTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  category TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── JOURNAL ENTRIES (double-entry bookkeeping) ─────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_number TEXT UNIQUE NOT NULL DEFAULT ('JE-' || LPAD(NEXTVAL('journal_entry_number_seq')::TEXT, 6, '0')),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  entry_type TEXT NOT NULL DEFAULT 'manual' CHECK (entry_type IN ('manual','adjusting','reversing','system')),
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('draft','posted','voided')),
  total_debit DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_credit DECIMAL(12,2) NOT NULL DEFAULT 0,
  void_reason TEXT,
  voided_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL REFERENCES chart_of_accounts(code),
  debit DECIMAL(12,2) NOT NULL DEFAULT 0,
  credit DECIMAL(12,2) NOT NULL DEFAULT 0,
  memo TEXT,
  line_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0)) -- a line is either a debit or a credit, never both
);

-- ── EXPENSES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  vendor TEXT NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  category TEXT NOT NULL DEFAULT 'operating' CHECK (category IN ('operating','infrastructure','cogs','marketing','legal','contractor','other')),
  account_code TEXT REFERENCES chart_of_accounts(code),
  payment_method TEXT DEFAULT 'card' CHECK (payment_method IN ('card','bank_transfer','stripe','paypal','check','other')),
  receipt_url TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_interval TEXT CHECK (recurring_interval IN ('monthly','quarterly','annual') OR recurring_interval IS NULL),
  notes TEXT,
  journal_entry_id UUID REFERENCES journal_entries(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS journal_entries_date_idx ON journal_entries(date DESC);
CREATE INDEX IF NOT EXISTS journal_entries_status_idx ON journal_entries(status);
CREATE INDEX IF NOT EXISTS journal_entry_lines_entry_idx ON journal_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS journal_entry_lines_account_idx ON journal_entry_lines(account_code);
CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses(category);

-- ── RLS: founder/admin-only, no client-side access at all ─────
-- (mirrors vault_documents / agent_conversations — these tables are
-- only ever touched via createAdminClient() from withAdmin-guarded
-- API routes, but RLS is still enabled as defense-in-depth: if the
-- anon/authenticated key were ever used against these tables by
-- mistake, is_admin() still blocks it.)
ALTER TABLE chart_of_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses            ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chart_of_accounts_admin" ON chart_of_accounts FOR ALL USING (is_admin());
CREATE POLICY "journal_entries_admin"   ON journal_entries   FOR ALL USING (is_admin());
CREATE POLICY "journal_entry_lines_admin" ON journal_entry_lines FOR ALL USING (is_admin());
CREATE POLICY "expenses_admin"          ON expenses          FOR ALL USING (is_admin());

-- ── SEED: default chart of accounts ────────────────────────────
INSERT INTO chart_of_accounts (code, name, account_type, category, description) VALUES
  ('1000', 'Cash & Bank',                          'asset',     'current_asset',      'Stripe balance + connected bank accounts'),
  ('1100', 'Accounts Receivable',                  'asset',     'current_asset',      'Unpaid customer invoices'),
  ('2000', 'Accounts Payable — Creators',          'liability', 'current_liability',  'Pending creator marketplace payouts'),
  ('2100', 'Sales Tax Payable',                    'liability', 'current_liability',  'Collected sales tax owed to authorities'),
  ('3000', 'Retained Earnings',                    'equity',    'equity',             'Accumulated profit/loss'),
  ('4000', 'Subscription Revenue',                 'revenue',   'operating_revenue',  'MRR from Pro/Plus/Elite plans'),
  ('4100', 'Marketplace Revenue',                  'revenue',   'operating_revenue',  'Creator marketplace sales (gross)'),
  ('5000', 'Cost of Goods Sold',                   'expense',   'cogs',               'Direct cost of delivering the service'),
  ('7000', 'Software & Infrastructure',            'expense',   'operating',          'Vercel, Supabase, hosting'),
  ('7100', 'AI / API Costs',                       'expense',   'operating',          'Groq, Qdrant, and other model/inference usage'),
  ('7200', 'Marketing & Advertising',              'expense',   'operating',          'Ads, content, growth spend'),
  ('7300', 'Contractors & Professional Services',  'expense',   'operating',          'Freelancers, legal, accounting'),
  ('7400', 'Payment Processing Fees',               'expense',  'operating',          'Stripe processing fees'),
  ('7900', 'Other Operating Expenses',              'expense',  'operating',          'Miscellaneous')
ON CONFLICT (code) DO NOTHING;
