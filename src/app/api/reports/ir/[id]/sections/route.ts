import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, getCompanyId } from '@/lib/api/auth-helpers'
import { irReportService } from '@/services/reports/ir/ir-report-service'
import { rateLimit } from '@/lib/security/rate-limit-middleware'
import type { IRReport, IRReportSection, ReportSectionType } from '@/types/reports/ir-report'

const API_TIMEOUT_MS = 30000

const SectionTypeSchema = z.enum([
  'company_overview',
  'message_from_ceo',
  'business_overview',
  'financial_highlights',
  'financial_statements',
  'risk_factors',
  'corporate_governance',
  'shareholder_information',
  'sustainability',
  'outlook',
  'faq',
])

const SectionSchema = z.object({
  id: z.string().optional(),
  type: SectionTypeSchema,
  title: z.object({
    ja: z.string().min(1).max(200),
    en: z.string().min(1).max(200),
  }),
  content: z.object({
    ja: z.string(),
    en: z.string(),
  }),
  order: z.number().int().min(0),
  metadata: z.record(z.unknown()).optional(),
})

const UpdateSectionsSchema = z.object({
  sections: z.array(SectionSchema),
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

    return addSecurityHeaders(NextResponse.json({ success: true, data: report.sections || [] }))
  } catch (error) {
    console.error('IR Sections GET error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to fetch sections' }, { status: 500 })
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
    const report = await verifyReportAccess(id, companyId)

    if (!report) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 })
      )
    }

    const body = await request.json()
    const parseResult = UpdateSectionsSchema.safeParse(body)

    if (!parseResult.success) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid request body', details: parseResult.error.errors },
          { status: 400 }
        )
      )
    }

    const sections: IRReportSection[] = parseResult.data.sections.map((s, index) => ({
      id: s.id || `${Date.now()}_${index}_${Math.random().toString(36).substring(2, 9)}`,
      type: s.type as ReportSectionType,
      title: s.title,
      content: s.content,
      order: s.order ?? index,
      metadata: s.metadata,
    }))

    sections.sort((a, b) => a.order - b.order)

    const updatedReport: IRReport = {
      ...report,
      sections,
      metadata: {
        ...report.metadata,
        updatedAt: new Date().toISOString(),
        lastModifiedBy: user.id,
        version: report.metadata.version + 1,
      },
    }

    await irReportService.saveReport(updatedReport)

    return addSecurityHeaders(NextResponse.json({ success: true, data: sections }))
  } catch (error) {
    console.error('IR Sections PUT error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to update sections' }, { status: 500 })
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
