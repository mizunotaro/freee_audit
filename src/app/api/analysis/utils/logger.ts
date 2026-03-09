import type { LogEntry, LogContext, LogLevel } from '../types/log'
import { sanitizeForLog } from './sanitizer'

/**
 * 分析API専用ロガー
 *
 * 統一されたログフォーマットでログ出力を行う
 *
 * @example
 * ```typescript
 * const logger = new AnalysisLogger({
 *   requestId: 'req-123',
 *   module: 'financial-analyzer',
 *   version: '1.0.0'
 * })
 *
 * logger.info('Analysis completed', { durationMs: 1500 })
 * logger.error('Analysis failed', new Error('...'), { attempt: 3 })
 * ```
 */
export class AnalysisLogger {
  constructor(private readonly context: LogContext) {}

  debug(message: string, data?: Record<string, unknown>): void {
    this.log('debug', message, data)
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.log('info', message, data)
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.log('warn', message, data)
  }

  error(message: string, error: Error, data?: Record<string, unknown>): void {
    this.log('error', message, {
      ...data,
      errorMessage: error.message,
      errorStack: error.stack,
    })
  }

  private log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    const sanitizedData = data ? sanitizeForLog(data) : undefined

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...this.context,
        ...sanitizedData,
      },
    }

    const output = JSON.stringify(entry, null, process.env.NODE_ENV === 'development' ? 2 : 0)

    switch (level) {
      case 'error':
        console.error(output)
        break
      case 'warn':
        console.warn(output)
        break
      default:
        console.log(output)
    }
  }

  withContext(additionalContext: Partial<LogContext>): AnalysisLogger {
    return new AnalysisLogger({
      ...this.context,
      ...additionalContext,
    })
  }
}
