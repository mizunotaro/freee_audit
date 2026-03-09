export const SENSITIVE_KEYS = [
  'password',
  'apiKey',
  'api_key',
  'token',
  'secret',
  'credential',
  'authorization',
  'session',
  'cookie',
]

/**
 * 入力文字列をサニタイズ
 * - 制御文字を除去
 * - 長さを制限
 * - 前後の空白を削除
 *
 * @param input - 入力文字列
 * @param maxLength - 最大長（デフォルト: 10000）
 * @returns サニタイズされた文字列
 */
export function sanitizeInput(input: string, maxLength: number = 10000): string {
  return (
    input
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1F\x7F]/g, '')
      .slice(0, maxLength)
      .trim()
  )
}

/**
 * ログ出力用にセンシティブな情報をフィルタリング
 *
 * @param obj - フィルタリング対象のオブジェクト
 * @returns フィルタリング済みのオブジェクト
 */
export function sanitizeForLog(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    const isSensitive = SENSITIVE_KEYS.some((k) => lowerKey.includes(k))

    if (isSensitive) {
      result[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeForLog(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * 機密情報をマスク
 *
 * @param value - マスク対象の文字列
 * @param visibleChars - 両端に表示する文字数（デフォルト: 4）
 * @returns マスクされた文字列
 */
export function maskSensitive(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars * 2) {
    return '*'.repeat(value.length)
  }
  return value.slice(0, visibleChars) + '****' + value.slice(-visibleChars)
}

/**
 * HTMLエスケープ
 *
 * @param str - エスケープ対象の文字列
 * @returns エスケープされた文字列
 */
export function escapeHtml(str: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }

  return str.replace(/[&<>"']/g, (char) => htmlEntities[char] ?? char)
}

/**
 * JSON.stringify用のセキュアなreplacer
 */
export function secureReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'string') {
    const lowerKey = _key.toLowerCase()
    if (SENSITIVE_KEYS.some((k) => lowerKey.includes(k))) {
      return '[REDACTED]'
    }
  }
  return value
}
