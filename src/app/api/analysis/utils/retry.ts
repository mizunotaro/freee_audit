import { RETRY_CONFIG } from '../config/constants'

export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

/**
 * 指数バックオフ付きリトライロジック
 *
 * @param operation - 実行する非同期操作
 * @param config - リトライ設定
 * @returns 操作の結果
 * @throws 最大リトライ回数を超えた場合、最後のエラーをスロー
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => await fetchData(),
 *   { maxRetries: 3, initialDelayMs: 1000 }
 * )
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig: RetryConfig = {
    ...RETRY_CONFIG,
    ...config,
  }

  let lastError: Error | undefined
  let delay = finalConfig.initialDelayMs

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < finalConfig.maxRetries) {
        await sleep(delay)
        delay = Math.min(delay * finalConfig.backoffMultiplier, finalConfig.maxDelayMs)
      }
    }
  }

  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
