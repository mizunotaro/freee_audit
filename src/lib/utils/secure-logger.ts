/**
 * Secure Logger - 機密情報を自動マスキングするセキュアロガー
 *
 * 機能:
 * - 機密キーワードの自動検出とマスキング
 * - 環境変数名の保護
 * - オブジェクトの再帰的サニタイズ
 * - 構造化ログ出力
 *
 * @module lib/utils/secure-logger
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

interface LogContext {
  [key: string]: unknown
}

interface SanitizedLogContext {
  [key: string]: unknown
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  correlationId?: string
  context?: SanitizedLogContext
  environment?: string
  version?: string
}

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
  /(?:aws[_-]?access|aws[_-]?secret)/i,
  /(?:gcp[_-]?key|azure[_-]?key)/i,
  /(?:card[_-]?number|cvv|cvc)/i,
  /(?:ssn|social[_-]?security)/i,
] as const

const SENSITIVE_ENV_VARS: readonly string[] = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'OPENROUTER_API_KEY',
  'DEEPSEEK_API_KEY',
  'KIMI_API_KEY',
  'QWEN_API_KEY',
  'GROQ_API_KEY',
  'ENCRYPTION_KEY',
  'JWT_SECRET',
  'CSRF_SECRET',
  'DATABASE_URL',
  'FREEE_CLIENT_ID',
  'FREEE_CLIENT_SECRET',
  'FREEE_ACCESS_TOKEN',
  'FREEE_REFRESH_TOKEN',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_ENDPOINT',
  'ONEPASSWORD_CONNECT_TOKEN',
  'SLACK_BOT_TOKEN',
  'SLACK_WEBHOOK_URL',
  'REDIS_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
] as const

const MASK_VALUE = '[REDACTED]'
const MAX_STRING_LENGTH = 1000
const MAX_DEPTH = 10

function isSensitiveKey(key: string): boolean {
  return (
    SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key)) ||
    SENSITIVE_ENV_VARS.includes(key.toUpperCase())
  )
}

function isSensitiveEnvVar(key: string): boolean {
  return SENSITIVE_ENV_VARS.includes(key.toUpperCase())
}

function truncateString(value: string, maxLength: number = MAX_STRING_LENGTH): string {
  if (value.length <= maxLength) {
    return value
  }
  return `${value.slice(0, 100)}...[TRUNCATED ${value.length} chars]`
}

function maskSensitiveValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) {
    return value
  }

  if (typeof value === 'string') {
    if (isSensitiveKey(key) || isSensitiveEnvVar(key)) {
      return MASK_VALUE
    }
    return truncateString(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack ? truncateString(value.stack, 500) : undefined,
    }
  }

  return value
}

function sanitizeObject(
  obj: LogContext,
  depth: number = 0,
  seen: WeakSet<object> = new WeakSet()
): SanitizedLogContext {
  if (depth > MAX_DEPTH) {
    return { '[MAX_DEPTH_EXCEEDED]': true }
  }

  if (obj === null || obj === undefined) {
    return obj as unknown as SanitizedLogContext
  }

  if (typeof obj !== 'object') {
    return obj as unknown as SanitizedLogContext
  }

  if (seen.has(obj)) {
    return { '[CIRCULAR_REFERENCE]': true }
  }

  seen.add(obj)

  if (Array.isArray(obj)) {
    return obj.map((item, index) => {
      if (typeof item === 'object' && item !== null) {
        return sanitizeObject(item, depth + 1, seen)
      }
      return maskSensitiveValue(`array[${index}]`, item)
    }) as unknown as SanitizedLogContext
  }

  const sanitized: SanitizedLogContext = {}

  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = maskSensitiveKey(key)

    if (isSensitiveKey(key)) {
      sanitized[sanitizedKey] = MASK_VALUE
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[sanitizedKey] = sanitizeObject(value as LogContext, depth + 1, seen)
    } else {
      sanitized[sanitizedKey] = maskSensitiveValue(key, value)
    }
  }

  return sanitized
}

function maskSensitiveKey(key: string): string {
  for (const pattern of SENSITIVE_KEY_PATTERNS) {
    if (pattern.test(key)) {
      return key.replace(/./g, '*').slice(0, 3) + key.slice(-3)
    }
  }
  return key
}

function formatLogEntry(entry: LogEntry): string {
  const { timestamp, level, message, correlationId, context } = entry

  const prefix = `[${timestamp}] [${level.toUpperCase()}]`
  const corrId = correlationId ? ` [${correlationId}]` : ''

  if (context && Object.keys(context).length > 0) {
    return `${prefix}${corrId} ${message} ${JSON.stringify(context)}`
  }

  return `${prefix}${corrId} ${message}`
}

function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 10)
  return `${timestamp}-${random}`
}

class SecureLogger {
  private context: LogContext = {}
  private correlationId?: string
  private minLevel: LogLevel
  private environment: string
  private version: string

  constructor(options?: { minLevel?: LogLevel; context?: LogContext; correlationId?: string }) {
    this.minLevel = options?.minLevel ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
    this.context = options?.context ?? {}
    this.correlationId = options?.correlationId
    this.environment = process.env.NODE_ENV ?? 'development'
    this.version = process.env.APP_VERSION ?? '1.0.0'
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'fatal']
    return levels.indexOf(level) >= levels.indexOf(this.minLevel)
  }

  private createEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
    const mergedContext = { ...this.context, ...context }
    const sanitizedContext = sanitizeObject(mergedContext)

    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.correlationId,
      context: sanitizedContext,
      environment: this.environment,
      version: this.version,
    }
  }

  setContext(context: LogContext): void {
    this.context = { ...this.context, ...context }
  }

  clearContext(): void {
    this.context = {}
  }

  setCorrelationId(id: string): void {
    this.correlationId = id
  }

  getCorrelationId(): string | undefined {
    return this.correlationId
  }

  newCorrelationId(): string {
    this.correlationId = generateCorrelationId()
    return this.correlationId
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return
    const entry = this.createEntry('debug', message, context)
    console.log(formatLogEntry(entry))
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return
    const entry = this.createEntry('info', message, context)
    console.log(formatLogEntry(entry))
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return
    const entry = this.createEntry('warn', message, context)
    console.warn(formatLogEntry(entry))
  }

  error(message: string, context?: LogContext): void {
    if (!this.shouldLog('error')) return
    const entry = this.createEntry('error', message, context)
    console.error(formatLogEntry(entry))
  }

  fatal(message: string, context?: LogContext): void {
    if (!this.shouldLog('fatal')) return
    const entry = this.createEntry('fatal', message, context)
    console.error(formatLogEntry(entry))
  }

  security(eventType: string, context?: LogContext): void {
    const securityContext = {
      securityEvent: true,
      eventType,
      ...context,
    }
    this.warn(`[SECURITY] ${eventType}`, securityContext)
  }

  audit(action: string, context?: LogContext): void {
    const auditContext = {
      auditEvent: true,
      action,
      ...context,
    }
    this.info(`[AUDIT] ${action}`, auditContext)
  }

  child(options?: { context?: LogContext; correlationId?: string }): SecureLogger {
    return new SecureLogger({
      minLevel: this.minLevel,
      context: { ...this.context, ...options?.context },
      correlationId: options?.correlationId ?? this.correlationId,
    })
  }
}

let defaultLogger: SecureLogger | null = null

export function createSecureLogger(options?: {
  minLevel?: LogLevel
  context?: LogContext
  correlationId?: string
}): SecureLogger {
  return new SecureLogger(options)
}

export function getSecureLogger(): SecureLogger {
  if (!defaultLogger) {
    defaultLogger = new SecureLogger()
  }
  return defaultLogger
}

export function resetSecureLogger(): void {
  defaultLogger = null
}

export const secureLogger = new Proxy({} as SecureLogger, {
  get(_target, prop) {
    const logger = getSecureLogger()
    return logger[prop as keyof SecureLogger]
  },
})

export {
  SecureLogger,
  sanitizeObject,
  isSensitiveKey,
  MASK_VALUE,
  type LogLevel,
  type LogContext,
  type SanitizedLogContext,
  type LogEntry,
}
