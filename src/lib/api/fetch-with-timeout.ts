export const DEFAULT_TIMEOUT_MS = 30000
export const DEFAULT_RETRIES = 3
export const DEFAULT_RETRY_DELAY_MS = 1000
export const MAX_RETRY_DELAY_MS = 30000
export const BACKOFF_MULTIPLIER = 2

export class FetchTimeoutError extends Error {
  readonly name = 'FetchTimeoutError'
  readonly url: string
  readonly timeout: number

  constructor(url: string, timeout: number) {
    super(`Request to ${url} timed out after ${timeout}ms`)
    this.url = url
    this.timeout = timeout
  }
}

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number
  onTimeout?: () => void
}

export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS, onTimeout, ...fetchOptions } = options
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
    onTimeout?.()
  }, timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (isAbortError(error)) {
      throw new FetchTimeoutError(url, timeout)
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}

function isAbortError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') {
    return true
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: string }).name === 'AbortError'
  ) {
    return true
  }
  return false
}

export interface FetchWithRetryOptions extends FetchWithTimeoutOptions {
  retries?: number
  retryDelay?: number
  retryOn?: (response: Response) => boolean
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    retries = DEFAULT_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY_MS,
    retryOn = defaultRetryOn,
    ...fetchOptions
  } = options

  let currentDelay = retryDelay
  let lastResponse: Response | undefined

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetchWithTimeout(url, fetchOptions)

    if (attempt < retries && retryOn(response)) {
      await sleep(currentDelay)
      currentDelay = Math.min(currentDelay * BACKOFF_MULTIPLIER, MAX_RETRY_DELAY_MS)
      lastResponse = response
      continue
    }

    return response
  }

  return lastResponse!
}

function defaultRetryOn(response: Response): boolean {
  return response.status === 429 || (response.status >= 500 && response.status < 600)
}

export interface CancellableFetch {
  fetch: (url: string, options?: FetchWithTimeoutOptions) => Promise<Response>
  abort: () => void
  abortAll: () => void
}

export function createCancellableFetch(): CancellableFetch {
  const controllers = new Set<AbortController>()

  const abortAllControllers = (): void => {
    controllers.forEach((controller) => controller.abort())
    controllers.clear()
  }

  return {
    async fetch(url: string, options: FetchWithTimeoutOptions = {}): Promise<Response> {
      const controller = new AbortController()
      controllers.add(controller)

      const { signal: externalSignal, ...restOptions } = options

      const combinedSignal = externalSignal
        ? AbortSignal.any([controller.signal, externalSignal])
        : controller.signal

      try {
        const response = await fetchWithTimeout(url, {
          ...restOptions,
          signal: combinedSignal,
        })
        return response
      } finally {
        controllers.delete(controller)
      }
    },

    abort(): void {
      abortAllControllers()
    },

    abortAll(): void {
      abortAllControllers()
    },
  }
}
