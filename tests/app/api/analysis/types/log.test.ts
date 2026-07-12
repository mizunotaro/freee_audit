import { describe, it, expect } from 'vitest'
import type { LogEntry, LogContext, LogLevel } from '@/app/api/analysis/types/log'

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error']

const FIXED_TIMESTAMP = '2026-07-12T00:00:00.000Z'

describe('src/app/api/analysis/types/log', () => {
  describe('module resolution', () => {
    it('should be importable as an ESM module', async () => {
      const mod = await import('@/app/api/analysis/types/log')
      expect(mod).toBeDefined()
      expect(typeof mod).toBe('object')
    })
  })

  describe('LogLevel', () => {
    it('should expose exactly the four severity members at runtime', () => {
      expect(LOG_LEVELS).toHaveLength(4)
      expect(new Set(LOG_LEVELS).size).toBe(4)
      expect(LOG_LEVELS).toEqual(['debug', 'info', 'warn', 'error'])
    })

    it('should type the alias as exactly those four literals', () => {
      expectTypeOf<LogLevel>().toEqualTypeOf<'debug' | 'info' | 'warn' | 'error'>()
    })

    it('should be a closed union — an arbitrary string is not assignable to LogLevel', () => {
      expectTypeOf<string>().not.toMatchTypeOf<LogLevel>()
      expectTypeOf<'trace' | 'fatal'>().not.toMatchTypeOf<LogLevel>()
    })
  })

  describe('LogContext', () => {
    it('should construct a fully-populated context at runtime', () => {
      const ctx: LogContext = {
        requestId: 'req-1',
        module: 'analysis-engine',
        version: '1.2.3',
        userId: 'user-1',
        companyId: 'company-1',
        durationMs: 42,
        cached: true,
      }

      expect(ctx.requestId).toBe('req-1')
      expect(ctx.module).toBe('analysis-engine')
      expect(ctx.version).toBe('1.2.3')
      expect(ctx.userId).toBe('user-1')
      expect(ctx.companyId).toBe('company-1')
      expect(ctx.durationMs).toBe(42)
      expect(ctx.cached).toBe(true)
    })

    it('should serialize to exactly the expected key set when fully populated', () => {
      const ctx: LogContext = {
        requestId: 'req-1',
        module: 'analysis-engine',
        version: '1.2.3',
        userId: 'user-1',
        companyId: 'company-1',
        durationMs: 42,
        cached: true,
      }

      expect(Object.keys(ctx).sort()).toEqual([
        'cached',
        'companyId',
        'durationMs',
        'module',
        'requestId',
        'userId',
        'version',
      ])
    })

    it('should be minimal-constructible with only the required triplet', () => {
      const ctx: LogContext = {
        requestId: 'req-2',
        module: 'm',
        version: '0',
      }

      expect(ctx.userId).toBeUndefined()
      expect(ctx.companyId).toBeUndefined()
      expect(ctx.durationMs).toBeUndefined()
      expect(ctx.cached).toBeUndefined()
      expect(Object.keys(ctx)).toHaveLength(3)
    })

    it('should type requestId, module and version as required and the rest as optional', () => {
      expectTypeOf<LogContext['requestId']>().toEqualTypeOf<string>()
      expectTypeOf<LogContext['module']>().toEqualTypeOf<string>()
      expectTypeOf<LogContext['version']>().toEqualTypeOf<string>()
      expectTypeOf<LogContext['userId']>().toEqualTypeOf<string | undefined>()
      expectTypeOf<LogContext['companyId']>().toEqualTypeOf<string | undefined>()
      expectTypeOf<LogContext['durationMs']>().toEqualTypeOf<number | undefined>()
      expectTypeOf<LogContext['cached']>().toEqualTypeOf<boolean | undefined>()
    })

    it('should accept empty strings for the required string fields as a boundary input', () => {
      const ctx: LogContext = {
        requestId: '',
        module: '',
        version: '',
      }

      expect(ctx.requestId).toBe('')
      expect(ctx.module).toBe('')
      expect(ctx.version).toBe('')
    })

    it('should accept boundary values for durationMs', () => {
      const zero: LogContext = { requestId: 'r', module: 'm', version: 'v', durationMs: 0 }
      const negative: LogContext = {
        requestId: 'r',
        module: 'm',
        version: 'v',
        durationMs: -1,
      }
      const max: LogContext = {
        requestId: 'r',
        module: 'm',
        version: 'v',
        durationMs: Number.MAX_SAFE_INTEGER,
      }

      expect(zero.durationMs).toBe(0)
      expect(negative.durationMs).toBe(-1)
      expect(max.durationMs).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('should accept both cached polarities', () => {
      const hit: LogContext = {
        requestId: 'r',
        module: 'm',
        version: 'v',
        cached: true,
      }
      const miss: LogContext = {
        requestId: 'r',
        module: 'm',
        version: 'v',
        cached: false,
      }

      expect(hit.cached).toBe(true)
      expect(miss.cached).toBe(false)
    })

    it('should accept arbitrary extra keys via the index signature at runtime', () => {
      const ctx: LogContext = {
        requestId: 'r',
        module: 'm',
        version: 'v',
        traceId: 'trace-9',
        featureFlags: ['a', 'b'],
        retryCount: 3,
      }

      expect((ctx as Record<string, unknown>).traceId).toBe('trace-9')
      expect((ctx as Record<string, unknown>).featureFlags).toEqual(['a', 'b'])
      expect((ctx as Record<string, unknown>).retryCount).toBe(3)
    })

    it('should type arbitrary extra keys as unknown (no accidental any)', () => {
      expectTypeOf<LogContext['traceId']>().toEqualTypeOf<unknown>()
      expectTypeOf<LogContext['arbitraryExtension']>().toEqualTypeOf<unknown>()
    })

    it('should fail-safe at compile time: a context missing requestId does not satisfy LogContext', () => {
      type NoRequestId = { module: string; version: string }
      expectTypeOf<NoRequestId>().not.toMatchTypeOf<LogContext>()
    })

    it('should fail-safe at compile time: a context missing module and version does not satisfy LogContext', () => {
      type OnlyRequest = { requestId: string }
      expectTypeOf<OnlyRequest>().not.toMatchTypeOf<LogContext>()
    })
  })

  describe('LogEntry', () => {
    const baseContext: LogContext = {
      requestId: 'req-1',
      module: 'analysis-engine',
      version: '1.2.3',
    }

    it('should construct a fully-populated entry at runtime', () => {
      const entry: LogEntry = {
        timestamp: FIXED_TIMESTAMP,
        level: 'info',
        message: 'Analysis completed',
        context: baseContext,
      }

      expect(entry.timestamp).toBe(FIXED_TIMESTAMP)
      expect(entry.level).toBe('info')
      expect(entry.message).toBe('Analysis completed')
      expect(entry.context).toEqual(baseContext)
    })

    it('should serialize to exactly the expected key set when fully populated', () => {
      const entry: LogEntry = {
        timestamp: FIXED_TIMESTAMP,
        level: 'warn',
        message: 'Slow query',
        context: baseContext,
      }

      expect(Object.keys(entry).sort()).toEqual(['context', 'level', 'message', 'timestamp'])
    })

    it('should type every field as required and non-optional', () => {
      expectTypeOf<LogEntry['timestamp']>().toEqualTypeOf<string>()
      expectTypeOf<LogEntry['level']>().toEqualTypeOf<LogLevel>()
      expectTypeOf<LogEntry['message']>().toEqualTypeOf<string>()
      expectTypeOf<LogEntry['context']>().toEqualTypeOf<LogContext>()
    })

    it('should align the level union with LogLevel exactly', () => {
      expectTypeOf<LogEntry['level']>().toEqualTypeOf<'debug' | 'info' | 'warn' | 'error'>()
      expectTypeOf<LogEntry['level']>().toEqualTypeOf<LogLevel>()
    })

    it('should accept every LogLevel value for the level field', () => {
      for (const level of LOG_LEVELS) {
        const entry: LogEntry = {
          timestamp: FIXED_TIMESTAMP,
          level,
          message: `level=${level}`,
          context: baseContext,
        }
        expect(LOG_LEVELS).toContain(entry.level)
      }
    })

    it('should accept an empty message as a boundary input', () => {
      const entry: LogEntry = {
        timestamp: FIXED_TIMESTAMP,
        level: 'debug',
        message: '',
        context: baseContext,
      }

      expect(entry.message).toBe('')
    })

    it('should carry the nested context shape faithfully', () => {
      const ctx: LogContext = {
        requestId: 'req-2',
        module: 'audit',
        version: '2.0.0',
        userId: 'u-2',
        durationMs: 7,
        cached: false,
        traceId: 't-2',
      }
      const entry: LogEntry = {
        timestamp: FIXED_TIMESTAMP,
        level: 'error',
        message: 'Audit failed',
        context: ctx,
      }

      expect(entry.context.requestId).toBe('req-2')
      expect(entry.context.userId).toBe('u-2')
      expect(entry.context.durationMs).toBe(7)
      expect(entry.context.cached).toBe(false)
      expect((entry.context as Record<string, unknown>).traceId).toBe('t-2')
    })

    it('should fail-safe at compile time: an out-of-union level does not satisfy LogEntry', () => {
      type FatalLevel = {
        timestamp: string
        level: 'fatal'
        message: string
        context: LogContext
      }
      expectTypeOf<FatalLevel>().not.toMatchTypeOf<LogEntry>()
    })

    it('should fail-safe at compile time: a payload missing context does not satisfy LogEntry', () => {
      type NoContext = { timestamp: string; level: LogLevel; message: string }
      expectTypeOf<NoContext>().not.toMatchTypeOf<LogEntry>()
    })

    it('should enforce immutability: readonly fields cannot be reassigned', () => {
      const entry: LogEntry = {
        timestamp: FIXED_TIMESTAMP,
        level: 'info',
        message: 'm',
        context: baseContext,
      }

      const tryMutate = () => {
        // @ts-expect-error LogEntry.timestamp is readonly (TS2540)
        entry.timestamp = '2025-01-01T00:00:00.000Z'
        // @ts-expect-error LogEntry.level is readonly (TS2540)
        entry.level = 'warn'
        // @ts-expect-error LogEntry.message is readonly (TS2540)
        entry.message = 'mutated'
        // @ts-expect-error LogEntry.context is readonly (TS2540)
        entry.context = baseContext
      }

      expect(typeof tryMutate).toBe('function')
      expect(entry.level).toBe('info')
      expect(entry.message).toBe('m')
      expect(entry.timestamp).toBe(FIXED_TIMESTAMP)
    })
  })
})
