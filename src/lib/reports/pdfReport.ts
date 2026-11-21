// src/lib/reports/pdfReport.ts
//
// Renders a ReportData object to a PDF buffer, encrypted with the password
// the caller passed in. pdfkit's userPassword option performs real PDF
// encryption (RC4/AES depending on pdfVersion) — the file cannot be opened
// in any PDF viewer without that password.

// Use the standalone build: it embeds the standard 14 font metrics (Helvetica,
// etc.) directly in the module instead of reading .afm files from disk via
// fs.readFileSync(__dirname + ...). That file-read approach breaks once
// Next.js bundles this route (both Turbopack and webpack rewrite __dirname to
// a virtual chunk path with no corresponding file on disk — a well-known
// pdfkit + bundler issue). The standalone build has no such runtime file
// dependency, so it works identically in dev and in a production build.
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js'
import { ReportData } from './getReportData'

const GREEN = '#1FA34C'
const DARK = '#111318'
const GRAY = '#6B7280'
const RED = '#D92D20'

function fmt(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n ?? 0)
}

export async function buildPdfReport(data: ReportData, password: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 48,
      userPassword: password,
      ownerPassword: password,
      pdfVersion: '1.7',
      permissions: { printing: 'highResolution', modifying: false, copying: false, annotating: false },
      info: { Title: 'Finora Financial Report', Author: 'Finora' },
    })

    const chunks: Buffer[] = []
    doc.on('data', chunk => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const currency = data.profile.currency || 'USD'

    // ── Header ─────────────────────────────────────────────
    doc.fillColor(DARK).fontSize(20).font('Helvetica-Bold').text('Finora Financial Report')
    doc.fillColor(GRAY).fontSize(10).font('Helvetica')
      .text(`${data.profile.name} · ${data.profile.email}`)
      .text(`Generated ${new Date(data.generatedAt).toLocaleString()}`)
    doc.moveDown(1.2)
    drawRule(doc)

    // ── Net Worth ──────────────────────────────────────────
    sectionTitle(doc, 'Net Worth Summary')
    statRow(doc, [
      { label: 'Total Assets', value: fmt(data.netWorth.totalAssets, currency), color: GREEN },
      { label: 'Total Liabilities', value: fmt(data.netWorth.totalLiabilities, currency), color: RED },
      { label: 'Net Worth', value: fmt(data.netWorth.netWorth, currency), color: DARK },
    ])
    doc.moveDown(0.6)

    if (data.netWorth.assets.length > 0) {
      subTitle(doc, 'Assets')
      table(doc, ['Name', 'Type', 'Institution', 'Value'], data.netWorth.assets.map(a => [
        a.name, a.type?.replace(/_/g, ' ') ?? '', a.institution ?? '—', fmt(a.value, currency),
      ]))
    }
    if (data.netWorth.liabilities.length > 0) {
      subTitle(doc, 'Liabilities')
      table(doc, ['Name', 'Type', 'APR', 'Balance'], data.netWorth.liabilities.map(l => [
        l.name, l.type?.replace(/_/g, ' ') ?? '', l.interest_rate ? `${l.interest_rate}%` : '—', fmt(l.balance, currency),
      ]))
    }

    // ── Portfolio ──────────────────────────────────────────
    if (data.portfolio) {
      doc.moveDown(0.8)
      sectionTitle(doc, 'Portfolio')
      statRow(doc, [
        { label: 'Total Value', value: fmt(data.portfolio.totalValue, currency), color: DARK },
        { label: 'Gain / Loss', value: fmt(data.portfolio.totalGainLoss, currency), color: data.portfolio.totalGainLoss >= 0 ? GREEN : RED },
        { label: 'Return', value: `${data.portfolio.totalGainLossPct.toFixed(1)}%`, color: data.portfolio.totalGainLoss >= 0 ? GREEN : RED },
      ])
      if (data.portfolio.holdings.length > 0) {
        doc.moveDown(0.4)
        table(doc, ['Symbol', 'Qty', 'Value', 'Gain/Loss', 'Weight'], data.portfolio.holdings.map(h => [
          h.symbol, String(h.quantity), fmt(h.market_value, currency),
          `${h.unrealized_gain >= 0 ? '+' : ''}${fmt(h.unrealized_gain, currency)}`, `${h.weight_pct.toFixed(1)}%`,
        ]))
      }
    }

    // ── Budget ─────────────────────────────────────────────
    if (data.budget) {
      doc.moveDown(0.8)
      sectionTitle(doc, 'Current Budget')
      statRow(doc, [
        { label: 'Monthly Income', value: fmt(data.budget.totalIncome, currency), color: DARK },
        { label: 'Spent', value: fmt(data.budget.totalSpent, currency), color: RED },
        { label: 'Remaining', value: fmt(data.budget.remaining, currency), color: data.budget.remaining >= 0 ? GREEN : RED },
      ])
    }

    // ── Goals ──────────────────────────────────────────────
    if (data.goals.length > 0) {
      doc.moveDown(0.8)
      sectionTitle(doc, 'Active Goals')
      table(doc, ['Goal', 'Category', 'Progress', 'Target'], data.goals.map(g => [
        g.title, g.category?.replace(/_/g, ' ') ?? '', `${g.progress_pct}%`, fmt(g.target_amount, currency),
      ]))
    }

    doc.moveDown(1.2)
    drawRule(doc)
    doc.fontSize(8).fillColor(GRAY).text(
      'This report was generated from your Finora account data and is password-protected with your account password. Keep it somewhere safe.',
      { width: 500 }
    )

    doc.end()
  })
}

function drawRule(doc: PDFKit.PDFDocument) {
  const y = doc.y
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor('#E5E7EB').lineWidth(1).stroke()
  doc.moveDown(0.8)
}

function sectionTitle(doc: PDFKit.PDFDocument, text: string) {
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(14).text(text)
  doc.moveDown(0.4)
}

function subTitle(doc: PDFKit.PDFDocument, text: string) {
  doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(10).text(text.toUpperCase(), { characterSpacing: 0.5 })
  doc.moveDown(0.2)
}

function statRow(doc: PDFKit.PDFDocument, stats: { label: string; value: string; color: string }[]) {
  const startX = doc.page.margins.left
  const width = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / stats.length
  const y = doc.y
  stats.forEach((s, i) => {
    doc.fillColor(GRAY).font('Helvetica').fontSize(9).text(s.label, startX + i * width, y, { width: width - 10 })
    doc.fillColor(s.color).font('Helvetica-Bold').fontSize(15).text(s.value, startX + i * width, y + 13, { width: width - 10 })
  })
  doc.y = y + 40
}

function table(doc: PDFKit.PDFDocument, headers: string[], rows: string[][]) {
  const startX = doc.page.margins.left
  const fullWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right
  const colWidth = fullWidth / headers.length

  let y = doc.y
  doc.fillColor(GRAY).font('Helvetica-Bold').fontSize(8)
  headers.forEach((h, i) => doc.text(h.toUpperCase(), startX + i * colWidth, y, { width: colWidth - 6 }))
  y += 14
  doc.moveTo(startX, y).lineTo(startX + fullWidth, y).strokeColor('#E5E7EB').lineWidth(0.5).stroke()
  y += 6

  doc.font('Helvetica').fontSize(9).fillColor(DARK)
  rows.forEach(row => {
    if (y > doc.page.height - doc.page.margins.bottom - 30) {
      doc.addPage()
      y = doc.page.margins.top
    }
    row.forEach((cell, i) => doc.text(cell, startX + i * colWidth, y, { width: colWidth - 6 }))
    y += 16
  })
  doc.y = y + 8
}
