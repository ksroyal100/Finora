// src/lib/reports/adminExcelReport.ts
//
// Renders an AdminReport to an XLSX buffer with proper numeric cells and
// number formats (not pre-formatted strings), so finance can sum, chart and
// pivot straight from the file. Uses xlsx-populate, already a dependency of
// the user-facing report. No password: this is an internal admin export.

import { AdminReport, Metric, formatDelta, deltaTone } from './adminReportData'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const XlsxPopulate = require('xlsx-populate')

const HEADER_FILL = '111318'
const HEADER_FONT = 'FFFFFF'
const GOOD = '1FA34C'
const BAD = 'D92D20'
const FLAT = '6B7280'

const FMT: Record<Metric['format'], string> = {
  number: '#,##0',
  currency: '"$"#,##0.00',
  percent: '0.0"%"',
  decimal: '0.00',
}

const TONE = { good: GOOD, bad: BAD, flat: FLAT } as const
const PERIOD_TITLE = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' } as const

export async function buildAdminExcelReport(report: AdminReport): Promise<Buffer> {
  const wb = await XlsxPopulate.fromBlankAsync()

  // ── Summary sheet ──────────────────────────────────────────
  const sum = wb.sheet(0).name('Summary')
  sum.cell('A1').value(`Finora ${PERIOD_TITLE[report.range.period]} Business Report`).style({ bold: true, fontSize: 16 })
  sum.cell('A2').value(report.range.label + (report.range.isPartial ? '  (in progress — partial)' : '')).style({ fontColor: FLAT })
  sum.cell('A3').value(`Compared with: ${report.previousRange.label}`).style({ fontColor: FLAT, fontSize: 9 })
  sum.cell('A4').value(`Generated ${new Date(report.generatedAt).toUTCString()}`).style({ fontColor: FLAT, fontSize: 9 })

  let row = 6
  sum.cell(`A${row}`).value('Headline numbers').style({ bold: true, fontSize: 12 })
  row += 1
  row = writeMetrics(sum, row, report.headline)
  sum.column('A').width(40)
  ;['B', 'C', 'D'].forEach(c => sum.column(c).width(18))

  // ── One sheet per section ──────────────────────────────────
  const sectionSheets: Array<[string, Metric[]]> = [
    ['Users', report.sections.users],
    ['Revenue', report.sections.revenue],
    ['Subscriptions', report.sections.subscriptions],
    ['Marketplace', report.sections.marketplace],
    ['Engagement', report.sections.engagement],
    ['Security', report.sections.security],
    ['Operations', report.sections.operations],
  ]
  for (const [name, metrics] of sectionSheets) {
    const sh = wb.addSheet(name)
    writeMetrics(sh, 1, metrics)
    sh.column('A').width(42)
    ;['B', 'C', 'D'].forEach(c => sh.column(c).width(18))
    sh.freezePanes(0, 1)
  }

  // ── Daily breakdown (numeric, chart-ready) ─────────────────
  const daily = wb.addSheet('Daily')
  writeHeader(daily, 1, ['Date', 'Signups', 'Revenue', 'Expenses', 'Net', 'AI queries', 'Posts'])
  report.daily.forEach((d, i) => {
    const r = i + 2
    daily.cell(r, 1).value(d.date)
    daily.cell(r, 2).value(d.signups).style({ numberFormat: FMT.number })
    daily.cell(r, 3).value(d.revenue).style({ numberFormat: FMT.currency })
    daily.cell(r, 4).value(d.expenses).style({ numberFormat: FMT.currency })
    // live formula so edits to the sheet keep Net correct
    daily.cell(r, 5).formula(`C${r}-D${r}`).style({ numberFormat: FMT.currency })
    daily.cell(r, 6).value(d.aiQueries).style({ numberFormat: FMT.number })
    daily.cell(r, 7).value(d.posts).style({ numberFormat: FMT.number })
  })
  if (report.daily.length) {
    const t = report.daily.length + 2
    const last = t - 1
    daily.cell(t, 1).value('TOTAL').style({ bold: true })
    ;(['B', 'C', 'D', 'E', 'F', 'G'] as const).forEach((col, i) => {
      daily.cell(`${col}${t}`).formula(`SUM(${col}2:${col}${last})`)
        .style({ bold: true, numberFormat: i === 0 || i >= 4 ? FMT.number : FMT.currency, fill: 'F3F4F6' })
    })
    daily.cell(`A${t}`).style({ fill: 'F3F4F6' })
  }
  daily.freezePanes(0, 1)
  for (let c = 1; c <= 7; c++) daily.column(c).width(16)

  // ── Breakdowns ─────────────────────────────────────────────
  const br = wb.addSheet('Breakdowns')
  let r = 1
  r = writeSimple(br, r, 'Active subscribers by plan (current)', ['Plan', 'Subscribers'],
    report.planDistribution.map(x => [x.plan, x.subscribers]), [null, FMT.number])
  r = writeSimple(br, r, 'New subscriptions by plan (this period)', ['Plan', 'New'],
    report.newSubscriptionsByPlan.map(x => [x.plan, x.count]), [null, FMT.number])
  r = writeSimple(br, r, 'Expenses by category', ['Category', 'Amount'],
    report.expensesByCategory.map(x => [x.category, x.amount]), [null, FMT.currency])
  r = writeSimple(br, r, 'Top marketplace products', ['Product', 'Units', 'Revenue'],
    report.topProducts.map(x => [x.title, x.orders, x.revenue]), [null, FMT.number, FMT.currency])
  writeSimple(br, r, 'Security events by severity', ['Severity', 'Events'],
    report.securityBySeverity.map(x => [x.severity, x.count]), [null, FMT.number])
  br.column('A').width(40)
  ;['B', 'C'].forEach(c => br.column(c).width(18))

  // ── Notes ──────────────────────────────────────────────────
  const notes = wb.addSheet('Notes')
  notes.cell('A1').value('Notes & methodology').style({ bold: true, fontSize: 12 })
  report.notes.forEach((n, i) => notes.cell(i + 3, 1).value(n).style({ wrapText: true, verticalAlignment: 'top' }))
  notes.column('A').width(120)

  return (await wb.outputAsync({ type: 'nodebuffer' })) as Buffer
}

// ── helpers ───────────────────────────────────────────────────

function writeHeader(sheet: any, rowNum: number, headers: string[]) {
  headers.forEach((h, i) => {
    sheet.cell(rowNum, i + 1).value(h).style({
      bold: true, fill: HEADER_FILL, fontColor: HEADER_FONT,
      horizontalAlignment: i === 0 ? 'left' : 'right',
    })
  })
}

// Writes a Metric table and returns the next free row.
function writeMetrics(sheet: any, startRow: number, metrics: Metric[]): number {
  writeHeader(sheet, startRow, ['Metric', 'This period', 'Previous', 'Change'])
  metrics.forEach((m, i) => {
    const r = startRow + 1 + i
    sheet.cell(r, 1).value(m.label)
    sheet.cell(r, 2).value(m.value).style({ numberFormat: FMT[m.format], bold: true })
    sheet.cell(r, 3).value(m.previous).style({ numberFormat: FMT[m.format] })
    sheet.cell(r, 4).value(formatDelta(m)).style({
      bold: true, horizontalAlignment: 'right', fontColor: TONE[deltaTone(m)],
    })
  })
  return startRow + metrics.length + 2
}

function writeSimple(
  sheet: any, startRow: number, title: string, headers: string[],
  rows: (string | number)[][], formats: (string | null)[]
): number {
  sheet.cell(startRow, 1).value(title).style({ bold: true, fontSize: 12 })
  writeHeader(sheet, startRow + 1, headers)
  rows.forEach((vals, i) => {
    vals.forEach((v, c) => {
      const cell = sheet.cell(startRow + 2 + i, c + 1).value(v)
      if (formats[c]) cell.style({ numberFormat: formats[c] })
    })
  })
  return startRow + rows.length + 4
}
