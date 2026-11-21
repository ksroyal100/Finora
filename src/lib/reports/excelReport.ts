// src/lib/reports/excelReport.ts
//
// Renders a ReportData object to a password-protected XLSX buffer.
// xlsx-populate implements real Office Open XML Agile Encryption — the
// workbook prompts for this password when opened in Excel, Numbers, or
// LibreOffice Calc, not just a "protect sheet" click-through.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const XlsxPopulate = require('xlsx-populate')
import { ReportData } from './getReportData'

export async function buildExcelReport(data: ReportData, password: string): Promise<Buffer> {
  const workbook = await XlsxPopulate.fromBlankAsync()
  const currency = data.profile.currency || 'USD'

  // ── Summary sheet ──────────────────────────────────────────
  const summary = workbook.sheet(0).name('Summary')
  let row = 1
  summary.cell(`A${row}`).value('Finora Financial Report').style({ bold: true, fontSize: 16 })
  row += 1
  summary.cell(`A${row}`).value(`${data.profile.name} · ${data.profile.email}`).style({ fontColor: '6B7280' })
  row += 1
  summary.cell(`A${row}`).value(`Generated ${new Date(data.generatedAt).toLocaleString()}`).style({ fontColor: '6B7280', fontSize: 9 })
  row += 2

  const summaryRows: [string, number | string][] = [
    ['Total Assets', data.netWorth.totalAssets],
    ['Total Liabilities', data.netWorth.totalLiabilities],
    ['Net Worth', data.netWorth.netWorth],
  ]
  if (data.portfolio) {
    summaryRows.push(['Portfolio Value', data.portfolio.totalValue], ['Portfolio Gain/Loss', data.portfolio.totalGainLoss])
  }
  if (data.budget) {
    summaryRows.push(['Monthly Income', data.budget.totalIncome], ['Monthly Spent', data.budget.totalSpent], ['Monthly Remaining', data.budget.remaining])
  }
  summaryRows.forEach(([label, value]) => {
    summary.cell(`A${row}`).value(label).style({ bold: true })
    summary.cell(`B${row}`).value(value)
    if (typeof value === 'number') summary.cell(`B${row}`).style({ numberFormat: `"${currencySymbol(currency)}"#,##0` })
    row += 1
  })
  summary.column('A').width(26)
  summary.column('B').width(20)

  // ── Assets & Liabilities sheet ─────────────────────────────
  const netWorthSheet = workbook.addSheet('Net Worth')
  writeTable(netWorthSheet, 1, ['Asset', 'Type', 'Institution', 'Value'],
    data.netWorth.assets.map(a => [a.name, a.type, a.institution ?? '—', a.value]))
  const liabStartRow = data.netWorth.assets.length + 4
  netWorthSheet.cell(`A${liabStartRow - 1}`).value('Liabilities').style({ bold: true, fontSize: 12 })
  writeTable(netWorthSheet, liabStartRow, ['Liability', 'Type', 'APR %', 'Balance'],
    data.netWorth.liabilities.map(l => [l.name, l.type, l.interest_rate ?? '—', l.balance]))

  // ── Portfolio sheet ─────────────────────────────────────────
  if (data.portfolio && data.portfolio.holdings.length > 0) {
    const portfolioSheet = workbook.addSheet('Portfolio')
    writeTable(portfolioSheet, 1, ['Symbol', 'Name', 'Quantity', 'Market Value', 'Unrealized Gain', 'Gain %', 'Weight %'],
      data.portfolio.holdings.map(h => [h.symbol, h.name ?? '', h.quantity, h.market_value, h.unrealized_gain, h.unrealized_gain_pct, h.weight_pct]))
  }

  // ── Goals sheet ───────────────────────────────────────────
  if (data.goals.length > 0) {
    const goalsSheet = workbook.addSheet('Goals')
    writeTable(goalsSheet, 1, ['Goal', 'Category', 'Target', 'Current', 'Progress %', 'Target Date'],
      data.goals.map(g => [g.title, g.category, g.target_amount, g.current_amount, g.progress_pct, g.target_date ?? '—']))
  }

  const buffer: Buffer = await workbook.outputAsync({ type: 'nodebuffer', password })
  return buffer
}

function writeTable(sheet: any, startRow: number, headers: string[], rows: (string | number)[][]) {
  headers.forEach((h, i) => {
    const cell = sheet.cell(startRow, i + 1)
    cell.value(h)
    cell.style({ bold: true, fill: 'F3F4F6' })
  })
  rows.forEach((r, ri) => {
    r.forEach((val, ci) => sheet.cell(startRow + 1 + ri, ci + 1).value(val))
  })
  headers.forEach((_, i) => sheet.column(i + 1).width(18))
}

function currencySymbol(code: string) {
  switch (code) {
    case 'USD': return '$'
    case 'GBP': return '£'
    case 'EUR': return '€'
    case 'CAD': return 'CA$'
    case 'AUD': return 'AU$'
    default: return '$'
  }
}
