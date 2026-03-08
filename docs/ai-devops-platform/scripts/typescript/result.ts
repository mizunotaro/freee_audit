/**
 * Result<T, E> Type Pattern for AI-DevOps-Platform
 * Provides type-safe error handling without exceptions
 *
 * @see docs/ai/QUALITY_STANDARDS.md - Quality Gate 9: Function Design
 */

export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E }

export type AsyncResult<T, E = Error> = Promise<Result<T, E>>

export interface ResultUtils {
  ok: <T, E = Error>(data: T) => Result<T, E>
  err: <T, E = Error>(error: E) => Result<T, E>
  isOk: <T, E>(result: Result<T, E>) => result is { success: true; data: T }
  isErr: <T, E>(result: Result<T, E>) => result is { success: false; error: E }
  map: <T, U, E>(result: Result<T, E>, fn: (data: T) => U) => Result<U, E>
  mapErr: <T, E, F>(result: Result<T, E>, fn: (error: E) => F) => Result<T, F>
  andThen: <T, U, E>(result: Result<T, E>, fn: (data: T) => Result<U, E>) => Result<U, E>
  orElse: <T, E, F>(result: Result<T, E>, fn: (error: E) => Result<T, F>) => Result<T, F>
  unwrap: <T, E>(result: Result<T, E>) => T
  unwrapOr: <T, E>(result: Result<T, E>, defaultValue: T) => T
  unwrapErr: <T, E>(result: Result<T, E>) => E
  expect: <T, E>(result: Result<T, E>, message: string) => T
  combine: <T, E>(results: Result<T, E>[]) => Result<T[], E>
  partition: <T, E>(results: Result<T, E>[]) => { ok: T[]; err: E[] }
  fromPromise: <T>(promise: Promise<T>) => AsyncResult<T, Error>
  tryCatch: <T>(fn: () => T) => Result<T, Error>
}

// eslint-disable-next-line no-redeclare
export const Result: ResultUtils = {
  ok<T, E = Error>(data: T): Result<T, E> {
    return { success: true, data }
  },

  err<T, E = Error>(error: E): Result<T, E> {
    return { success: false, error }
  },

  isOk<T, E>(result: Result<T, E>): result is { success: true; data: T } {
    return result.success === true
  },

  isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
    return result.success === false
  },

  map<T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> {
    return result.success ? Result.ok(fn(result.data)) : result
  },

  mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
    return result.success ? (result as Result<T, F>) : Result.err(fn(result.error))
  },

  andThen<T, U, E>(result: Result<T, E>, fn: (data: T) => Result<U, E>): Result<U, E> {
    return result.success ? fn(result.data) : result
  },

  orElse<T, E, F>(result: Result<T, E>, fn: (error: E) => Result<T, F>): Result<T, F> {
    return result.success ? (result as Result<T, F>) : fn(result.error)
  },

  unwrap<T, E>(result: Result<T, E>): T {
    if (result.success) {
      return result.data
    }
    throw result.error
  },

  unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    return result.success ? result.data : defaultValue
  },

  unwrapErr<T, E>(result: Result<T, E>): E {
    if (!result.success) {
      return result.error
    }
    throw new Error(`Called unwrapErr on Ok value: ${JSON.stringify(result.data)}`)
  },

  expect<T, E>(result: Result<T, E>, message: string): T {
    if (result.success) {
      return result.data
    }
    throw new Error(`${message}: ${JSON.stringify(result.error)}`)
  },

  combine<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const data: T[] = []
    for (const result of results) {
      if (!result.success) {
        return result
      }
      data.push(result.data)
    }
    return Result.ok(data)
  },

  partition<T, E>(results: Result<T, E>[]): { ok: T[]; err: E[] } {
    const ok: T[] = []
    const err: E[] = []
    for (const result of results) {
      if (result.success) {
        ok.push(result.data)
      } else {
        err.push(result.error)
      }
    }
    return { ok, err }
  },

  async fromPromise<T>(promise: Promise<T>): AsyncResult<T, Error> {
    try {
      const data = await promise
      return Result.ok(data)
    } catch (error) {
      return Result.err(error instanceof Error ? error : new Error(String(error)))
    }
  },

  tryCatch<T>(fn: () => T): Result<T, Error> {
    try {
      return Result.ok(fn())
    } catch (error) {
      return Result.err(error instanceof Error ? error : new Error(String(error)))
    }
  },
}

export interface AppError {
  code: string
  message: string
  details?: Record<string, unknown>
  cause?: Error
}

// eslint-disable-next-line no-redeclare
export const AppError = {
  create(
    code: string,
    message: string,
    details?: Record<string, unknown>,
    cause?: Error
  ): AppError {
    const error: AppError = { code, message }
    if (details !== undefined) error.details = details
    if (cause !== undefined) error.cause = cause
    return error
  },

  isAppError(error: unknown): error is AppError {
    return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
  },

  fromError(error: Error, code = 'UNKNOWN_ERROR'): AppError {
    return {
      code,
      message: error.message,
      cause: error,
    }
  },

  fromUnknown(error: unknown, code = 'UNKNOWN_ERROR'): AppError {
    if (error instanceof Error) {
      return AppError.fromError(error, code)
    }
    return {
      code,
      message: String(error),
    }
  },
}

export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT_ERROR: 'RATE_LIMIT_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  QUALITY_GATE_FAILED: 'QUALITY_GATE_FAILED',
  BUILD_FAILED: 'BUILD_FAILED',
  TEST_FAILED: 'TEST_FAILED',
  LINT_FAILED: 'LINT_FAILED',
  TYPE_CHECK_FAILED: 'TYPE_CHECK_FAILED',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

export function createError(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): AppError {
  return AppError.create(code, message, details)
}

export function timeoutError(duration: number): AppError {
  return createError(ErrorCodes.TIMEOUT_ERROR, `Operation timed out after ${duration}ms`, {
    duration,
  })
}

export function validationError(message: string, details?: Record<string, unknown>): AppError {
  return createError(ErrorCodes.VALIDATION_ERROR, message, details)
}

export function qualityGateError(gate: string, output: string): AppError {
  return createError(ErrorCodes.QUALITY_GATE_FAILED, `Quality gate failed: ${gate}`, {
    gate,
    output,
  })
}

export type RetryableResult<T, E = AppError> = Result<T, E> & {
  retryable?: boolean
  retryAfter?: number
}

export function isRetryable<T, E>(result: Result<T, E>): result is RetryableResult<T, E> {
  return 'retryable' in result && (result as RetryableResult<T, E>).retryable === true
}
