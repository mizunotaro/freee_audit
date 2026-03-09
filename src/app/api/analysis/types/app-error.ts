export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'MISSING_REQUIRED_FIELDS'
  | 'INVALID_DATA'
  | 'ANALYSIS_FAILED'
  | 'BENCHMARK_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'UNAUTHORIZED'
  | 'TIMEOUT'
  | 'CIRCUIT_BREAKER_OPEN'

export interface AppError {
  readonly code: ErrorCode
  readonly message: string
  readonly details?: Record<string, unknown>
  readonly timestamp: string
  readonly requestId?: string
}

interface CreateErrorOptions {
  readonly details?: Record<string, unknown>
  readonly requestId?: string
}

export function createError(
  code: ErrorCode,
  message: string,
  options?: CreateErrorOptions
): AppError {
  const baseError = {
    code,
    message,
    timestamp: new Date().toISOString(),
  }

  if (options?.details && options?.requestId) {
    return {
      ...baseError,
      details: options.details,
      requestId: options.requestId,
    }
  }

  if (options?.details) {
    return {
      ...baseError,
      details: options.details,
    }
  }

  if (options?.requestId) {
    return {
      ...baseError,
      requestId: options.requestId,
    }
  }

  return baseError
}

export function createValidationError(
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): AppError {
  return createError('VALIDATION_ERROR', message, { details, requestId })
}

export function createMissingFieldsError(fields: readonly string[], requestId?: string): AppError {
  return createError('MISSING_REQUIRED_FIELDS', `${fields.join(', ')} are required`, {
    details: { fields },
    requestId,
  })
}

export function createInternalError(message: string, requestId?: string): AppError {
  return createError('INTERNAL_ERROR', message, { requestId })
}

export function createTimeoutError(
  operation: string,
  timeoutMs: number,
  requestId?: string
): AppError {
  return createError('TIMEOUT', `Operation ${operation} timed out after ${timeoutMs}ms`, {
    details: { operation, timeoutMs },
    requestId,
  })
}

export function createCircuitBreakerError(requestId?: string): AppError {
  return createError(
    'CIRCUIT_BREAKER_OPEN',
    'Service temporarily unavailable due to repeated failures',
    {
      requestId,
    }
  )
}
