// src/lib/reports/adminPdfReport.ts
//
// Renders an AdminReport to a PDF buffer. Uses the same standalone pdfkit
// build as the user-facing report (see pdfReport.ts for why: it embeds font
// metrics so it survives Next.js bundling). Unlike the user-facing export,
// this file is NOT password-encrypted — it's generated on demand for
// authenticated admins and streamed straight to the browser.

import PDFDocument from 'pdfkit/js/pdfkit.standalone.js'
import { AdminReport, Metric, formatMetricValue, formatDelta, deltaTone, money } from './adminReportData'

const GREEN = '#1FA34C'
const RED = '#D92D20'
const DARK = '#111318'
const GRAY = '#6B7280'
const LIGHT = '#F3F4F6'
const RULE = '#E5E7EB'
const BLUE = '#2563EB'

const TONE_COLOR = { good: GREEN, bad: RED, flat: GRAY } as const

const PERIOD_TITLE = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' } as const

export async function buildAdminPdfReport(report: AdminReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 44,
      bufferPages: true, // lets us stamp "Page X of Y" in the footer at the end
      info: {
        Title: `Finora ${PERIOD_TITLE[report.range.period]} Business Report — ${report.range.label}`,
        Author: 'Finora Command Center',
      },
    })

    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const left = doc.page.margins.left
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right

    // ── Header band ──────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 92).fill(DARK)
    doc.fillColor('#30D158').font('Helvetica-Bold').fontSize(9)
      .text('FINORA · COMMAND CENTER', left, 24, { characterSpacing: 1 })
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(20)
      .text(`${PERIOD_TITLE[report.range.period]} Business Report`, left, 40)
    doc.fillColor('#B6BCC8').font('Helvetica').fontSize(10)
      .text(`${report.range.label}${report.range.isPartial ? '  ·  in progress (partial)' : ''}`, left, 66)
    doc.y = 110

    doc.fillColor(GRAY).font('Helvetica').fontSize(8.5)
      .text(`Compared with previous ${report.range.period === 'daily' ? 'day' : report.range.period === 'weekly' ? 'week' : 'month'}: ${report.previousRange.label}   ·   Generated ${new Date(report.generatedAt).toUTCString()}`, left, doc.y, { width })
    doc.moveDown(0.8)

    // ── Headline KPI cards (2 rows × 4) ──────────────────────
    sectionTitle(doc, 'Headline numbers')
    kpiGrid(doc, report.headline, left, width)

    // ── Daily trend chart ────────────────────────────────────
    if (report.daily.length > 1) {
      ensureSpace(doc, 190)
      sectionTitle(doc, 'Revenue by day')
      barChart(doc, report.daily.map(d => ({ label: d.date.slice(5), value: d.revenue })), left, width, 110)
      doc.moveDown(0.4)
    }

    // ── Metric sections ──────────────────────────────────────
    metricTable(doc, 'Users & growth', report.sections.users)
    metricTable(doc, 'Revenue & finance', report.sections.revenue)
    metricTable(doc, 'Subscriptions', report.sections.subscriptions)
    metricTable(doc, 'Marketplace', report.sections.marketplace)
    metricTable(doc, 'Engagement & product usage', report.sections.engagement)
    metricTable(doc, 'Security', report.sections.security)
    metricTable(doc, 'Operations & AI agents', report.sections.operations)

    // ── Breakdowns ───────────────────────────────────────────
    simpleTable(doc, 'Active subscribers by plan (current)', ['Plan', 'Subscribers'],
      report.planDistribution.map(r => [r.plan.toUpperCase(), String(r.subscribers)]))

    if (report.newSubscriptionsByPlan.length)
      simpleTable(doc, 'New subscriptions by plan (this period)', ['Plan', 'New'],
        report.newSubscriptionsByPlan.map(r => [r.plan.toUpperCase(), String(r.count)]))

    if (report.expensesByCategory.length)
      simpleTable(doc, 'Expenses by category', ['Category', 'Amount'],
        report.expensesByCategory.map(r => [r.category.replace(/_/g, ' '), usd(r.amount)]))

    if (report.topProducts.length)
      simpleTable(doc, 'Top marketplace products', ['Product', 'Units', 'Revenue'],
        report.topProducts.map(r => [r.title, String(r.orders), usd(r.revenue)]), [0.6, 0.15, 0.25])

    simpleTable(doc, 'Security events by severity', ['Severity', 'Events'],
      report.securityBySeverity.map(r => [r.severity.toUpperCase(), String(r.count)]))

    // ── Daily breakdown ──────────────────────────────────────
    if (report.daily.length > 1) {
      simpleTable(doc, 'Day-by-day breakdown',
        ['Date', 'Signups', 'Revenue', 'Expenses', 'AI queries', 'Posts'],
        report.daily.map(d => [d.date, String(d.signups), usd(d.revenue), usd(d.expenses), String(d.aiQueries), String(d.posts)]))
    }

    // ── Notes ────────────────────────────────────────────────
    ensureSpace(doc, 80)
    sectionTitle(doc, 'Notes & methodology')
    doc.font('Helvetica').fontSize(8.5).fillColor(GRAY)
    report.notes.forEach(n => doc.text(`•  ${n}`, left, doc.y, { width, lineGap: 2 }).moveDown(0.25))

    // ── Footer on every page ─────────────────────────────────
    const range = doc.bufferedPageRange()
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i)
      const y = doc.page.height - 30
      // Writing below the bottom margin makes pdfkit add a page; zero it out while stamping.
      const prevBottom = doc.page.margins.bottom
      doc.page.margins.bottom = 0
      doc.fillColor(GRAY).font('Helvetica').fontSize(8)
        .text('Finora · Confidential — internal use only', left, y, { width: width / 2, lineBreak: false })
        .text(`Page ${i + 1} of ${range.count}`, left + width / 2, y, { width: width / 2, align: 'right', lineBreak: false })
      doc.page.margins.bottom = prevBottom
    }

    doc.end()
  })
}

// ── helpers ───────────────────────────────────────────────────

function usd(n: number) {
  return money(n ?? 0)
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom - 20) doc.addPage()
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string) {
  ensureSpace(doc, 95) // title + header row + a few rows, so a heading is never orphaned
  doc.moveDown(0.5)
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(13).text(text, doc.page.margins.left, doc.y)
  const y = doc.y + 2
  doc.moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor(RULE).lineWidth(1).stroke()
  doc.y = y + 8
}

function kpiGrid(doc: PDFKit.PDFDocument, metrics: Metric[], left: number, width: number) {
  const cols = 4
  const gap = 8
  const cardW = (width - gap * (cols - 1)) / cols
  const cardH = 62
  ensureSpace(doc, cardH * 2 + gap + 10)
  const top = doc.y
  metrics.forEach((m, i) => {
    const x = left + (i % cols) * (cardW + gap)
    const y = top + Math.floor(i / cols) * (cardH + gap)
    doc.roundedRect(x, y, cardW, cardH, 6).fill(LIGHT)
    doc.fillColor(GRAY).font('Helvetica').fontSize(7.5).text(m.label, x + 8, y + 8, { width: cardW - 16, height: 10, ellipsis: true })
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(15).text(formatMetricValue(m), x + 8, y + 22, { width: cardW - 16, lineBreak: false })
    doc.fillColor(TONE_COLOR[deltaTone(m)]).font('Helvetica-Bold').fontSize(8)
      .text(`${formatDelta(m)} vs prev`, x + 8, y + 45, { width: cardW - 16, lineBreak: false })
  })
  doc.y = top + Math.ceil(metrics.length / cols) * (cardH + gap)
}

function metricTable(doc: PDFKit.PDFDocument, title: string, metrics: Metric[]) {
  sectionTitle(doc, title)
  const left = doc.page.margins.left
  const width = doc.page.width - left - doc.page.margins.right
  const cols = [0.46, 0.18, 0.18, 0.18]

  const header = () => {
    let x = left
    const y = doc.y // capture once: each text() call advances doc.y
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(7.5)
    ;['METRIC', 'THIS PERIOD', 'PREVIOUS', 'CHANGE'].forEach((h, i) => {
      doc.text(h, x, y, { width: width * cols[i] - 6, align: i === 0 ? 'left' : 'right', lineBreak: false })
      x += width * cols[i]
    })
    doc.y = y + 14
  }
  header()

  metrics.forEach((m, idx) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 40) { doc.addPage(); header() }
    const y = doc.y
    if (idx % 2 === 0) doc.rect(left, y - 2, width, 16).fill('#FAFAFB')
    let x = left
    const cells = [m.label, formatMetricValue(m), formatMetricValue(m, m.previous), formatDelta(m)]
    cells.forEach((cell, i) => {
      doc.fillColor(i === 3 ? TONE_COLOR[deltaTone(m)] : i === 0 ? DARK : '#374151')
        .font(i === 1 || i === 3 ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
        .text(cell, x, y + 1, { width: width * cols[i] - 6, align: i === 0 ? 'left' : 'right', lineBreak: false })
      x += width * cols[i]
    })
    doc.y = y + 16
  })
  doc.moveDown(0.3)
}

function simpleTable(doc: PDFKit.PDFDocument, title: string, headers: string[], rows: string[][], widths?: number[]) {
  sectionTitle(doc, title)
  const left = doc.page.margins.left
  const width = doc.page.width - left - doc.page.margins.right
  const cols = widths ?? headers.map(() => 1 / headers.length)

  const header = () => {
    let x = left
    const y = doc.y // capture once: each text() call advances doc.y
    doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(7.5)
    headers.forEach((h, i) => {
      doc.text(h.toUpperCase(), x, y, { width: width * cols[i] - 6, align: i === 0 ? 'left' : 'right', lineBreak: false })
      x += width * cols[i]
    })
    doc.y = y + 14
  }
  header()

  rows.forEach((row, idx) => {
    if (doc.y > doc.page.height - doc.page.margins.bottom - 40) { doc.addPage(); header() }
    const y = doc.y
    if (idx % 2 === 0) doc.rect(left, y - 2, width, 16).fill('#FAFAFB')
    let x = left
    row.forEach((cell, i) => {
      doc.fillColor(DARK).font('Helvetica').fontSize(9)
        .text(cell, x, y + 1, { width: width * cols[i] - 6, align: i === 0 ? 'left' : 'right', lineBreak: false, ellipsis: true })
      x += width * cols[i]
    })
    doc.y = y + 16
  })
  doc.moveDown(0.3)
}

function barChart(doc: PDFKit.PDFDocument, points: { label: string; value: number }[], left: number, width: number, height: number) {
  const top = doc.y + 4
  const max = Math.max(...points.map(p => p.value), 1)
  const slot = width / points.length
  const barW = Math.min(slot * 0.65, 28)

  // baseline
  doc.moveTo(left, top + height).lineTo(left + width, top + height).strokeColor(RULE).lineWidth(1).stroke()

  // thin out x-labels on long periods so they never overlap
  const labelEvery = Math.max(1, Math.ceil(points.length / 15))

  points.forEach((p, i) => {
    const h = (p.value / max) * (height - 14)
    const x = left + i * slot + (slot - barW) / 2
    if (h > 0) doc.rect(x, top + height - h, barW, h).fill(BLUE)
    if (i % labelEvery === 0) {
      doc.fillColor(GRAY).font('Helvetica').fontSize(6.5)
        .text(p.label, left + i * slot - 4, top + height + 4, { width: slot + 8, align: 'center', lineBreak: false })
    }
  })
  doc.fillColor(GRAY).font('Helvetica').fontSize(7)
    .text(`Peak: ${usd(max)}`, left, top - 2, { width, align: 'right', lineBreak: false })
  doc.y = top + height + 18
}
