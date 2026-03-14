import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, getCompanyId } from '@/lib/api/auth-helpers'
import { rateLimit } from '@/lib/security/rate-limit-middleware'
import type { IREvent } from '@/types/reports/ir-report'

const API_TIMEOUT_MS = 30000

const EventTypeSchema = z.enum(['earnings', 'presentation', 'meeting', 'dividend', 'other'])

const EventSchema = z.object({
  title: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: EventTypeSchema,
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

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
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

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let events = getEvents(companyId)

    if (type) {
      events = events.filter((e) => e.type === type)
    }

    if (startDate) {
      events = events.filter((e) => e.date >= startDate!)
    }

    if (endDate) {
      events = events.filter((e) => e.date <= endDate!)
    }

    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    return addSecurityHeaders(NextResponse.json({ success: true, data: events }))
  } catch (error) {
    console.error('IR Events GET error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to fetch IR events' }, { status: 500 })
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
    const parseResult = EventSchema.safeParse(body)

    if (!parseResult.success) {
      return addSecurityHeaders(
        NextResponse.json(
          { success: false, error: 'Invalid request body', details: parseResult.error.errors },
          { status: 400 }
        )
      )
    }

    const events = getEvents(companyId)
    const newEvent: IREvent = {
      id: generateId(),
      title: parseResult.data.title,
      date: parseResult.data.date,
      type: parseResult.data.type,
      description: parseResult.data.description,
    }

    events.push(newEvent)
    saveEvents(companyId, events)

    return addSecurityHeaders(NextResponse.json({ success: true, data: newEvent }, { status: 201 }))
  } catch (error) {
    console.error('IR Events POST error:', error)
    return addSecurityHeaders(
      NextResponse.json({ success: false, error: 'Failed to create IR event' }, { status: 500 })
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
