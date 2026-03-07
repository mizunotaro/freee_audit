export class TimeoutError extends Error {
  constructor(
    public readonly timeoutMs: number,
    public readonly url?: string
  ) {
    super(`Request timed out after ${timeoutMs}ms${url ? ` (${url})` : ''}`)
    this.name = 'TimeoutError'
  }
}

export function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  return fetch(url, {
    ...options,
    signal: controller.signal,
  })
    .catch((error) => {
      if (error.name === 'AbortError') {
        throw new TimeoutError(timeoutMs, url)
      }
      throw error
    })
    .finally(() => clearTimeout(timeout))
}

export const API_TIMEOUTS = {
  FREEE_API: 30000,
  AI_API: 60000,
  SLACK_API: 10000,
  BOX_API: 60000,
  BOX_UPLOAD: 300000,
} as const
