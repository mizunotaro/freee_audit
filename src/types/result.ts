export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E }

export type PaginatedResult<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export type ValidationError = {
  field: string
  message: string
  code: string
}

export type BusinessError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

export function success<T>(data: T): Result<T> {
  return { success: true, data }
}

export function failure<T, E = Error>(error: E): Result<T, E> {
  return { success: false, error }
}

export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; data: T } {
  return result.success === true
}

export function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false
}
