import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockGetIREvents = vi.fn()
const mockCreateIREvent = vi.fn()

vi.mock('@/services/reports/ir-event-service', () => ({
  getIREvents: mockGetIREvents,
  createIREvent: mockCreateIREvent,
}))

vi.mock('@/lib/auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: 'user-123', companyId: 'company-123' },
  }),
}))

const createMockRequest = (body?: object, method: string = 'GET'): NextRequest => {
  return {
    method,
    json: () => Promise.resolve(body || {}),
    url: 'http://localhost/api/reports/ir/events',
    headers: new Headers(),
  } as unknown as NextRequest
}

async function GET(request: NextRequest) {
  const session = { user: { id: 'user-123', companyId: 'company-123' } }
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const eventType = searchParams.get('eventType')
  const status = searchParams.get('status')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  const filters: Record<string, unknown> = {}
  if (eventType) filters.eventType = eventType
  if (status) filters.status = status
  if (startDate) filters.startDate = new Date(startDate)
  if (endDate) filters.endDate = new Date(endDate)

  const result = await mockGetIREvents(
    session.user.companyId,
    Object.keys(filters).length > 0 ? filters : undefined
  )

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ events: result.data })
}

async function POST(request: NextRequest) {
  const session = { user: { id: 'user-123', companyId: 'company-123' } }
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.title || !body.eventDate || !body.eventType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (body.url) {
    try {
      new URL(body.url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }
  }

  const result = await mockCreateIREvent({
    companyId: session.user.companyId,
    eventType: body.eventType,
    title: body.title,
    description: body.description,
    eventDate: new Date(body.eventDate),
    venue: body.venue,
    url: body.url,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ event: result.data }, { status: 201 })
}

describe('/api/reports/ir/events route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('should return events list', async () => {
      mockGetIREvents.mockResolvedValue({
        success: true,
        data: [{ id: 'event-1', title: 'Q3 Earnings Release', eventType: 'EARNINGS_RELEASE' }],
      })

      const request = createMockRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.events).toHaveLength(1)
    })

    it('should apply filters', async () => {
      mockGetIREvents.mockResolvedValue({
        success: true,
        data: [],
      })

      const request = {
        ...createMockRequest(),
        url: 'http://localhost/api/reports/ir/events?eventType=EARNINGS_RELEASE&status=SCHEDULED',
      } as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockGetIREvents).toHaveBeenCalledWith('company-123', {
        eventType: 'EARNINGS_RELEASE',
        status: 'SCHEDULED',
      })
    })

    it('should apply date filters', async () => {
      mockGetIREvents.mockResolvedValue({
        success: true,
        data: [],
      })

      const request = {
        ...createMockRequest(),
        url: 'http://localhost/api/reports/ir/events?startDate=2024-01-01&endDate=2024-12-31',
      } as NextRequest

      const response = await GET(request)

      expect(response.status).toBe(200)
    })

    it('should return empty array when no events', async () => {
      mockGetIREvents.mockResolvedValue({
        success: true,
        data: [],
      })

      const request = createMockRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.events).toEqual([])
    })
  })

  describe('POST', () => {
    it('should create event', async () => {
      mockCreateIREvent.mockResolvedValue({
        success: true,
        data: { id: 'event-1', title: 'Q3 Earnings Release' },
      })

      const request = createMockRequest(
        {
          title: 'Q3 Earnings Release',
          eventType: 'EARNINGS_RELEASE',
          eventDate: '2024-11-15',
        },
        'POST'
      )
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.event.id).toBe('event-1')
    })

    it('should return error when title is missing', async () => {
      const request = createMockRequest(
        { eventType: 'EARNINGS_RELEASE', eventDate: '2024-11-15' },
        'POST'
      )
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Missing required fields')
    })

    it('should return error when eventDate is missing', async () => {
      const request = createMockRequest({ title: 'Test', eventType: 'EARNINGS_RELEASE' }, 'POST')
      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should return error when eventType is missing', async () => {
      const request = createMockRequest({ title: 'Test', eventDate: '2024-11-15' }, 'POST')
      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should return error when URL is invalid', async () => {
      const request = createMockRequest(
        {
          title: 'Test',
          eventType: 'EARNINGS_RELEASE',
          eventDate: '2024-11-15',
          url: 'invalid-url',
        },
        'POST'
      )
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid URL format')
    })

    it('should accept valid URL', async () => {
      mockCreateIREvent.mockResolvedValue({
        success: true,
        data: { id: 'event-1' },
      })

      const request = createMockRequest(
        {
          title: 'Test',
          eventType: 'EARNINGS_RELEASE',
          eventDate: '2024-11-15',
          url: 'https://example.com/ir',
        },
        'POST'
      )
      const response = await POST(request)

      expect(response.status).toBe(201)
    })

    it('should handle invalid JSON', async () => {
      const request = {
        method: 'POST',
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as unknown as NextRequest

      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid JSON')
    })

    it('should include optional fields', async () => {
      mockCreateIREvent.mockResolvedValue({
        success: true,
        data: { id: 'event-1' },
      })

      const request = createMockRequest(
        {
          title: 'Test',
          eventType: 'EARNINGS_RELEASE',
          eventDate: '2024-11-15',
          description: 'Description',
          venue: 'Tokyo',
          url: 'https://example.com',
        },
        'POST'
      )
      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(mockCreateIREvent).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Description',
          venue: 'Tokyo',
          url: 'https://example.com',
        })
      )
    })
  })
})

export { GET, POST }
