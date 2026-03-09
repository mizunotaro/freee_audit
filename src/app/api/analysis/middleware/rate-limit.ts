import { NextRequest, NextResponse } from 'next/server'
import { RATE_LIMIT_CONFIG } from '../config/constants'
import { createError } from '../types/app-error'
import type { ApiResponse } from '../types/response'
import { createErrorResponse } from '../types/response'

interface RateLimitStore {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitStore>()

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator?: (request: NextRequest) => string
}

function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown'
  }

  if (realIp) {
    return realIp
  }

  return 'unknown'
}

export function withRateLimit(config: RateLimitConfig = RATE_LIMIT_CONFIG) {
  return function (
    handler: (request: NextRequest) => Promise<NextResponse>
  ): (request: NextRequest) => Promise<NextResponse> {
    return async (request: NextRequest) => {
      const key = config.keyGenerator ? config.keyGenerator(request) : getClientIdentifier(request)

      const now = Date.now()
      const windowStart = now - (now % config.windowMs)

      const current = rateLimitStore.get(key)

      if (!current || current.resetTime < now) {
        rateLimitStore.set(key, {
          count: 1,
          resetTime: windowStart + config.windowMs,
        })
      } else {
        current.count++

        if (current.count > config.maxRequests) {
          const error = createError(
            'RATE_LIMIT_EXCEEDED',
            'Too many requests, please try again later',
            {
              details: {
                retryAfter: Math.ceil((current.resetTime - now) / 1000),
              },
            }
          )

          const response: ApiResponse<never> = createErrorResponse(error, {
            requestId: request.headers.get('x-request-id') ?? undefined,
          })

          return NextResponse.json(response, {
            status: 429,
            headers: {
              'X-RateLimit-Limit': config.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': current.resetTime.toString(),
              'Retry-After': Math.ceil((current.resetTime - now) / 1000).toString(),
            },
          })
        }
      }

      const response = await handler(request)

      const storeEntry = rateLimitStore.get(key)
      if (storeEntry) {
        response.headers.set('X-RateLimit-Limit', config.maxRequests.toString())
        response.headers.set(
          'X-RateLimit-Remaining',
          Math.max(0, config.maxRequests - storeEntry.count).toString()
        )
        response.headers.set('X-RateLimit-Reset', storeEntry.resetTime.toString())
      }

      return response
    }
  }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60000)
