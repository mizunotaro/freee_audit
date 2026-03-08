import { JOURNAL_PROPOSAL_CONFIG } from '@/config/journal-proposal'

export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: JOURNAL_PROPOSAL_CONFIG.api.maxRetries,
  initialDelayMs: JOURNAL_PROPOSAL_CONFIG.api.initialDelayMs,
  maxDelayMs: JOURNAL_PROPOSAL_CONFIG.api.maxDelayMs,
  backoffMultiplier: JOURNAL_PROPOSAL_CONFIG.api.backoffMultiplier,
}

export interface FetchWithTimeoutOptions extends RequestInit {
  timeout?: number
}

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly code: 'TIMEOUT' | 'NETWORK' | 'SERVER' | 'PARSE',
    public readonly statusCode?: number,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = 'FetchError'
  }
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchWithTimeout(
  url: string,
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const { timeout = JOURNAL_PROPOSAL_CONFIG.api.timeout, ...fetchOptions } = options

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    })
    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new FetchError(`Request timed out after ${timeout}ms`, 'TIMEOUT')
    }
    throw new FetchError(
      error instanceof Error ? error.message : 'Network error',
      'NETWORK',
      undefined,
      error instanceof Error ? error : undefined
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | undefined
  let delay = config.initialDelayMs

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < config.maxRetries) {
        await sleep(delay)
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs)
      }
    }
  }

  throw lastError
}

export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E }

export interface AppError {
  code: string
  message: string
  details?: Record<string, unknown>
  cause?: Error
}

export function createAppError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  cause?: Error
): AppError {
  return { code, message, details, cause }
}

export function sanitizeInput(input: string, maxLength: number = 10000): string {
  const withoutControlChars = input
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code > 31 && code !== 127
    })
    .join('')
  return withoutControlChars.slice(0, maxLength).trim()
}

const SENSITIVE_KEYS = ['password', 'apikey', 'token', 'secret', 'credential', 'authorization']

export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
      result[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeForLog(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}
