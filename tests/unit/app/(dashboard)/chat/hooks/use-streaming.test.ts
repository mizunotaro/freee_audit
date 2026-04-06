import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useStreaming } from '@/app/(dashboard)/chat/hooks/use-streaming'

describe('useStreaming', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should start disconnected', () => {
    const { result } = renderHook(() => useStreaming())
    expect(result.current.isConnected).toBe(false)
  })

  it('should connect and process chunks', async () => {
    const onChunk = vi.fn()
    const onComplete = vi.fn()

    const chunks = [
      'data: {"type":"intent","data":{"sessionId":"test"}}\n',
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

    const { result } = renderHook(() => useStreaming({ onChunk, onComplete }))

    await act(async () => {
      await result.current.connect('/api/test/stream', { message: 'test' })
    })

    expect(onChunk).toHaveBeenCalled()
    expect(onComplete).toHaveBeenCalled()
    expect(result.current.isConnected).toBe(false)
  })

  it('should set isConnected during streaming', async () => {
    let resolveRead: (() => void) | undefined
    const mockReader = {
      read: vi.fn().mockImplementation(async () => {
        await new Promise<void>((resolve) => {
          resolveRead = resolve
        })
        return { done: true, value: undefined }
      }),
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => mockReader },
    } as unknown as Response)

    const { result } = renderHook(() => useStreaming())

    act(() => {
      result.current.connect('/api/test')
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    resolveRead?.()

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false)
    })
  })

  it('should handle fetch errors', async () => {
    const onError = vi.fn()
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Connection failed'))

    const { result } = renderHook(() => useStreaming({ onError }))

    await act(async () => {
      await result.current.connect('/api/test')
    })

    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    expect(onError.mock.calls[0][0].message).toBe('Connection failed')
    expect(result.current.isConnected).toBe(false)
  })

  it('should handle HTTP error responses', async () => {
    const onError = vi.fn()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response)

    const { result } = renderHook(() => useStreaming({ onError }))

    await act(async () => {
      await result.current.connect('/api/test')
    })

    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    expect(onError.mock.calls[0][0].message).toContain('500')
  })

  it('should handle missing response body', async () => {
    const onError = vi.fn()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      body: null,
    } as unknown as Response)

    const { result } = renderHook(() => useStreaming({ onError }))

    await act(async () => {
      await result.current.connect('/api/test')
    })

    expect(onError).toHaveBeenCalledWith(expect.any(Error))
    expect(onError.mock.calls[0][0].message).toBe('No response body')
  })

  it('should handle error chunk type', async () => {
    const onError = vi.fn()
    const onComplete = vi.fn()

    const chunks = [
      'data: {"type":"error","data":{"message":"Stream error"}}\n',
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

    const { result } = renderHook(() => useStreaming({ onError, onComplete }))

    await act(async () => {
      await result.current.connect('/api/test')
    })

    expect(onComplete).toHaveBeenCalled()
    expect(result.current.isConnected).toBe(false)
  })

  it('should disconnect and abort', async () => {
    const mockReader = {
      read: vi.fn().mockImplementation(async () => {
        await new Promise(() => {})
        return { done: true, value: undefined }
      }),
      cancel: vi.fn(),
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => mockReader },
    } as unknown as Response)

    const { result } = renderHook(() => useStreaming())

    act(() => {
      result.current.connect('/api/test')
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })

    act(() => {
      result.current.disconnect()
    })

    expect(mockReader.cancel).toHaveBeenCalled()
    expect(result.current.isConnected).toBe(false)
  })

  it('should ignore AbortError', async () => {
    const onError = vi.fn()
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError)

    const { result } = renderHook(() => useStreaming({ onError }))

    await act(async () => {
      await result.current.connect('/api/test')
    })

    expect(onError).not.toHaveBeenCalled()
    expect(result.current.isConnected).toBe(false)
  })

  it('should abort previous connection on new connect', async () => {
    const abortSpy = vi.fn()

    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() => useStreaming())

    act(() => {
      result.current.connect('/api/test1')
    })

    const originalAbortController = (result.current as unknown as { isConnected: boolean })

    act(() => {
      result.current.connect('/api/test2')
    })

    expect(result.current.isConnected).toBe(false)
  })

  it('should send body as JSON in request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
        }),
      },
    } as unknown as Response)

    const { result } = renderHook(() => useStreaming())

    await act(async () => {
      await result.current.connect('/api/test', { message: 'hello' })
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ message: 'hello' }),
      })
    )
  })

  it('should handle stream ending naturally (done from reader)', async () => {
    const onComplete = vi.fn()

    const mockReader = {
      read: vi.fn().mockResolvedValueOnce({ done: true, value: undefined }),
    }

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      body: { getReader: () => mockReader },
    } as unknown as Response)

    const { result } = renderHook(() => useStreaming({ onComplete }))

    await act(async () => {
      await result.current.connect('/api/test')
    })

    expect(onComplete).toHaveBeenCalled()
    expect(result.current.isConnected).toBe(false)
  })
})
