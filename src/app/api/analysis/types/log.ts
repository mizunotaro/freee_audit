export interface LogEntry {
  readonly timestamp: string
  readonly level: 'debug' | 'info' | 'warn' | 'error'
  readonly message: string
  readonly context: LogContext
}

export interface LogContext {
  readonly requestId: string
  readonly module: string
  readonly version: string
  readonly userId?: string
  readonly companyId?: string
  readonly durationMs?: number
  readonly cached?: boolean
  readonly [key: string]: unknown
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
