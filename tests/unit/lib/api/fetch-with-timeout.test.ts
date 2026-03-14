import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchWithTimeout,
  fetchWithRetry,
  createCancellableFetch,
  FetchTimeoutError,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
} from '@/lib/api/fetch-with-timeout'

describe('fetchWithTimeout', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return response when request completes within timeout', async () => {
    const mockResponse = new Response('OK', { status: 200 })
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse)

    const response = await fetchWithTimeout('https://example.com/api')

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('should use default timeout of 30000ms', async () => {
    const mockResponse = new Response('OK', { status: 200 })
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse)

    await fetchWithTimeout('https://example.com/api')

    expect(DEFAULT_TIMEOUT_MS).toBe(30000)
  })

  it('should throw FetchTimeoutError when request times out', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(
      (_input: string | URL | Request, init: RequestInit | undefined) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          if (signal) {
            if (signal.aborted) {
              reject(new DOMException('Aborted', 'AbortError'))
              return
            }
            const handler = () => {
              reject(new DOMException('Aborted', 'AbortError'))
            }
            signal.addEventListener('abort', handler)
          }
        })
      }
    )

    const promise = fetchWithTimeout('https://example.com/api', { timeout: 10 })

    try {
      await promise
      expect.fail('Expected FetchTimeoutError to be thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(FetchTimeoutError)
      if (error instanceof FetchTimeoutError) {
        expect(error.url).toBe('https://example.com/api')
        expect(error.timeout).toBe(10)
      }
    }
  })

  it('should call onTimeout callback when timeout occurs', async () => {
    vi.useFakeTimers()

    vi.spyOn(global, 'fetch').mockImplementation(
      (_input: string | URL | Request, init: RequestInit | undefined) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          if (signal) {
            signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'))
            })
          }
        })
      }
    )

    const onTimeout = vi.fn()
    const promise = fetchWithTimeout('https://example.com/api', {
      timeout: 100,
      onTimeout,
    })

    await vi.advanceTimersByTimeAsync(100)

    try {
      await promise
    } catch {
      // Expected to throw
    }

    expect(onTimeout).toHaveBeenCalledTimes(1)

    vi.useRealTimers()
  })

  it('should pass through fetch options', async () => {
    const mockResponse = new Response('OK', { status: 200 })
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse)

    await fetchWithTimeout('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      })
    )
  })

  it('should clear timeout after request completes', async () => {
    const mockResponse = new Response('OK', { status: 200 })
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse)

    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

    await fetchWithTimeout('https://example.com/api')

    expect(clearTimeoutSpy).toHaveBeenCalled()
  })

  it('should rethrow non-timeout errors', async () => {
    const networkError = new TypeError('Failed to fetch')
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(networkError)

    await expect(fetchWithTimeout('https://example.com/api')).rejects.toThrow(networkError)
  })
})

describe('FetchTimeoutError', () => {
  it('should have correct name', () => {
    const error = new FetchTimeoutError('https://example.com', 5000)
    expect(error.name).toBe('FetchTimeoutError')
  })

  it('should include url and timeout in message', () => {
    const error = new FetchTimeoutError('https://example.com/api', 5000)
    expect(error.message).toBe('Request to https://example.com/api timed out after 5000ms')
  })

  it('should have url and timeout properties', () => {
    const error = new FetchTimeoutError('https://example.com/api', 5000)
    expect(error.url).toBe('https://example.com/api')
    expect(error.timeout).toBe(5000)
  })
})

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should return response on first successful attempt', async () => {
    const mockResponse = new Response('OK', { status: 200 })
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse)

    const response = await fetchWithRetry('https://example.com/api')

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('should retry on 5xx errors with exponential backoff', async () => {
    const errorResponse = new Response('Server Error', { status: 500 })
    const successResponse = new Response('OK', { status: 200 })
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(errorResponse)
      .mockResolvedValueOnce(successResponse)

    const fetchPromise = fetchWithRetry('https://example.com/api', {
      retries: 3,
      retryDelay: 100,
    })

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(100)

    const response = await fetchPromise
    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('should retry on 429 (rate limit) errors', async () => {
    const rateLimitResponse = new Response('Rate Limited', { status: 429 })
    const successResponse = new Response('OK', { status: 200 })
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(rateLimitResponse)
      .mockResolvedValueOnce(successResponse)

    const fetchPromise = fetchWithRetry('https://example.com/api', {
      retries: 3,
      retryDelay: 50,
    })

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(50)

    const response = await fetchPromise
    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('should not retry on 4xx client errors (except 429)', async () => {
    const notFoundResponse = new Response('Not Found', { status: 404 })
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(notFoundResponse)

    const response = await fetchWithRetry('https://example.com/api', {
      retries: 3,
      retryDelay: 50,
    })

    expect(response.status).toBe(404)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('should use custom retryOn function', async () => {
    const badRequestResponse = new Response('Bad Request', { status: 400 })
    const successResponse = new Response('OK', { status: 200 })
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(badRequestResponse)
      .mockResolvedValueOnce(successResponse)

    const retryOn = (response: Response) => response.status === 400
    const fetchPromise = fetchWithRetry('https://example.com/api', {
      retries: 3,
      retryDelay: 50,
      retryOn,
    })

    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(50)

    const response = await fetchPromise
    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('should exhaust retries and return last response', async () => {
    const errorResponse = new Response('Server Error', { status: 500 })
    vi.spyOn(global, 'fetch').mockResolvedValue(errorResponse)

    const fetchPromise = fetchWithRetry('https://example.com/api', {
      retries: 2,
      retryDelay: 50,
    })

    await vi.runAllTimersAsync()

    const response = await fetchPromise
    expect(response.status).toBe(500)
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  it('should apply exponential backoff correctly', async () => {
    const errorResponse = new Response('Server Error', { status: 500 })
    const successResponse = new Response('OK', { status: 200 })

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(errorResponse)
      .mockResolvedValueOnce(errorResponse)
      .mockResolvedValueOnce(successResponse)

    const fetchPromise = fetchWithRetry('https://example.com/api', {
      retries: 3,
      retryDelay: 100,
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(100)
    expect(global.fetch).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(200)
    expect(global.fetch).toHaveBeenCalledTimes(3)

    const response = await fetchPromise
    expect(response.status).toBe(200)
  })

  it('should cap retry delay at maximum', async () => {
    const errorResponse = new Response('Server Error', { status: 500 })
    vi.spyOn(global, 'fetch').mockResolvedValue(errorResponse)

    const fetchPromise = fetchWithRetry('https://example.com/api', {
      retries: 5,
      retryDelay: 10000,
    })

    await vi.runAllTimersAsync()

    await fetchPromise
    expect(global.fetch).toHaveBeenCalledTimes(6)
  })

  it('should use default retries (3)', () => {
    expect(DEFAULT_RETRIES).toBe(3)
  })

  it('should use default retry delay (1000ms)', () => {
    expect(DEFAULT_RETRY_DELAY_MS).toBe(1000)
  })
})

describe('createCancellableFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return fetch function and abort function', () => {
    const { fetch, abort, abortAll } = createCancellableFetch()

    expect(typeof fetch).toBe('function')
    expect(typeof abort).toBe('function')
    expect(typeof abortAll).toBe('function')
  })

  it('should successfully fetch and return response', async () => {
    const mockResponse = new Response('OK', { status: 200 })
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse)

    const { fetch } = createCancellableFetch()
    const response = await fetch('https://example.com/api')

    expect(response.status).toBe(200)
  })

  it('should abort all pending requests when abort is called', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(
      (_input: string | URL | Request, init: RequestInit | undefined) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          if (signal) {
            const handler = () => {
              reject(new DOMException('Aborted', 'AbortError'))
            }
            signal.addEventListener('abort', handler)
          }
        })
      }
    )

    const { fetch, abort } = createCancellableFetch()

    const fetch1Promise = fetch('https://example.com/api/1', { timeout: 5000 })
    const fetch2Promise = fetch('https://example.com/api/2', { timeout: 5000 })

    abort()

    await expect(fetch1Promise).rejects.toThrow()
    await expect(fetch2Promise).rejects.toThrow()
  })

  it('should abort all pending requests when abortAll is called', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(
      (_input: string | URL | Request, init: RequestInit | undefined) => {
        return new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal
          if (signal) {
            const handler = () => {
              reject(new DOMException('Aborted', 'AbortError'))
            }
            signal.addEventListener('abort', handler)
          }
        })
      }
    )

    const { fetch, abortAll } = createCancellableFetch()

    const fetchPromise = fetch('https://example.com/api', { timeout: 5000 })

    abortAll()

    await expect(fetchPromise).rejects.toThrow()
  })

  it('should support multiple sequential fetches', async () => {
    const mockResponse1 = new Response('OK 1', { status: 200 })
    const mockResponse2 = new Response('OK 2', { status: 200 })
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(mockResponse1)
      .mockResolvedValueOnce(mockResponse2)

    const { fetch } = createCancellableFetch()

    const response1 = await fetch('https://example.com/api/1')
    const response2 = await fetch('https://example.com/api/2')

    expect(response1.status).toBe(200)
    expect(response2.status).toBe(200)
  })

  it('should support external AbortSignal', async () => {
    const mockResponse = new Response('OK', { status: 200 })
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse)

    const { fetch } = createCancellableFetch()
    const externalController = new AbortController()

    await fetch('https://example.com/api', { signal: externalController.signal })

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      })
    )
  })

  it('should clean up controller after successful fetch', async () => {
    const mockResponse = new Response('OK', { status: 200 })
    vi.spyOn(global, 'fetch').mockResolvedValue(mockResponse)

    const { fetch, abort } = createCancellableFetch()

    await fetch('https://example.com/api/1')
    await fetch('https://example.com/api/2')

    abort()

    const response3 = await fetch('https://example.com/api/3')
    expect(response3.status).toBe(200)
  })

  it('should pass through fetch options', async () => {
    const mockResponse = new Response('OK', { status: 200 })
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce(mockResponse)

    const { fetch } = createCancellableFetch()

    await fetch('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
      timeout: 5000,
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      })
    )
  })
})
