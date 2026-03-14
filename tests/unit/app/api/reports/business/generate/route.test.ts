import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { sanitizePlainText } from '@/lib/utils/html-sanitize'

const mockValidateSession = vi.fn()

vi.mock('@/lib/auth', () => ({
  validateSession: (...args: unknown[]) => mockValidateSession(...args),
}))

describe('Business Report Generate API - XSS Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateSession.mockResolvedValue({ id: 'user-1', email: 'test@example.com' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createRequest = (data: Record<string, unknown>) => {
    return new NextRequest('http://localhost/api/reports/business/generate', {
      method: 'POST',
      headers: {
        Cookie: 'session=valid-session-token',
      },
      body: JSON.stringify(data),
    })
  }

  describe('POST /api/reports/business/generate - XSS Prevention', () => {
    it('should sanitize script tags in companyName', async () => {
      const { POST } = await import('@/app/api/reports/business/generate/route')

      const maliciousName = '<script>alert("XSS")</script>Test Company'
      const request = createRequest({
        section: 'businessOverview',
        companyName: maliciousName,
        fiscalYear: 2024,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).not.toContain('<script>')
      expect(data.content).not.toContain('</script>')
      expect(data.content).toContain('&lt;script&gt;')
    })

    it('should sanitize event handlers in companyName', async () => {
      const { POST } = await import('@/app/api/reports/business/generate/route')

      const maliciousName = '<img src=x onerror=alert("XSS")>Test Company'
      const request = createRequest({
        section: 'businessOverview',
        companyName: maliciousName,
        fiscalYear: 2024,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).not.toContain('onerror=')
      expect(data.content).toContain('&lt;img')
    })

    it('should escape javascript: protocol in companyName', async () => {
      const { POST } = await import('@/app/api/reports/business/generate/route')

      const maliciousName = '<a href="javascript:alert(\'XSS\')">Click</a>'
      const request = createRequest({
        section: 'businessOverview',
        companyName: maliciousName,
        fiscalYear: 2024,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).not.toContain('<a href=')
      expect(data.content).toContain('&lt;a href&#x3D;')
    })

    it('should sanitize HTML entities in companyName', async () => {
      const { POST } = await import('@/app/api/reports/business/generate/route')

      const maliciousName = 'Test&Company<script>alert(1)</script>'
      const request = createRequest({
        section: 'businessOverview',
        companyName: maliciousName,
        fiscalYear: 2024,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).toContain('Test&amp;Company')
      expect(data.content).not.toContain('<script>')
    })

    it('should handle valid companyName without modification to safe characters', async () => {
      const { POST } = await import('@/app/api/reports/business/generate/route')

      const validName = '株式会社テスト企業'
      const request = createRequest({
        section: 'businessOverview',
        companyName: validName,
        fiscalYear: 2024,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.content).toContain(validName)
    })
  })
})

describe('sanitizePlainText', () => {
  it('should escape HTML special characters', () => {
    const result = sanitizePlainText('<script>alert("XSS")</script>')
    expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;')
  })

  it('should escape ampersand', () => {
    const result = sanitizePlainText('Test & Company')
    expect(result).toBe('Test &amp; Company')
  })

  it('should escape quotes', () => {
    const result = sanitizePlainText('Test "quoted" and \'single\'')
    expect(result).toBe('Test &quot;quoted&quot; and &#x27;single&#x27;')
  })

  it('should handle empty string', () => {
    const result = sanitizePlainText('')
    expect(result).toBe('')
  })

  it('should handle non-string input', () => {
    expect(sanitizePlainText(null as unknown as string)).toBe('')
    expect(sanitizePlainText(undefined as unknown as string)).toBe('')
    expect(sanitizePlainText(123 as unknown as string)).toBe('')
  })

  it('should remove control characters', () => {
    const result = sanitizePlainText('Test\x00\x01\x02Company')
    expect(result).toBe('TestCompany')
  })
})
