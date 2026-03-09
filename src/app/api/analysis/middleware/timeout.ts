import { NextRequest, NextResponse } from 'next/server'
import { API_TIMEOUTS } from '../config/constants'
import { createTimeoutError } from '../types/app-error'
import type { ApiResponse } from '../types/response'
import { createErrorResponse } from '../types/response'

export interface TimeoutConfig {
  timeoutMs: number
}

export function withTimeout(config: TimeoutConfig = { timeoutMs: API_TIMEOUTS.analysis }) {
  return function <T>(
    handler: (request: NextRequest) => Promise<NextResponse<T>>
  ): (request: NextRequest) => Promise<NextResponse<T>> {
    return async (request: NextRequest) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs)

      try {
        const response = await handler(request)
        clearTimeout(timeoutId)
        return response
      } catch (error) {
        clearTimeout(timeoutId)

        if (error instanceof Error && error.name === 'AbortError') {
          const timeoutError = createTimeoutError('analysis', config.timeoutMs)
          const apiResponse: ApiResponse<never> = createErrorResponse(timeoutError, {
            requestId: request.headers.get('x-request-id') ?? undefined,
          })

          return NextResponse.json(apiResponse, { status: 504 }) as NextResponse<T>
        }

        throw error
      }
    }
  }
}

export async function withTimeoutPromise<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(createTimeoutError(operation, timeoutMs))
    }, timeoutMs)

    promise
      .then((result) => {
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}
