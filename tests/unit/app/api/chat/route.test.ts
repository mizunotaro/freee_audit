import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

describe('Chat API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /api/chat - Input Validation', () => {
    it('should return error for empty message', async () => {
      const { POST } = await import('@/app/api/chat/route')

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: '' }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error.code).toBe('invalid_input')
    })

    it('should return error for missing message', async () => {
      const { POST } = await import('@/app/api/chat/route')

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({}),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should return error for non-string message', async () => {
      const { POST } = await import('@/app/api/chat/route')

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: 123 }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should return error for null message', async () => {
      const { POST } = await import('@/app/api/chat/route')

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: null }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should return error for message exceeding max length', async () => {
      const { POST } = await import('@/app/api/chat/route')

      const longMessage = 'a'.repeat(10001)

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: longMessage }),
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('message_too_long')
    })

    it('should handle invalid JSON body', async () => {
      const { POST } = await import('@/app/api/chat/route')

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: 'invalid json',
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('invalid_json')
    })

    it('should accept valid message structure', async () => {
      const { POST } = await import('@/app/api/chat/route')

      const request = new NextRequest('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ message: '有効なメッセージ' }),
      })

      const response = await POST(request)
      expect([200, 500]).toContain(response.status)
    })
  })
})
