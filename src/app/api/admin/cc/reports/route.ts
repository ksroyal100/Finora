import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withAdmin, apiSuccess, apiError, createAuditLog } from '@/lib/security/rbac'
import { buildAdminReport } from '@/lib/reports/adminReportData'
import { buildAdminPdfReport } from '@/lib/reports/adminPdfReport'
import { buildAdminExcelReport } from '@/lib/reports/adminExcelReport'

// pdfkit and xlsx-populate need Node APIs (Buffer, streams) — not the Edge runtime.
export const runtime = 'nodejs'
// A month-long report on a large platform runs many queries; give it headroom.
export const maxDuration = 60

// ============================================================
// GET /api/admin/cc/reports
//   ?period=daily|weekly|monthly      (default: daily)
//   &date=YYYY-MM-DD                  (any day inside the period; default: today, UTC)
//   &format=json|pdf|xlsx             (default: json)
//
// json  → { success, data: AdminReport } for the on-screen preview
// pdf   → application/pdf attachment
// xlsx  → spreadsheet attachment
//
// Auth: withAdmin (valid session/Bearer + admin role + active admin_users row).
// File exports are written to audit_logs because they contain company-wide
// financial data leaving the system.
// ============================================================

const QuerySchema = z.object({
  period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD').optional(),
  format: z.enum(['json', 'pdf', 'xlsx']).default('json'),
})

const MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const

export const GET = withAdmin(async (req, { userId }) => {
  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({
    period: url.searchParams.get('period') ?? undefined,
    date: url.searchParams.get('date') ?? undefined,
    format: url.searchParams.get('format') ?? undefined,
  })
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? 'Invalid query', 400, 'BAD_REQUEST')

  const { period, format } = parsed.data

  // Default anchor = today (UTC). Reject dates that don't exist (e.g. 2026-02-31)
  // and dates in the future — there is nothing to report on yet.
  let anchor = new Date()
  if (parsed.data.date) {
    anchor = new Date(`${parsed.data.date}T00:00:00.000Z`)
    if (Number.isNaN(anchor.getTime()) || anchor.toISOString().slice(0, 10) !== parsed.data.date) {
      return apiError('Invalid calendar date', 400, 'BAD_REQUEST')
    }
    if (anchor.getTime() > Date.now()) {
      return apiError('Report date cannot be in the future', 400, 'BAD_REQUEST')
    }
  }

  try {
    const report = await buildAdminReport(period, anchor)

    if (format === 'json') return apiSuccess(report)

    const buffer = format === 'pdf'
      ? await buildAdminPdfReport(report)
      : await buildAdminExcelReport(report)

    const filename = `finora-${period}-report-${report.range.start}${period === 'daily' ? '' : `_to_${report.range.end}`}.${format}`

    void createAuditLog({
      adminId: userId,
      action: 'admin_report_exported',
      resourceType: 'report',
      metadata: { period, format, range_start: report.range.start, range_end: report.range.end },
    })

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': MIME[format],
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[admin reports] failed:', err)
    return apiError(err instanceof Error ? err.message : 'Failed to build report', 500, 'REPORT_FAILED')
  }
})
