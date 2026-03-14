import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, getCompanyId } from '@/lib/api/auth-helpers'
import { irReportService } from '@/services/reports/ir/ir-report-service'
import { rateLimit } from '@/lib/security/rate-limit-middleware'
import type { IRReportListFilter } from '@/types/reports/ir-report'

const API_TIMEOUT_MS = 30000

const ListFilterSchema = z.object({
  status: z.enum(['draft', 'in_review', 'approved', 'published', 'archived']).optional(),
  fiscalYear: z.string().optional(),
  language: z.enum(['ja', 'en', 'bilingual']).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const CreateReportSchema = z.object({
  title: z.object({
    ja: z.string().min(1).max(200),
    en: z.string().min(1).max(200),
  }),
  fiscalYear: z.string().regex(/^\d{4}$/),
  language: z.enum(['ja', 'en', 'bilingual']).default('ja'),
})

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  return response
}

const limiter = rateLimit({ windowMs: 60000, maxRequests: 100 })

export async function GET(request: NextRequest): Promise<NextResponse> {
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

    const { searchParams } = new URL(request.url)
    const filterResult = ListFilterSchema.safeParse({
      status: searchParams.get('status') || undefined,
      fiscalYear: searchParams.get('fiscalYear') || undefined,
      language: searchParams.get('language') || undefined,
      search: searchParams.get('search') || undefined,
      page: searchParams.get('page') || undefined,
      pageSize: searchParams.get('pageSize') || undefined,
    })

    if (!filterResult.success) {
      return addSecurityHeaders(
        NextResponse.json(
          {
            success: false,
            error: 'Invalid filter parameters',
            details: filterResult.error.errors,
          },
          { status: 400 }
        )
      )
    }

    const filter: IRReportListFilter = {
      status: filterResult.data.status,
      fiscalYear: filterResult.data.fiscalYear,
      language: filterResult.data.language,
      search: filterResult.data.search,
    }

    const result = await irReportService.listReports(filter)

    const filteredReports = result.reports.filter((r) => r.companyId === companyId)

    return addSecurityHeaders(
      NextResponse.json({
        success: true,
        data: {
          reports: filteredReports,
          total: filteredReports.length,
          page: filterResult.data.page,
          pageSize: filterResult.data.pageSize,
        },
      })
    )
  } catch (error) {
    console.error('IR Reports GET error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to fetch IR reports' }, { status: 500 })
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

    const body = await request.json()
    const parseResult = CreateReportSchema.safeParse(body)

    if (!parseResult.success) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid request body', details: parseResult.error.errors },
          { status: 400 }
        )
      )
    }

    const report = await irReportService.createReport({
      companyId,
      title: parseResult.data.title,
      fiscalYear: parseResult.data.fiscalYear,
      language: parseResult.data.language,
      createdBy: user.id,
    })

    return addSecurityHeaders(NextResponse.json({ success: true, data: report }, { status: 201 }))
  } catch (error) {
    console.error('IR Reports POST error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to create IR report' }, { status: 500 })
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
