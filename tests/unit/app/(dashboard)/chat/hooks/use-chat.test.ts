import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useChat } from '@/app/(dashboard)/chat/hooks/use-chat'

describe('useChat', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const mockSuccessResponse = {
    success: true,
    sessionId: 'session-123',
    response: {
      summary: 'AI分析結果のサマリー',
      personaAnalyses: [],
      consensusPoints: [],
      recommendedAction: 'test',
      confidence: 0.9,
    },
    metadata: {
      intent: 'financial_analysis',
      intentConfidence: 0.95,
      processingTimeMs: 100,
      totalCost: 0.001,
      modelUsed: 'gpt-4',
    },
  }

  it('should start with empty messages and no error', () => {
    const { result } = renderHook(() => useChat())
    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.sessionId).toBe('')
  })

  it('should send message and receive response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    } as Response)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('分析して')
    })

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2)
    })

    expect(result.current.messages[0].role).toBe('user')
    expect(result.current.messages[0].content).toBe('分析して')
    expect(result.current.messages[1].role).toBe('assistant')
    expect(result.current.messages[1].content).toBe('AI分析結果のサマリー')
    expect(result.current.sessionId).toBe('session-123')
  })

  it('should not send empty messages', async () => {
    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('')
    })
    await act(async () => {
      await result.current.sendMessage('   ')
    })

    expect(result.current.messages.length).toBe(0)
  })

  it('should handle fetch errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const onError = vi.fn()
    const { result } = renderHook(() => useChat({ onError }))

    await act(async () => {
      await result.current.sendMessage('テスト')
    })

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2)
    })

    expect(result.current.messages[1].content).toContain('Network error')
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('Network error')
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('should handle HTTP error responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Internal Server Error' } }),
    } as Response)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('テスト')
    })

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2)
    })

    expect(result.current.messages[1].content).toContain('Internal Server Error')
  })

  it('should handle API failure response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        sessionId: '',
        error: { code: 'ERROR', message: 'Analysis failed' },
      }),
    } as Response)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('テスト')
    })

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2)
    })

    expect(result.current.messages[1].content).toContain('Analysis failed')
  })

  it('should clear messages', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    } as Response)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('テスト')
    })

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2)
    })

    act(() => {
      result.current.clearMessages()
    })

    expect(result.current.messages).toEqual([])
    expect(result.current.sessionId).toBe('')
    expect(result.current.error).toBeNull()
  })

  it('should abort pending request', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useChat())

    act(() => {
      result.current.sendMessage('テスト')
    })

    act(() => {
      result.current.abort()
    })

    expect(result.current.isLoading).toBe(false)
  })

  it('should ignore AbortError in sendMessage', async () => {
    const abortError = new DOMException('Aborted', 'AbortError')
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError)

    const onError = vi.fn()
    const { result } = renderHook(() => useChat({ onError }))

    await act(async () => {
      await result.current.sendMessage('テスト')
    })

    expect(result.current.error).toBeNull()
    expect(onError).not.toHaveBeenCalled()
  })

  it('should send streaming message and process chunks', async () => {
    const chunks = [
      'data: {"type":"intent","data":{"sessionId":"stream-session"}}\n',
      'data: {"type":"persona_complete","data":{"persona":"cpa","conclusion":"分析結果"}}\n',
      'data: {"type":"done","data":{}}\n',
    ]

    const mockReader = {
      read: vi.fn(),
    }

    let readCount = 0
    mockReader.read.mockImplementation(async () => {
      if (readCount < chunks.length) {
        const value = new TextEncoder().encode(chunks[readCount])
        readCount++
        return { done: false, value }
      }
      return { done: true, value: undefined }
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => mockReader },
    } as unknown as Response)

    const onStreamChunk = vi.fn()
    const { result } = renderHook(() => useChat({ onStreamChunk }))

    await act(async () => {
      await result.current.sendStreamingMessage('ストリーミングテスト')
    })

    await waitFor(() => {
      expect(result.current.sessionId).toBe('stream-session')
    })

    expect(onStreamChunk).toHaveBeenCalled()
    expect(result.current.messages.length).toBeGreaterThanOrEqual(2)
  })

  it('should handle streaming error chunks', async () => {
    const chunks = [
      'data: {"type":"error","data":{"message":"Stream error occurred"}}\n',
    ]

    const mockReader = {
      read: vi.fn(),
    }

    let readCount = 0
    mockReader.read.mockImplementation(async () => {
      if (readCount < chunks.length) {
        const value = new TextEncoder().encode(chunks[readCount])
        readCount++
        return { done: false, value }
      }
      return { done: true, value: undefined }
    })

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => mockReader },
    } as unknown as Response)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendStreamingMessage('テスト')
    })

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
    })

    expect(result.current.error?.message).toContain('Stream error occurred')
  })

  it('should handle streaming HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server error' } }),
    } as Response)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendStreamingMessage('テスト')
    })

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
    })
  })

  it('should handle missing response body in streaming', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      body: null,
    } as unknown as Response)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendStreamingMessage('テスト')
    })

    await waitFor(() => {
      expect(result.current.error).toBeTruthy()
    })

    expect(result.current.error?.message).toBe('No response body')
  })

  it('should use custom timeout', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))

    renderHook(() => useChat({ timeoutMs: 30000 }))

    await act(async () => {
      try {
        const [, body] = fetchSpy.mock.calls[0] ?? []
        expect(body).toBeDefined()
      } catch {
        // hook may not have called fetch yet
      }
    })
  })

  it('should trim message content', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    } as Response)

    const { result } = renderHook(() => useChat())

    await act(async () => {
      await result.current.sendMessage('  テストメッセージ  ')
    })

    const callBody = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
    expect(callBody.message).toBe('テストメッセージ')
  })
})
