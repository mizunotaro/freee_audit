import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { sanitizeHtml } from '@/lib/utils/html-sanitize'

const mockValidateSession = vi.fn()

vi.mock('@/lib/auth', () => ({
  validateSession: (...args: unknown[]) => mockValidateSession(...args),
}))

describe('Business Report Export API - XSS Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateSession.mockResolvedValue({ id: 'user-1', email: 'test@example.com' })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createRequest = (data: Record<string, unknown>) => {
    return new NextRequest('http://localhost/api/reports/business/export', {
      method: 'POST',
      headers: {
        Cookie: 'session=valid-session-token',
      },
      body: JSON.stringify(data),
    })
  }

  const validReportData = {
    fiscalYear: 2024,
    companyName: 'Test Company',
    businessOverview: 'Business overview content',
    businessEnvironment: 'Business environment content',
    managementPolicy: 'Management policy content',
    issuesAndRisks: 'Issues and risks content',
    financialHighlights: 'Financial highlights content',
    researchAndDevelopment: 'R&D content',
    corporateGovernance: 'Corporate governance content',
  }

  describe('POST /api/reports/business/export - XSS Prevention', () => {
    it('should sanitize script tags in companyName', async () => {
      const { POST } = await import('@/app/api/reports/business/export/route')

      const request = createRequest({
        ...validReportData,
        companyName: '<script>alert("XSS")</script>Test Company',
      })

      const response = await POST(request)
      const html = await response.text()

      expect(response.status).toBe(200)
      expect(html).not.toContain('<script>alert')
      expect(html).not.toContain('</script>')
    })

    it('should sanitize script tags in businessOverview', async () => {
      const { POST } = await import('@/app/api/reports/business/export/route')

      const request = createRequest({
        ...validReportData,
        businessOverview: '<script>document.cookie</script>Overview',
      })

      const response = await POST(request)
      const html = await response.text()

      expect(response.status).toBe(200)
      expect(html).not.toContain('<script>')
    })

    it('should sanitize event handlers in all fields', async () => {
      const { POST } = await import('@/app/api/reports/business/export/route')

      const request = createRequest({
        ...validReportData,
        businessEnvironment: '<img src=x onerror=alert("XSS")>',
      })

      const response = await POST(request)
      const html = await response.text()

      expect(response.status).toBe(200)
      expect(html).not.toContain('onerror=')
    })

    it('should sanitize javascript: protocol', async () => {
      const { POST } = await import('@/app/api/reports/business/export/route')

      const request = createRequest({
        ...validReportData,
        managementPolicy: '<a href="javascript:alert(\'XSS\')">Click me</a>',
      })

      const response = await POST(request)
      const html = await response.text()

      expect(response.status).toBe(200)
      expect(html).not.toContain('javascript:')
    })

    it('should sanitize issuesAndRisks field', async () => {
      const { POST } = await import('@/app/api/reports/business/export/route')

      const request = createRequest({
        ...validReportData,
        issuesAndRisks: '<script>steal(document.cookie)</script>',
      })

      const response = await POST(request)
      const html = await response.text()

      expect(response.status).toBe(200)
      expect(html).not.toContain('<script>')
    })

    it('should sanitize financialHighlights field', async () => {
      const { POST } = await import('@/app/api/reports/business/export/route')

      const request = createRequest({
        ...validReportData,
        financialHighlights: '<iframe src="evil.com"></iframe>',
      })

      const response = await POST(request)
      const html = await response.text()

      expect(response.status).toBe(200)
      expect(html).not.toContain('<iframe')
    })

    it('should sanitize researchAndDevelopment field', async () => {
      const { POST } = await import('@/app/api/reports/business/export/route')

      const request = createRequest({
        ...validReportData,
        researchAndDevelopment: '<object data="malicious.swf">',
      })

      const response = await POST(request)
      const html = await response.text()

      expect(response.status).toBe(200)
      expect(html).not.toContain('<object')
    })

    it('should sanitize corporateGovernance field', async () => {
      const { POST } = await import('@/app/api/reports/business/export/route')

      const request = createRequest({
        ...validReportData,
        corporateGovernance: '<embed src="malicious.pdf">',
      })

      const response = await POST(request)
      const html = await response.text()

      expect(response.status).toBe(200)
      expect(html).not.toContain('<embed')
    })

    it('should preserve safe HTML tags', async () => {
      const { POST } = await import('@/app/api/reports/business/export/route')

      const request = createRequest({
        ...validReportData,
        businessOverview: '<p>Safe <strong>paragraph</strong> with <em>formatting</em></p>',
      })

      const response = await POST(request)
      const html = await response.text()

      expect(response.status).toBe(200)
      expect(html).toContain('<p>')
      expect(html).toContain('<strong>')
      expect(html).toContain('<em>')
    })

    it('should sanitize filename in Content-Disposition header', async () => {
      const { POST } = await import('@/app/api/reports/business/export/route')

      const request = createRequest({
        ...validReportData,
        fiscalYear: '"><script>alert(1)</script>',
      })

      const response = await POST(request)
      const contentDisposition = response.headers.get('Content-Disposition')

      expect(response.status).toBe(200)
      expect(contentDisposition).not.toContain('<script>')
      expect(contentDisposition).toContain('&lt;')
    })

    it('should return valid HTML with UTF-8 encoding', async () => {
      const { POST } = await import('@/app/api/reports/business/export/route')

      const request = createRequest({
        ...validReportData,
        companyName: '株式会社テスト',
      })

      const response = await POST(request)
      const html = await response.text()

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
      expect(html).toContain('株式会社テスト')
    })
  })
})

describe('sanitizeHtml', () => {
  it('should remove script tags', () => {
    const result = sanitizeHtml('<script>alert("XSS")</script><p>Safe</p>')
    expect(result).not.toContain('<script>')
    expect(result).toContain('<p>Safe</p>')
  })

  it('should remove iframe tags', () => {
    const result = sanitizeHtml('<iframe src="evil.com"></iframe><p>Safe</p>')
    expect(result).not.toContain('<iframe')
    expect(result).toContain('<p>Safe</p>')
  })

  it('should remove event handlers', () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(1)">')
    expect(result).not.toContain('onerror')
  })

  it('should preserve safe tags', () => {
    const result = sanitizeHtml('<p><strong>Bold</strong> and <em>italic</em></p>')
    expect(result).toContain('<p>')
    expect(result).toContain('<strong>')
    expect(result).toContain('<em>')
  })

  it('should handle empty string', () => {
    const result = sanitizeHtml('')
    expect(result).toBe('')
  })

  it('should handle non-string input', () => {
    expect(sanitizeHtml(null as unknown as string)).toBe('')
    expect(sanitizeHtml(undefined as unknown as string)).toBe('')
    expect(sanitizeHtml(123 as unknown as string)).toBe('')
  })
})
