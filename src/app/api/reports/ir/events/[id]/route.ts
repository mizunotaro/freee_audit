import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, getCompanyId } from '@/lib/api/auth-helpers'
import { rateLimit } from '@/lib/security/rate-limit-middleware'
import type { IREvent } from '@/types/reports/ir-report'

const API_TIMEOUT_MS = 30000

const EventTypeSchema = z.enum(['earnings', 'presentation', 'meeting', 'dividend', 'other'])

const UpdateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  type: EventTypeSchema.optional(),
  description: z.string().max(2000).optional(),
})

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  return response
}

const limiter = rateLimit({ windowMs: 60000, maxRequests: 100 })

const eventsStore: Map<string, IREvent[]> = new Map()

function getEvents(companyId: string): IREvent[] {
  return eventsStore.get(companyId) || []
}

function saveEvents(companyId: string, events: IREvent[]): void {
  eventsStore.set(companyId, events)
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
    const events = getEvents(companyId)
    const index = events.findIndex((e) => e.id === id)

    if (index === -1) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
      )
    }

    const body = await request.json()
    const parseResult = UpdateEventSchema.safeParse(body)

    if (!parseResult.success) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid request body', details: parseResult.error.errors },
          { status: 400 }
        )
      )
    }

    events[index] = {
      ...events[index],
      ...parseResult.data,
    }

    saveEvents(companyId, events)

    return addSecurityHeaders(NextResponse.json({ success: true, data: events[index] }))
  } catch (error) {
    console.error('IR Event PUT error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to update IR event' }, { status: 500 })
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
    const events = getEvents(companyId)
    const index = events.findIndex((e) => e.id === id)

    if (index === -1) {
      return addSecurityHeaders(
        NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
      )
    }

    events.splice(index, 1)
    saveEvents(companyId, events)

    return addSecurityHeaders(NextResponse.json({ success: true }))
  } catch (error) {
    console.error('IR Event DELETE error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to delete IR event' }, { status: 500 })
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
