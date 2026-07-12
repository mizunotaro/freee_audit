import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AnalysisLogger } from '@/app/api/analysis/utils/logger'
import type { LogContext } from '@/app/api/analysis/types/log'

const BASE_CONTEXT: LogContext = {
  requestId: 'req-123',
  module: 'financial-analyzer',
  version: '1.0.0',
}

const FIXED_TIME = new Date('2024-01-15T10:30:00.000Z')

describe('AnalysisLogger', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_TIME)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('info', () => {
    it('routes to console.log with level info and merged context', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)

      logger.info('analysis completed', { durationMs: 1500, cached: true })

      expect(logSpy).toHaveBeenCalledTimes(1)
      const entry = JSON.parse(logSpy.mock.calls[0][0])
      expect(entry).toMatchObject({
        timestamp: '2024-01-15T10:30:00.000Z',
        level: 'info',
        message: 'analysis completed',
      })
      expect(entry.context).toMatchObject({
        requestId: 'req-123',
        module: 'financial-analyzer',
        version: '1.0.0',
        durationMs: 1500,
        cached: true,
      })
      expect(warnSpy).not.toHaveBeenCalled()
      expect(errSpy).not.toHaveBeenCalled()
    })

    it('logs with only a message when data is omitted', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)

      logger.info('started')

      const entry = JSON.parse(spy.mock.calls[0][0])
      expect(entry.message).toBe('started')
      expect(entry.context.requestId).toBe('req-123')
      expect(Object.keys(entry.context).sort()).toEqual(['module', 'requestId', 'version'])
    })

    it('accepts an empty data object', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)

      logger.info('noop', {})

      const entry = JSON.parse(spy.mock.calls[0][0])
      expect(entry.message).toBe('noop')
      expect(entry.context).toMatchObject(BASE_CONTEXT)
    })
  })

  describe('debug', () => {
    it('routes to console.log with level debug and never warn/error', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)

      logger.debug('trace', { step: 1 })

      expect(logSpy).toHaveBeenCalledTimes(1)
      const entry = JSON.parse(logSpy.mock.calls[0][0])
      expect(entry.level).toBe('debug')
      expect(entry.message).toBe('trace')
      expect(entry.context.step).toBe(1)
      expect(warnSpy).not.toHaveBeenCalled()
      expect(errSpy).not.toHaveBeenCalled()
    })
  })

  describe('warn', () => {
    it('routes to console.warn (not log/error) with level warn', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)

      logger.warn('slow query', { durationMs: 5000 })

      expect(warnSpy).toHaveBeenCalledTimes(1)
      const entry = JSON.parse(warnSpy.mock.calls[0][0])
      expect(entry.level).toBe('warn')
      expect(entry.context.durationMs).toBe(5000)
      expect(logSpy).not.toHaveBeenCalled()
      expect(errSpy).not.toHaveBeenCalled()
    })
  })

  describe('error', () => {
    it('routes to console.error with level error and attaches errorMessage/errorStack', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)

      logger.error('analysis failed', new Error('upstream timeout'), { attempt: 3 })

      expect(errSpy).toHaveBeenCalledTimes(1)
      const entry = JSON.parse(errSpy.mock.calls[0][0])
      expect(entry.level).toBe('error')
      expect(entry.message).toBe('analysis failed')
      expect(entry.context.errorMessage).toBe('upstream timeout')
      expect(typeof entry.context.errorStack).toBe('string')
      expect(entry.context.errorStack).toContain('upstream timeout')
      expect(entry.context.attempt).toBe(3)
      expect(logSpy).not.toHaveBeenCalled()
      expect(warnSpy).not.toHaveBeenCalled()
    })

    it('works without additional data', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)

      logger.error('boom', new Error('boom'))

      const entry = JSON.parse(errSpy.mock.calls[0][0])
      expect(entry.context.errorMessage).toBe('boom')
      expect(typeof entry.context.errorStack).toBe('string')
    })

    it('degrades safely when the error has no stack', () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)
      const stackless = new Error('no stack here')
      delete stackless.stack

      expect(() => logger.error('failed', stackless)).not.toThrow()

      const entry = JSON.parse(errSpy.mock.calls[0][0])
      expect(entry.context.errorMessage).toBe('no stack here')
      expect(entry.context.errorStack).toBeUndefined()
    })
  })

  describe('sanitization (fail-safe)', () => {
    it('redacts sensitive data so secrets never reach the log output', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)

      logger.info('login attempt', {
        username: 'taro',
        password: 'super-secret-123',
        apiKey: 'sk-live-9876543210',
        token: 'bearer-abc',
      })

      const raw = spy.mock.calls[0][0]
      expect(raw).not.toContain('super-secret-123')
      expect(raw).not.toContain('sk-live-9876543210')
      expect(raw).not.toContain('bearer-abc')
      const entry = JSON.parse(raw)
      expect(entry.context.password).toBe('[REDACTED]')
      expect(entry.context.apiKey).toBe('[REDACTED]')
      expect(entry.context.token).toBe('[REDACTED]')
      expect(entry.context.username).toBe('taro')
    })

    it('redacts sensitive keys nested inside objects', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)

      logger.info('config', { provider: { apiKey: 'nested-secret' } })

      const raw = spy.mock.calls[0][0]
      expect(raw).not.toContain('nested-secret')
      const entry = JSON.parse(raw)
      expect(entry.context.provider.apiKey).toBe('[REDACTED]')
    })

    it('does not throw on circular references and avoids infinite recursion', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)
      const circular: Record<string, unknown> = { name: 'loop' }
      circular.self = circular

      expect(() => logger.info('cycle', { payload: circular })).not.toThrow()

      expect(spy).toHaveBeenCalledTimes(1)
    })
  })

  describe('timestamp', () => {
    it('emits a valid ISO 8601 timestamp for the current time', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)

      logger.info('tick')

      const entry = JSON.parse(spy.mock.calls[0][0])
      expect(entry.timestamp).toBe('2024-01-15T10:30:00.000Z')
      expect(new Date(entry.timestamp).toISOString()).toBe(entry.timestamp)
    })
  })

  describe('output formatting by NODE_ENV', () => {
    const env = process.env as Record<string, string | undefined>
    let originalNodeEnv: string | undefined

    beforeEach(() => {
      originalNodeEnv = env.NODE_ENV
    })

    afterEach(() => {
      env.NODE_ENV = originalNodeEnv
    })

    it('pretty-prints with indentation when NODE_ENV is development', () => {
      env.NODE_ENV = 'development'
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)

      logger.info('pretty', { ok: true })

      const raw = spy.mock.calls[0][0]
      expect(raw).toContain('\n')
      expect(raw).toContain('  "level": "info"')
    })

    it('compacts to a single line when NODE_ENV is not development', () => {
      env.NODE_ENV = 'production'
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)

      logger.info('compact', { ok: true })

      const raw = spy.mock.calls[0][0]
      expect(raw).not.toContain('\n')
      expect(raw.startsWith('{')).toBe(true)
    })
  })

  describe('withContext', () => {
    it('returns a new AnalysisLogger instance', () => {
      const logger = new AnalysisLogger(BASE_CONTEXT)
      const child = logger.withContext({ userId: 'u-1' })

      expect(child).toBeInstanceOf(AnalysisLogger)
      expect(child).not.toBe(logger)
    })

    it('merges additional context onto the base context', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)
      const child = logger.withContext({ userId: 'u-9', companyId: 'c-2' })

      child.info('child event')

      const entry = JSON.parse(spy.mock.calls[0][0])
      expect(entry.context).toMatchObject({
        requestId: 'req-123',
        module: 'financial-analyzer',
        version: '1.0.0',
        userId: 'u-9',
        companyId: 'c-2',
      })
    })

    it('additional context overrides base context for overlapping keys', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)
      const child = logger.withContext({ module: 'override-module' })

      child.info('overridden')

      const entry = JSON.parse(spy.mock.calls[0][0])
      expect(entry.context.module).toBe('override-module')
      expect(entry.context.requestId).toBe('req-123')
    })

    it('does not mutate the original logger', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)
      logger.withContext({ userId: 'u-9' })

      logger.info('parent event')

      const entry = JSON.parse(spy.mock.calls[0][0])
      expect(entry.context.userId).toBeUndefined()
      expect(entry.context.requestId).toBe('req-123')
    })

    it('child of a child accumulates context across the chain', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const logger = new AnalysisLogger(BASE_CONTEXT)
      const first = logger.withContext({ userId: 'u-1' })
      const second = first.withContext({ companyId: 'c-9' })

      second.info('deep')

      const entry = JSON.parse(spy.mock.calls[0][0])
      expect(entry.context).toMatchObject({
        requestId: 'req-123',
        userId: 'u-1',
        companyId: 'c-9',
      })
    })
  })
})
