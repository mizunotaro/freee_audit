import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, getCompanyId } from '@/lib/api/auth-helpers'
import { rateLimit } from '@/lib/security/rate-limit-middleware'
import type { ShareholderData } from '@/types/reports/ir-report'

const API_TIMEOUT_MS = 30000

const UpdateShareholderSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  percentage: z.number().min(0).max(100).optional(),
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

interface RouteParams {
  params: Promise<{ id: string }>
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
    const shareholders = getShareholders(companyId)
    const index = shareholders.findIndex((s) => (s as any).id === id)

    if (index === -1) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Shareholder not found' }, { status: 404 })
      )
    }

    const body = await request.json()
    const parseResult = UpdateShareholderSchema.safeParse(body)

    if (!parseResult.success) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid request body', details: parseResult.error.errors },
          { status: 400 }
        )
      )
    }

    shareholders[index] = {
      ...shareholders[index],
      ...parseResult.data,
    } as ShareholderData & { id: string }

    saveShareholders(companyId, shareholders)

    return addSecurityHeaders(NextResponse.json({ success: true, data: shareholders[index] }))
  } catch (error) {
    console.error('Shareholder PUT error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to update shareholder' }, { status: 500 })
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
    const shareholders = getShareholders(companyId)
    const index = shareholders.findIndex((s) => (s as any).id === id)

    if (index === -1) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Shareholder not found' }, { status: 404 })
      )
    }

    shareholders.splice(index, 1)
    saveShareholders(companyId, shareholders)

    return addSecurityHeaders(NextResponse.json({ success: true }))
  } catch (error) {
    console.error('Shareholder DELETE error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to delete shareholder' }, { status: 500 })
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
