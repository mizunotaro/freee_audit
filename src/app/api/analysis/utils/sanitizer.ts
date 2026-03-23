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
  'privateKey',
  'private_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'clientSecret',
  'client_secret',
  'encryptionKey',
  'encryption_key',
  'databaseUrl',
  'database_url',
  'dbUrl',
  'db_url',
  'connectionString',
  'connection_string',
  'sshKey',
  'ssh_key',
  'cardNumber',
  'card_number',
  'cvv',
  'cvc',
  'ssn',
]

const SENSITIVE_KEY_PATTERNS: readonly RegExp[] = [
  /(?:api[_-]?key|apikey)/i,
  /(?:secret|password|passwd|pwd)/i,
  /(?:token|bearer|jwt)/i,
  /(?:credential|auth)/i,
  /(?:private[_-]?key|access[_-]?key)/i,
  /(?:session[_-]?id|sessionid)/i,
  /(?:refresh[_-]?token)/i,
  /(?:client[_-]?secret)/i,
  /(?:encryption[_-]?key)/i,
  /(?:database[_-]?url|db[_-]?url)/i,
  /(?:connection[_-]?string)/i,
  /(?:ssh[_-]?key|rsa[_-]?key)/i,
  /(?:card[_-]?number|cvv|cvc)/i,
  /(?:ssn|social[_-]?security)/i,
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
export function sanitizeForLog(
  obj: Record<string, unknown>,
  depth: number = 0
): Record<string, unknown> {
  if (depth > 10) {
    return { '[MAX_DEPTH]': true }
  }

  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    const isSensitive =
      SENSITIVE_KEYS.some((k) => lowerKey.includes(k.toLowerCase())) ||
      SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))

    if (isSensitive) {
      result[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === 'object' && item !== null
            ? sanitizeForLog(item as Record<string, unknown>, depth + 1)
            : item
        )
      } else {
        result[key] = sanitizeForLog(value as Record<string, unknown>, depth + 1)
      }
    } else if (typeof value === 'string' && value.length > 1000) {
      result[key] = value.slice(0, 100) + '...[TRUNCATED]'
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
