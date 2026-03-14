import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const mockGetShareholders = vi.fn()
const mockCreateShareholder = vi.fn()

vi.mock('@/services/reports/ir-shareholder-service', () => ({
  getShareholders: mockGetShareholders,
  createShareholder: mockCreateShareholder,
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
    url: 'http://localhost/api/reports/ir/shareholders',
    headers: new Headers(),
  } as unknown as NextRequest
}

async function GET(_request: NextRequest) {
  const session = { user: { id: 'user-123', companyId: 'company-123' } }
  if (!session?.user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await mockGetShareholders(session.user.companyId)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ shareholders: result.data })
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

  if (!body.shareholderName || !body.category || body.shareRatio === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (body.shareRatio < 0 || body.shareRatio > 100) {
    return NextResponse.json({ error: 'shareRatio must be between 0 and 100' }, { status: 400 })
  }

  const result = await mockCreateShareholder({
    companyId: session.user.companyId,
    asOfDate: body.asOfDate ? new Date(body.asOfDate) : new Date(),
    category: body.category,
    shareholderName: body.shareholderName,
    shareCount: body.shareCount || 0,
    shareRatio: body.shareRatio,
    votingRightsRatio: body.votingRightsRatio,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ shareholder: result.data }, { status: 201 })
}

describe('/api/reports/ir/shareholders route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('should return shareholders list', async () => {
      mockGetShareholders.mockResolvedValue({
        success: true,
        data: [{ id: 'sh-1', shareholderName: 'Test Bank', shareRatio: 25.5 }],
      })

      const request = createMockRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.shareholders).toHaveLength(1)
    })

    it('should return empty array when no shareholders', async () => {
      mockGetShareholders.mockResolvedValue({
        success: true,
        data: [],
      })

      const request = createMockRequest()
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.shareholders).toEqual([])
    })

    it('should return error when service fails', async () => {
      mockGetShareholders.mockResolvedValue({
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Database error' },
      })

      const request = createMockRequest()
      const response = await GET(request)

      expect(response.status).toBe(400)
    })
  })

  describe('POST', () => {
    it('should create shareholder', async () => {
      mockCreateShareholder.mockResolvedValue({
        success: true,
        data: { id: 'sh-1', shareholderName: 'Test Bank' },
      })

      const request = createMockRequest(
        {
          shareholderName: 'Test Bank',
          category: 'FINANCIAL_INSTITUTION',
          shareRatio: 25.5,
          shareCount: 1000000,
        },
        'POST'
      )
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.shareholder.id).toBe('sh-1')
    })

    it('should return error when shareholderName is missing', async () => {
      const request = createMockRequest(
        { category: 'FINANCIAL_INSTITUTION', shareRatio: 25 },
        'POST'
      )
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Missing required fields')
    })

    it('should return error when category is missing', async () => {
      const request = createMockRequest({ shareholderName: 'Test', shareRatio: 25 }, 'POST')
      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should return error when shareRatio is missing', async () => {
      const request = createMockRequest(
        { shareholderName: 'Test', category: 'FINANCIAL_INSTITUTION' },
        'POST'
      )
      const response = await POST(request)

      expect(response.status).toBe(400)
    })

    it('should return error when shareRatio is invalid', async () => {
      const request = createMockRequest(
        { shareholderName: 'Test', category: 'FINANCIAL_INSTITUTION', shareRatio: 150 },
        'POST'
      )
      const response = await POST(request)

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('shareRatio must be between 0 and 100')
    })

    it('should return error when shareRatio is negative', async () => {
      const request = createMockRequest(
        { shareholderName: 'Test', category: 'FINANCIAL_INSTITUTION', shareRatio: -10 },
        'POST'
      )
      const response = await POST(request)

      expect(response.status).toBe(400)
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

    it('should include votingRightsRatio', async () => {
      mockCreateShareholder.mockResolvedValue({
        success: true,
        data: { id: 'sh-1', votingRightsRatio: 25.0 },
      })

      const request = createMockRequest(
        {
          shareholderName: 'Test Bank',
          category: 'FINANCIAL_INSTITUTION',
          shareRatio: 25.5,
          votingRightsRatio: 25.0,
        },
        'POST'
      )
      const response = await POST(request)

      expect(response.status).toBe(201)
      expect(mockCreateShareholder).toHaveBeenCalledWith(
        expect.objectContaining({ votingRightsRatio: 25.0 })
      )
    })
  })
})

export { GET, POST }
