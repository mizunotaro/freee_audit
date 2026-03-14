import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, getCompanyId } from '@/lib/api/auth-helpers'
import { irReportService } from '@/services/reports/ir/ir-report-service'
import { rateLimit } from '@/lib/security/rate-limit-middleware'
import type { IRReport } from '@/types/reports/ir-report'

const API_TIMEOUT_MS = 30000

const UpdateReportSchema = z.object({
  title: z
    .object({
      ja: z.string().min(1).max(200),
      en: z.string().min(1).max(200),
    })
    .optional(),
  status: z.enum(['draft', 'in_review', 'approved', 'published', 'archived']).optional(),
  language: z.enum(['ja', 'en', 'bilingual']).optional(),
  sections: z.array(z.any()).optional(),
  financialHighlights: z.array(z.any()).optional(),
  shareholderComposition: z.array(z.any()).optional(),
  events: z.array(z.any()).optional(),
  faqs: z.array(z.any()).optional(),
})

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  return response
}

const limiter = rateLimit({ windowMs: 60000, maxRequests: 100 })

async function verifyReportAccess(reportId: string, companyId: string): Promise<IRReport | null> {
  const report = await irReportService.getReport(reportId)
  if (!report) return null
  if (report.companyId !== companyId) return null
  return report
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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

    return addSecurityHeaders(NextResponse.json({ success: true, data: report }))
  } catch (error) {
    console.error('IR Report GET error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to fetch IR report' }, { status: 500 })
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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
    const existingReport = await verifyReportAccess(id, companyId)

    if (!existingReport) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
      )
    }

    const body = await request.json()
    const parseResult = UpdateReportSchema.safeParse(body)

    if (!parseResult.success) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid request body', details: parseResult.error.errors },
          { status: 400 }
        )
      )
    }

    const updatedReport: IRReport = {
      ...existingReport,
      ...parseResult.data,
      id: existingReport.id,
      companyId: existingReport.companyId,
      metadata: {
        ...existingReport.metadata,
        updatedAt: new Date().toISOString(),
        lastModifiedBy: user.id,
        version: existingReport.metadata.version + 1,
      },
    }

    await irReportService.saveReport(updatedReport)

    return addSecurityHeaders(NextResponse.json({ success: true, data: updatedReport }))
  } catch (error) {
    console.error('IR Report PUT error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to update IR report' }, { status: 500 })
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
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

    await irReportService.deleteReport(id)

    return addSecurityHeaders(NextResponse.json({ success: true }))
  } catch (error) {
    console.error('IR Report DELETE error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to delete IR report' }, { status: 500 })
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
