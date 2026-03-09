import type { AppError } from './app-error'

export interface ResponseMetadata {
  readonly requestId: string
  readonly processingTimeMs: number
  readonly cached: boolean
  readonly version: string
  readonly timestamp: string
}

export interface ApiResponse<T> {
  readonly success: boolean
  readonly data?: T
  readonly error?: AppError
  readonly metadata: ResponseMetadata
}

export function createSuccessResponse<T>(
  data: T,
  metadata: Partial<ResponseMetadata>
): ApiResponse<T> {
  return {
    success: true,
    data,
    metadata: {
      requestId: metadata.requestId ?? 'unknown',
      processingTimeMs: metadata.processingTimeMs ?? 0,
      cached: metadata.cached ?? false,
      version: metadata.version ?? '1.0.0',
      timestamp: metadata.timestamp ?? new Date().toISOString(),
    },
  }
}

export function createErrorResponse(
  error: AppError,
  metadata: Partial<ResponseMetadata>
): ApiResponse<never> {
  return {
    success: false,
    error,
    metadata: {
      requestId: metadata.requestId ?? error.requestId ?? 'unknown',
      processingTimeMs: metadata.processingTimeMs ?? 0,
      cached: false,
      version: metadata.version ?? '1.0.0',
      timestamp: metadata.timestamp ?? new Date().toISOString(),
    },
  }
}
