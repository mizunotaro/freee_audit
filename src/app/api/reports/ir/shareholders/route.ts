import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, getCompanyId } from '@/lib/api/auth-helpers'
import { rateLimit } from '@/lib/security/rate-limit-middleware'
import type { ShareholderData } from '@/types/reports/ir-report'

const API_TIMEOUT_MS = 30000

const ShareholderSchema = z.object({
  category: z.string().min(1).max(100),
  percentage: z.number().min(0).max(100),
  count: z.number().int().min(0).optional(),
})

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  return response
}

const limiter = rateLimit({ windowMs: 60000, maxRequests: 100 })

const shareholdersStore: Map<string, ShareholderData[]> = new Map()

function getShareholders(companyId: string): ShareholderData[] {
  return shareholdersStore.get(companyId) || []
}

function saveShareholders(companyId: string, shareholders: ShareholderData[]): void {
  shareholdersStore.set(companyId, shareholders)
}

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

    const shareholders = getShareholders(companyId)

    return addSecurityHeaders(NextResponse.json({ success: true, data: shareholders }))
  } catch (error) {
    console.error('Shareholders GET error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to fetch shareholders' }, { status: 500 })
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
    const parseResult = ShareholderSchema.safeParse(body)

    if (!parseResult.success) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid request body', details: parseResult.error.errors },
          { status: 400 }
        )
      )
    }

    const shareholders = getShareholders(companyId)
    const newShareholder: ShareholderData & { id: string } = {
      ...parseResult.data,
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    }

    shareholders.push(newShareholder)
    saveShareholders(companyId, shareholders)

    return addSecurityHeaders(
      NextResponse.json({ success: true, data: newShareholder }, { status: 201 })
    )
  } catch (error) {
    console.error('Shareholders POST error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to create shareholder' }, { status: 500 })
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
