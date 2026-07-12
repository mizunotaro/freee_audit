import crypto from 'crypto'

/**
 * 一意のリクエストIDを生成
 *
 * @param prefix - IDのプレフィックス（デフォルト: 'req'）
 * @returns フォーマットされたリクエストID
 */
export function generateRequestId(prefix: string = 'req'): string {
  const timestamp = Date.now().toString(36)
  const random = crypto.randomBytes(4).toString('hex')
  return `${prefix}-${timestamp}-${random}`
}

/**
 * トレースIDを生成
 *
 * @returns フォーマットされたトレースID
 */
export function generateTraceId(): string {
  const timestamp = Date.now().toString(36)
  const random = crypto.randomBytes(8).toString('hex')
  return `trace-${timestamp}-${random}`
}

/**
 * スパンIDを生成
 *
 * @returns フォーマットされたスパンID
 */
export function generateSpanId(): string {
  const random = crypto.randomBytes(4).toString('hex')
  return `span-${random}`
}
