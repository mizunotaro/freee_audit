/**
 * Result型パターン実装
 *
 * 関数の戻り値で成功/失敗を明示的に扱うためのResult型とヘルパー関数。
 * 例外処理の代わりに、予測可能なエラーハンドリングを実現します。
 *
 * @module types/result
 */

/**
 * アプリケーション共通エラーインターフェース
 *
 * @property code - エラーコード（例: 'VALIDATION_ERROR'）
 * @property message - ユーザー向けメッセージ
 * @property details - 追加情報（オプション）
 * @property cause - 元のエラー（オプション）
 * @property timestamp - エラー発生時刻
 */
export interface AppError {
  code: string
  message: string
  details?: Record<string, unknown>
  cause?: Error
  timestamp: Date
}

/**
 * 成功時のResult型
 */
export type SuccessResult<T> = {
  success: true
  data: T
}

/**
 * 失敗時のResult型
 */
export type FailureResult<E> = {
  success: false
  error: E
}

/**
 * Result型 - 成功または失敗を表現するユニオン型
 *
 * @template T - 成功時のデータ型
 * @template E - 失敗時のエラー型（デフォルト: AppError）
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, AppError> {
 *   if (b === 0) {
 *     return failure({
 *       code: ERROR_CODES.VALIDATION_ERROR,
 *       message: 'ゼロで除算することはできません',
 *       timestamp: new Date()
 *     })
 *   }
 *   return success(a / b)
 * }
 *
 * const result = divide(10, 2)
 * if (result.success) {
 *   console.log(result.data) // 5
 * } else {
 *   console.error(result.error.message)
 * }
 * ```
 */
export type Result<T, E = AppError> = SuccessResult<T> | FailureResult<E>

/**
 * ページネーション付き結果型
 */
export type PaginatedResult<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/**
 * バリデーションエラー型
 */
export type ValidationError = {
  field: string
  message: string
  code: string
}

/**
 * ビジネスロジックエラー型
 */
export type BusinessError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

/**
 * エラーコード定数
 *
 * アプリケーション全体で使用される標準エラーコード。
 * 新しいエラーコードを追加する場合は、この定数に追加してください。
 */
export const ERROR_CODES = {
  /** 入力値のバリデーションエラー */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** リソースが見つからない */
  NOT_FOUND: 'NOT_FOUND',
  /** 認証エラー・権限なし */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** タイムアウト */
  TIMEOUT: 'TIMEOUT',
  /** データベースエラー */
  DATABASE_ERROR: 'DATABASE_ERROR',
  /** 外部サービスエラー */
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
  /** ビジネスロジックエラー */
  BUSINESS_LOGIC_ERROR: 'BUSINESS_LOGIC_ERROR',
} as const

/**
 * エラーコードの型
 */
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

/**
 * 成功結果を作成するヘルパー関数
 *
 * @template T - データの型
 * @param data - 成功時に返すデータ
 * @returns 成功を表すResult型
 *
 * @example
 * ```typescript
 * const result = success({ id: 1, name: 'John' })
 * // result: { success: true, data: { id: 1, name: 'John' } }
 * ```
 */
export function success<T>(data: T): SuccessResult<T> {
  return { success: true, data }
}

/**
 * 失敗結果を作成するヘルパー関数
 *
 * @template E - エラーの型
 * @param error - 失敗時に返すエラー
 * @returns 失敗を表すResult型
 *
 * @example
 * ```typescript
 * const result = failure<AppError>({
 *   code: ERROR_CODES.NOT_FOUND,
 *   message: 'ユーザーが見つかりません',
 *   timestamp: new Date()
 * })
 * // result: { success: false, error: { code: 'NOT_FOUND', ... } }
 * ```
 */
export function failure<E>(error: E): FailureResult<E> {
  return { success: false, error }
}

/**
 * Resultが成功かどうかを判定する型ガード関数
 *
 * @template T - データの型
 * @template E - エラーの型
 * @param result - 判定対象のResult
 * @returns 成功の場合true、TypeScriptの型ガードとして機能
 *
 * @example
 * ```typescript
 * const result = someFunction()
 * if (isSuccess(result)) {
 *   // このブロック内では result.data に安全にアクセス可能
 *   console.log(result.data)
 * }
 * ```
 */
export function isSuccess<T, E>(result: Result<T, E>): result is SuccessResult<T> {
  return result.success === true
}

/**
 * Resultが失敗かどうかを判定する型ガード関数
 *
 * @template T - データの型
 * @template E - エラーの型
 * @param result - 判定対象のResult
 * @returns 失敗の場合true、TypeScriptの型ガードとして機能
 *
 * @example
 * ```typescript
 * const result = someFunction()
 * if (isFailure(result)) {
 *   // このブロック内では result.error に安全にアクセス可能
 *   console.error(result.error)
 * }
 * ```
 */
export function isFailure<T, E>(result: Result<T, E>): result is FailureResult<E> {
  return result.success === false
}

/**
 * AppErrorを作成するヘルパー関数
 *
 * @param code - エラーコード
 * @param message - ユーザー向けメッセージ
 * @param options - 追加オプション
 * @returns AppErrorオブジェクト
 *
 * @example
 * ```typescript
 * const error = createAppError(
 *   ERROR_CODES.VALIDATION_ERROR,
 *   '入力値が無効です',
 *   { details: { field: 'email' }, cause: originalError }
 * )
 * ```
 */
export function createAppError(
  code: ErrorCode | string,
  message: string,
  options?: {
    details?: Record<string, unknown>
    cause?: Error
  }
): AppError {
  return {
    code,
    message,
    details: options?.details,
    cause: options?.cause,
    timestamp: new Date(),
  }
}

/**
 * 非同期関数をtry-catchでラップし、Result型を返すヘルパー関数
 *
 * 例外が発生する可能性のある非同期処理を安全にラップし、
 * 例外をキャッチしてResult型として返します。
 *
 * @template T - 成功時のデータ型
 * @param fn - 実行する非同期関数
 * @param errorCode - エラー時のコード（デフォルト: 'EXTERNAL_SERVICE_ERROR'）
 * @returns Result型を返すPromise
 *
 * @example
 * ```typescript
 * const result = await tryCatch(async () => {
 *   const response = await fetch('/api/data')
 *   if (!response.ok) {
 *     throw new Error('Request failed')
 *   }
 *   return response.json()
 * })
 *
 * if (result.success) {
 *   console.log(result.data)
 * } else {
 *   console.error(result.error.message)
 * }
 * ```
 */
export async function tryCatch<T>(
  fn: () => Promise<T>,
  errorCode: ErrorCode | string = ERROR_CODES.EXTERNAL_SERVICE_ERROR
): Promise<Result<T, AppError>> {
  try {
    const data = await fn()
    return success(data)
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error))
    return failure(
      createAppError(errorCode, cause.message, {
        cause,
      })
    )
  }
}

/**
 * 同期関数をtry-catchでラップし、Result型を返すヘルパー関数
 *
 * 例外が発生する可能性のある同期処理を安全にラップし、
 * 例外をキャッチしてResult型として返します。
 *
 * @template T - 成功時のデータ型
 * @param fn - 実行する同期関数
 * @param errorCode - エラー時のコード（デフォルト: 'BUSINESS_LOGIC_ERROR'）
 * @returns Result型
 *
 * @example
 * ```typescript
 * const result = tryCatchSync(() => {
 *   return JSON.parse(jsonString)
 * })
 * ```
 */
export function tryCatchSync<T>(
  fn: () => T,
  errorCode: ErrorCode | string = ERROR_CODES.BUSINESS_LOGIC_ERROR
): Result<T, AppError> {
  try {
    const data = fn()
    return success(data)
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error))
    return failure(
      createAppError(errorCode, cause.message, {
        cause,
      })
    )
  }
}
