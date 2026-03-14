import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCompanyId } from '@/lib/api/auth-helpers'
import { irReportService } from '@/services/reports/ir/ir-report-service'
import { rateLimit } from '@/lib/security/rate-limit-middleware'
import type { IRReport } from '@/types/reports/ir-report'

const API_TIMEOUT_MS = 30000

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  return response
}

const limiter = rateLimit({ windowMs: 60000, maxRequests: 50 })

async function verifyReportAccess(reportId: string, companyId: string): Promise<IRReport | null> {
  const report = await irReportService.getReport(reportId)
  if (!report) return null
  if (report.companyId !== companyId) return null
  return report
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const limited = await limiter(request)
  if (limited) return limited

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    const user = await requireAuth(request)
    if (user instanceof NextResponse) return user

    const companyId = getCompanyId(user)
    if (!companyId) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Company ID is required' }, { status: 400 })
      )
    }

    const { id } = await params
    const report = await verifyReportAccess(id, companyId)

    if (!report) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
      )
    }

    if (report.status === 'published') {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Report is already published' }, { status: 400 })
      )
    }

    if (!report.sections || report.sections.length === 0) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Report must have at least one section before publishing' },
          { status: 400 }
        )
      )
    }

    await irReportService.updateReportStatus(id, 'published')

    const updatedReport = await irReportService.getReport(id)

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        data: updatedReport,
        message: 'Report published successfully',
      })
    )
  } catch (error) {
    console.error('IR Report publish error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to publish IR report' }, { status: 500 })
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
