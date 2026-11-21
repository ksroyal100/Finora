import { createAdminClient } from '@/lib/supabase/server'
import { withAdmin, apiSuccess, apiError, getPagination, createAuditLog } from '@/lib/security/rbac'
import { z } from 'zod'

// ============================================================
// GET/POST/PATCH/DELETE /api/admin/cc/accounting
// ============================================================
// Backs the founder app's /cc/accounting page. This is real
// double-entry bookkeeping on top of the invoices, subscriptions,
// creator_payouts, and revenue_metrics tables that already existed,
// plus three new tables added in supabase/migrations/006_accounting.sql:
// chart_of_accounts, journal_entries (+journal_entry_lines), expenses.
//
// A few numbers here are estimates, not ledger facts, and are
// labeled as such in comments so nobody mistakes them for audited
// figures:
//   - estimated_cogs falls back to a 15% heuristic when no real
//     'cogs'/'infrastructure' expenses have been logged yet
//   - stripe_fees_30d is 2.9% + $0.30/invoice, Stripe's standard
//     rate — not pulled from Stripe's actual per-charge fee data
// Once real expenses accumulate via the Expenses tab, those feed
// into estimated_cogs and operating_expenses_30d for real.
// ============================================================

const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(n: number) {
  return new Date(Date.now() - n * DAY_MS).toISOString()
}

// ── Recompute one journal entry's totals + validate it balances ──
function sumLines(lines: Array<{ debit: number; credit: number }>) {
  const total_debit = lines.reduce((s, l) => s + Number(l.debit || 0), 0)
  const total_credit = lines.reduce((s, l) => s + Number(l.credit || 0), 0)
  return { total_debit, total_credit }
}

// ── GET ──────────────────────────────────────────────────────
export const GET = withAdmin(async (req) => {
  const url = new URL(req.url)
  const section = url.searchParams.get('section') ?? 'overview'
  const db = createAdminClient()

  // ── OVERVIEW ─────────────────────────────────────────────
  if (section === 'overview') {
    const [
      { data: recentMetrics },
      { data: paidInvoices },
      { data: openInvoices },
      { data: payouts },
      { data: mpOrders30d },
      { data: cogsExpenses30d },
    ] = await Promise.all([
      db.from('revenue_metrics').select('*').order('date', { ascending: false }).limit(90),
      db.from('invoices').select('amount_paid, paid_at, status').eq('status', 'paid'),
      db.from('invoices').select('amount_due, amount_paid, status, due_date, created_at').in('status', ['open', 'draft', 'uncollectible']),
      db.from('creator_payouts').select('amount, status, paid_at'),
      db.from('marketplace_orders').select('total').eq('status', 'completed').gte('created_at', daysAgo(30)),
      db.from('expenses').select('amount, category').in('category', ['cogs', 'infrastructure']).gte('date', daysAgo(30).slice(0, 10)),
    ])

    const latest = recentMetrics?.[0]
    const startingMrr = latest ? Number(latest.mrr) - Number(latest.net_new_mrr) : 0
    const newMrr = Number(latest?.new_mrr ?? 0)
    const expansionMrr = Number(latest?.expansion_mrr ?? 0) // always 0 today — the revenue cron doesn't track upgrades separately yet
    const contractionMrr = Number(latest?.contraction_mrr ?? 0) // same — always 0 today
    const churnedMrr = Number(latest?.churn_mrr ?? 0)
    const netNewMrr = Number(latest?.net_new_mrr ?? 0)
    const endingMrr = Number(latest?.mrr ?? 0)

    const grr = startingMrr > 0 ? ((startingMrr - contractionMrr - churnedMrr) / startingMrr) * 100 : 100
    const nrr = startingMrr > 0 ? ((startingMrr + expansionMrr - contractionMrr - churnedMrr) / startingMrr) * 100 : 100
    const mrrGrowthPct = startingMrr > 0 ? (netNewMrr / startingMrr) * 100 : 0

    const revenueHistory = (recentMetrics ?? [])
      .slice()
      .reverse()
      .map(m => ({ date: m.date, mrr: Number(m.mrr) }))

    const marketplaceRevenue30d = (mpOrders30d ?? []).reduce((s, o) => s + Number(o.total), 0)
    const grossRevenue = endingMrr + marketplaceRevenue30d

    const paidInvoiceCount30d = (paidInvoices ?? []).filter(
      i => i.paid_at && new Date(i.paid_at).getTime() > Date.now() - 30 * DAY_MS
    ).length
    const stripeFees30d = grossRevenue * 0.029 + paidInvoiceCount30d * 0.3

    const realCogs30d = (cogsExpenses30d ?? []).reduce((s, e) => s + Number(e.amount), 0)
    // Fallback heuristic only kicks in before any real expenses are logged.
    const estimatedCogs = realCogs30d > 0 ? realCogs30d : grossRevenue * 0.15

    const grossProfit = grossRevenue - estimatedCogs
    const grossMarginPct = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0

    const { data: opExpenses30d } = await db
      .from('expenses')
      .select('amount')
      .gte('date', daysAgo(30).slice(0, 10))
    const operatingExpenses30d = (opExpenses30d ?? []).reduce((s, e) => s + Number(e.amount), 0)

    const totalInvoiced = [...(paidInvoices ?? []), ...(openInvoices ?? [])]
      .reduce((s: number, i: any) => s + Number(i.amount_due ?? i.amount_paid ?? 0), 0)
    const totalCollected = (paidInvoices ?? []).reduce((s, i) => s + Number(i.amount_paid), 0)
    const arBalance = (openInvoices ?? []).reduce(
      (s, i) => s + Math.max(0, Number(i.amount_due) - Number(i.amount_paid)), 0
    )
    const overdueInvoices = (openInvoices ?? []).filter(i => {
      const ref = i.due_date ?? i.created_at
      return ref && new Date(ref).getTime() < Date.now() - 30 * DAY_MS
    }).length

    const platformFees30d = marketplaceRevenue30d * 0.3
    const pendingCreatorPayouts = (payouts ?? [])
      .filter(p => p.status === 'pending')
      .reduce((s, p) => s + Number(p.amount), 0)
    const paidCreatorPayouts30d = (payouts ?? [])
      .filter(p => p.status === 'paid' && p.paid_at && new Date(p.paid_at).getTime() > Date.now() - 30 * DAY_MS)
      .reduce((s, p) => s + Number(p.amount), 0)

    return apiSuccess({
      mrr: endingMrr,
      arr: Number(latest?.arr ?? endingMrr * 12),
      mrr_growth_pct: mrrGrowthPct,
      nrr, grr,
      churn_rate: Number(latest?.churn_rate ?? 0) * 100,
      cac: Number(latest?.cac ?? 0),
      ltv: Number(latest?.ltv ?? 0),
      waterfall: {
        starting_mrr: startingMrr, new_mrr: newMrr, expansion_mrr: expansionMrr,
        contraction_mrr: contractionMrr, churned_mrr: churnedMrr,
        net_new_mrr: netNewMrr, ending_mrr: endingMrr,
      },
      revenue_history: revenueHistory,
      gross_revenue: grossRevenue,
      estimated_cogs: estimatedCogs,
      gross_profit: grossProfit,
      gross_margin_pct: grossMarginPct,
      marketplace_revenue_30d: marketplaceRevenue30d,
      stripe_fees_30d: stripeFees30d,
      operating_expenses_30d: operatingExpenses30d,
      total_invoiced: totalInvoiced,
      total_collected: totalCollected,
      ar_balance: arBalance,
      open_invoices: openInvoices?.length ?? 0,
      overdue_invoices: overdueInvoices,
      platform_fees_30d: platformFees30d,
      pending_creator_payouts: pendingCreatorPayouts,
      paid_creator_payouts: paidCreatorPayouts30d,
    })
  }

  // ── INVOICES ─────────────────────────────────────────────
  if (section === 'invoices') {
    const status = url.searchParams.get('status') ?? ''
    const { page, perPage, from, to } = getPagination(req)

    let query = db
      .from('invoices')
      .select('id, stripe_invoice_id, status, amount_due, amount_paid, currency, invoice_pdf, hosted_invoice_url, created_at, due_date, paid_at, user:profiles(display_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, count, error } = await query.range(from, to)
    if (error) return apiError(error.message, 500)

    // The founder UI divides by 100 (raw Stripe-cents convention); this
    // table stores dollars, so convert on the way out.
    const invoices = (data ?? []).map((i: any) => ({
      ...i,
      amount_due: Math.round(Number(i.amount_due) * 100),
      amount_paid: Math.round(Number(i.amount_paid) * 100),
    }))

    return apiSuccess({ invoices, total: count ?? 0, page, per_page: perPage })
  }

  // ── PAYOUTS ──────────────────────────────────────────────
  if (section === 'payouts') {
    const status = url.searchParams.get('status') ?? ''
    const { page, perPage, from, to } = getPagination(req)

    let query = db
      .from('creator_payouts')
      .select('id, status, amount, currency, period_start, period_end, order_count, failure_reason, creator:profiles(display_name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)

    const { data, count, error } = await query.range(from, to)
    if (error) return apiError(error.message, 500)

    return apiSuccess({ payouts: data ?? [], total: count ?? 0, page, per_page: perPage })
  }

  // ── JOURNAL ENTRIES ──────────────────────────────────────
  if (section === 'journal') {
    const { page, perPage, from, to } = getPagination(req)

    const { data: entries, count, error } = await db
      .from('journal_entries')
      .select('id, entry_number, date, description, reference, entry_type, status, total_debit, total_credit, void_reason', { count: 'exact' })
      .order('date', { ascending: false })
      .order('entry_number', { ascending: false })
      .range(from, to)

    if (error) return apiError(error.message, 500)
    if (!entries?.length) return apiSuccess({ entries: [], total: count ?? 0, page, per_page: perPage })

    const { data: lines } = await db
      .from('journal_entry_lines')
      .select('id, entry_id, account_code, debit, credit, memo, line_order, account:chart_of_accounts(name)')
      .in('entry_id', entries.map(e => e.id))
      .order('line_order', { ascending: true })

    const linesByEntry = new Map<string, any[]>()
    for (const l of lines ?? []) {
      const arr = linesByEntry.get(l.entry_id) ?? []
      arr.push({ id: l.id, account_code: l.account_code, account_name: (l.account as any)?.name ?? l.account_code, debit: Number(l.debit), credit: Number(l.credit), memo: l.memo })
      linesByEntry.set(l.entry_id, arr)
    }

    const withLines = entries.map(e => ({ ...e, lines: linesByEntry.get(e.id) ?? [] }))
    return apiSuccess({ entries: withLines, total: count ?? 0, page, per_page: perPage })
  }

  // ── EXPENSES ─────────────────────────────────────────────
  if (section === 'expenses') {
    const category = url.searchParams.get('category') ?? ''
    const { page, perPage, from, to } = getPagination(req)

    let query = db
      .from('expenses')
      .select('id, date, vendor, description, amount, currency, category, account_code, payment_method, receipt_url, is_recurring, recurring_interval, notes', { count: 'exact' })
      .order('date', { ascending: false })

    if (category) query = query.eq('category', category)

    const { data, count, error } = await query.range(from, to)
    if (error) return apiError(error.message, 500)

    return apiSuccess({ expenses: data ?? [], total: count ?? 0, page, per_page: perPage })
  }

  // ── CHART OF ACCOUNTS ────────────────────────────────────
  if (section === 'accounts') {
    const { data: accounts, error } = await db
      .from('chart_of_accounts')
      .select('id, code, name, account_type, category, description')
      .eq('is_active', true)
      .order('code', { ascending: true })

    if (error) return apiError(error.message, 500)

    // Balance = sum of posted journal lines for that account. Normal-debit
    // accounts (asset, expense) show debit-credit; normal-credit accounts
    // (liability, equity, revenue) show credit-debit.
    const { data: postedLines } = await db
      .from('journal_entry_lines')
      .select('account_code, debit, credit, entry:journal_entries!inner(status)')
      .eq('entry.status', 'posted')

    const balances = new Map<string, number>()
    for (const l of postedLines ?? []) {
      const prev = balances.get(l.account_code) ?? 0
      balances.set(l.account_code, prev + (Number(l.debit) - Number(l.credit)))
    }

    const result = (accounts ?? []).map(a => {
      const net = balances.get(a.code) ?? 0
      const balance = ['asset', 'expense'].includes(a.account_type) ? net : -net
      return { ...a, balance }
    })

    return apiSuccess(result)
  }

  // ── AR AGING ─────────────────────────────────────────────
  if (section === 'aging') {
    const { data: open } = await db
      .from('invoices')
      .select('id, amount_due, amount_paid, due_date, created_at, user:profiles(display_name, email)')
      .in('status', ['open', 'uncollectible'])

    const buckets = { current: 0, days_30: 0, days_60: 0, days_90: 0, over_90: 0 }
    let total = 0

    const items = (open ?? []).map(inv => {
      const outstanding = Math.max(0, Number(inv.amount_due) - Number(inv.amount_paid))
      const ref = inv.due_date ?? inv.created_at
      const ageDays = ref ? Math.floor((Date.now() - new Date(ref).getTime()) / DAY_MS) : 0

      total += outstanding
      if (ageDays <= 30) buckets.current += outstanding
      else if (ageDays <= 60) buckets.days_30 += outstanding
      else if (ageDays <= 90) buckets.days_60 += outstanding
      else if (ageDays <= 120) buckets.days_90 += outstanding
      else buckets.over_90 += outstanding

      return { id: inv.id, outstanding, age_days: ageDays, user: inv.user }
    })

    return apiSuccess({ buckets, items, total })
  }

  // ── RECONCILIATION ───────────────────────────────────────
  if (section === 'reconcile') {
    const [
      { data: openInvoices },
      { count: activeSubsCount },
      { data: pendingPayouts },
    ] = await Promise.all([
      db.from('invoices').select('amount_due, amount_paid').eq('status', 'open'),
      db.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active').neq('plan', 'free'),
      db.from('creator_payouts').select('amount').eq('status', 'pending'),
    ])

    const openInvoicesValue = (openInvoices ?? []).reduce(
      (s, i) => s + Math.max(0, Number(i.amount_due) - Number(i.amount_paid)), 0
    )
    const pendingPayoutsValue = (pendingPayouts ?? []).reduce((s, p) => s + Number(p.amount), 0)

    return apiSuccess({
      open_invoices_count: openInvoices?.length ?? 0,
      open_invoices_value: openInvoicesValue,
      active_subs_count: activeSubsCount ?? 0,
      pending_payouts_count: pendingPayouts?.length ?? 0,
      pending_payouts_value: pendingPayoutsValue,
      // This is a live-check timestamp, not a stored "last reconciled" record —
      // there's no reconciliation-run table yet, so this just reflects "now".
      last_reconciled_at: new Date().toISOString(),
    })
  }

  return apiError(`Unknown section: ${section}`, 400, 'INVALID_SECTION')
})

// ── POST: create_journal_entry | create_expense ─────────────
const journalLineSchema = z.object({
  account_code: z.string().min(1),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  memo: z.string().max(500).optional(),
})

const createJournalSchema = z.object({
  action: z.literal('create_journal_entry'),
  date: z.string().min(1),
  description: z.string().min(1).max(500),
  reference: z.string().max(200).optional(),
  entry_type: z.enum(['manual', 'adjusting', 'reversing', 'system']).default('manual'),
  lines: z.array(journalLineSchema).min(2),
})

const createExpenseSchema = z.object({
  action: z.literal('create_expense'),
  date: z.string().min(1),
  vendor: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  category: z.enum(['operating', 'infrastructure', 'cogs', 'marketing', 'legal', 'contractor', 'other']),
  account_code: z.string().min(1),
  payment_method: z.enum(['card', 'bank_transfer', 'stripe', 'paypal', 'check', 'other']).default('card'),
  receipt_url: z.string().url().optional().or(z.literal('')),
  is_recurring: z.boolean().default(false),
  recurring_interval: z.enum(['monthly', 'quarterly', 'annual']).optional(),
  notes: z.string().max(1000).optional(),
})

export const POST = withAdmin(async (req, { userId }) => {
  const body = await req.json().catch(() => ({}))
  const db = createAdminClient()

  if (body.action === 'create_journal_entry') {
    const parsed = createJournalSchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed: ' + parsed.error.issues.map(i => i.message).join(', '), 400)
    const { date, description, reference, entry_type, lines } = parsed.data

    const { total_debit, total_credit } = sumLines(lines)
    if (Math.abs(total_debit - total_credit) > 0.01) {
      return apiError('Journal entry does not balance — total debits must equal total credits', 400, 'UNBALANCED')
    }
    if (total_debit === 0) return apiError('Journal entry cannot be all zeros', 400)

    // Validate every account_code actually exists before inserting anything.
    const codes = [...new Set(lines.map(l => l.account_code))]
    const { data: validAccounts } = await db.from('chart_of_accounts').select('code').in('code', codes)
    const validCodes = new Set((validAccounts ?? []).map(a => a.code))
    const invalid = codes.filter(c => !validCodes.has(c))
    if (invalid.length) return apiError(`Unknown account code(s): ${invalid.join(', ')}`, 400)

    const { data: entry, error: entryErr } = await db
      .from('journal_entries')
      .insert({ date, description, reference: reference || null, entry_type, status: 'posted', total_debit, total_credit, created_by: userId })
      .select('id, entry_number, date, description, reference, entry_type, status, total_debit, total_credit')
      .single()

    if (entryErr || !entry) return apiError(entryErr?.message ?? 'Failed to create journal entry', 500)

    const { error: linesErr } = await db.from('journal_entry_lines').insert(
      lines.map((l, i) => ({ entry_id: entry.id, account_code: l.account_code, debit: l.debit, credit: l.credit, memo: l.memo ?? null, line_order: i }))
    )
    if (linesErr) {
      // Roll back the header row if the lines failed to insert, so we never
      // leave an entry with no lines sitting in the ledger.
      await db.from('journal_entries').delete().eq('id', entry.id)
      return apiError(linesErr.message, 500)
    }

    await createAuditLog({ adminId: userId, action: 'journal_entry_created', resourceType: 'journal_entry', resourceId: entry.id, newData: { description, total_debit } })

    const { data: accountNames } = await db.from('chart_of_accounts').select('code, name').in('code', codes)
    const nameByCode = new Map((accountNames ?? []).map(a => [a.code, a.name]))
    const fullLines = lines.map((l, i) => ({ id: `${entry.id}-${i}`, account_code: l.account_code, account_name: nameByCode.get(l.account_code) ?? l.account_code, debit: l.debit, credit: l.credit, memo: l.memo ?? null }))

    return apiSuccess({ entry: { ...entry, lines: fullLines } }, 201)
  }

  if (body.action === 'create_expense') {
    const parsed = createExpenseSchema.safeParse(body)
    if (!parsed.success) return apiError('Validation failed: ' + parsed.error.issues.map(i => i.message).join(', '), 400)
    const d = parsed.data

    const { data: account } = await db.from('chart_of_accounts').select('code').eq('code', d.account_code).single()
    if (!account) return apiError(`Unknown account code: ${d.account_code}`, 400)

    // Auto-generate the backing journal entry: Debit the chosen expense
    // account, Credit Cash & Bank (1000) — assumes the expense was paid
    // immediately, which matches every payment_method option offered in
    // the UI (card, bank transfer, etc. — none of them are "on credit").
    const { data: journalEntry, error: jeErr } = await db
      .from('journal_entries')
      .insert({
        date: d.date,
        description: `Expense: ${d.vendor} — ${d.description}`,
        reference: null,
        entry_type: 'system',
        status: 'posted',
        total_debit: d.amount,
        total_credit: d.amount,
        created_by: userId,
      })
      .select('id')
      .single()

    if (jeErr || !journalEntry) return apiError(jeErr?.message ?? 'Failed to create backing journal entry', 500)

    const { error: linesErr } = await db.from('journal_entry_lines').insert([
      { entry_id: journalEntry.id, account_code: d.account_code, debit: d.amount, credit: 0, memo: d.vendor, line_order: 0 },
      { entry_id: journalEntry.id, account_code: '1000', debit: 0, credit: d.amount, memo: 'Cash payment', line_order: 1 },
    ])
    if (linesErr) {
      await db.from('journal_entries').delete().eq('id', journalEntry.id)
      return apiError(linesErr.message, 500)
    }

    const { data: expense, error: expErr } = await db
      .from('expenses')
      .insert({
        date: d.date, vendor: d.vendor, description: d.description, amount: d.amount,
        currency: d.currency, category: d.category, account_code: d.account_code,
        payment_method: d.payment_method, receipt_url: d.receipt_url || null,
        is_recurring: d.is_recurring, recurring_interval: d.recurring_interval ?? null,
        notes: d.notes ?? null, journal_entry_id: journalEntry.id, created_by: userId,
      })
      .select('id, date, vendor, description, amount, currency, category, account_code, payment_method, receipt_url, is_recurring, recurring_interval, notes')
      .single()

    if (expErr || !expense) {
      await db.from('journal_entries').delete().eq('id', journalEntry.id) // cascades lines too
      return apiError(expErr?.message ?? 'Failed to create expense', 500)
    }

    await createAuditLog({ adminId: userId, action: 'expense_created', resourceType: 'expense', resourceId: expense.id, newData: { vendor: d.vendor, amount: d.amount } })

    return apiSuccess(expense, 201)
  }

  return apiError(`Unknown action: ${body.action}`, 400, 'INVALID_ACTION')
})

// ── PATCH: void_journal_entry | approve_payout | deny_payout | void_invoice ──
export const PATCH = withAdmin(async (req, { userId }) => {
  const body = await req.json().catch(() => ({}))
  const db = createAdminClient()

  if (body.action === 'void_journal_entry') {
    const schema = z.object({ id: z.string().uuid(), reason: z.string().min(1).max(500) })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError('id and reason are required', 400)

    const { data: existing } = await db.from('journal_entries').select('status').eq('id', parsed.data.id).single()
    if (!existing) return apiError('Journal entry not found', 404)
    if (existing.status === 'voided') return apiError('Entry is already voided', 400)

    const { data: entry, error } = await db
      .from('journal_entries')
      .update({ status: 'voided', void_reason: parsed.data.reason, voided_at: new Date().toISOString() })
      .eq('id', parsed.data.id)
      .select('id, entry_number, date, description, reference, entry_type, status, total_debit, total_credit, void_reason')
      .single()

    if (error || !entry) return apiError(error?.message ?? 'Failed to void entry', 500)

    const { data: lines } = await db
      .from('journal_entry_lines')
      .select('id, account_code, debit, credit, memo, account:chart_of_accounts(name)')
      .eq('entry_id', entry.id)
      .order('line_order', { ascending: true })

    await createAuditLog({ adminId: userId, action: 'journal_entry_voided', resourceType: 'journal_entry', resourceId: entry.id, metadata: { reason: parsed.data.reason } })

    return apiSuccess({
      ...entry,
      lines: (lines ?? []).map(l => ({ id: l.id, account_code: l.account_code, account_name: (l.account as any)?.name ?? l.account_code, debit: Number(l.debit), credit: Number(l.credit), memo: l.memo })),
    })
  }

  if (body.action === 'approve_payout') {
    const schema = z.object({ id: z.string().uuid() })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError('id is required', 400)

    const { data: payout } = await db.from('creator_payouts').select('amount, status').eq('id', parsed.data.id).single()
    if (!payout) return apiError('Payout not found', 404)
    if (payout.status !== 'pending') return apiError(`Payout is already ${payout.status}`, 400)

    const { error } = await db.from('creator_payouts').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', parsed.data.id)
    if (error) return apiError(error.message, 500)

    // Backing journal entry: Debit AP-Creators (2000), Credit Cash (1000) —
    // cash leaving the business to pay a creator.
    const { data: je } = await db.from('journal_entries').insert({
      date: new Date().toISOString().slice(0, 10),
      description: `Creator payout approved`,
      entry_type: 'system', status: 'posted',
      total_debit: payout.amount, total_credit: payout.amount, created_by: userId,
    }).select('id').single()

    if (je) {
      await db.from('journal_entry_lines').insert([
        { entry_id: je.id, account_code: '2000', debit: payout.amount, credit: 0, memo: 'Payout approved', line_order: 0 },
        { entry_id: je.id, account_code: '1000', debit: 0, credit: payout.amount, memo: 'Cash payment', line_order: 1 },
      ])
    }

    await createAuditLog({ adminId: userId, action: 'payout_approved', resourceType: 'creator_payout', resourceId: parsed.data.id, newData: { amount: payout.amount } })

    return apiSuccess({ updated: true })
  }

  if (body.action === 'deny_payout') {
    const schema = z.object({ id: z.string().uuid(), reason: z.string().min(1).max(500) })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError('id and reason are required', 400)

    const { error } = await db.from('creator_payouts').update({
      status: 'failed', failure_reason: parsed.data.reason, failed_at: new Date().toISOString(),
    }).eq('id', parsed.data.id)
    if (error) return apiError(error.message, 500)

    await createAuditLog({ adminId: userId, action: 'payout_denied', resourceType: 'creator_payout', resourceId: parsed.data.id, metadata: { reason: parsed.data.reason } })

    return apiSuccess({ updated: true })
  }

  if (body.action === 'void_invoice') {
    const schema = z.object({ id: z.string().uuid() })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError('id is required', 400)

    const { data: invoice } = await db.from('invoices').select('status').eq('id', parsed.data.id).single()
    if (!invoice) return apiError('Invoice not found', 404)
    if (invoice.status !== 'open') return apiError('Only open invoices can be voided', 400)

    const { error } = await db.from('invoices').update({ status: 'void' }).eq('id', parsed.data.id)
    if (error) return apiError(error.message, 500)

    await createAuditLog({ adminId: userId, action: 'invoice_voided', resourceType: 'invoice', resourceId: parsed.data.id })

    return apiSuccess({ updated: true })
  }

  return apiError(`Unknown action: ${body.action}`, 400, 'INVALID_ACTION')
})

// ── DELETE: delete_expense (?id=) ───────────────────────────
export const DELETE = withAdmin(async (req, { userId }) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return apiError('id is required', 400)

  const db = createAdminClient()

  const { data: expense } = await db.from('expenses').select('vendor, amount, journal_entry_id').eq('id', id).single()
  if (!expense) return apiError('Expense not found', 404)

  // Void the backing journal entry too, so deleting an expense reverses
  // its financial effect rather than leaving a phantom entry in the ledger.
  if (expense.journal_entry_id) {
    await db.from('journal_entries').update({
      status: 'voided', void_reason: 'Expense deleted', voided_at: new Date().toISOString(),
    }).eq('id', expense.journal_entry_id)
  }

  const { error } = await db.from('expenses').delete().eq('id', id)
  if (error) return apiError(error.message, 500)

  await createAuditLog({ adminId: userId, action: 'expense_deleted', resourceType: 'expense', resourceId: id, oldData: { vendor: expense.vendor, amount: expense.amount } })

  return apiSuccess({ deleted: true })
})
