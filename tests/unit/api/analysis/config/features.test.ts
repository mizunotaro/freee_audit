import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getFeatureFlags, type FeatureFlags } from '@/app/api/analysis/config/features'

describe('analysis feature flags (src/app/api/analysis/config/features.ts)', () => {
  const ENV_KEYS = [
    'ANALYSIS_CACHE_ENABLED',
    'ANALYSIS_RATE_LIMIT_ENABLED',
    'ANALYSIS_DEBUG',
    'ANALYSIS_BENCHMARK_ENABLED',
    'ANALYSIS_CIRCUIT_BREAKER',
    'NODE_ENV',
  ] as const

  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    for (const key of ENV_KEYS) delete process.env[key]
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getFeatureFlags — shape & defaults', () => {
    it('returns an object exposing exactly the five flag keys', () => {
      const flags = getFeatureFlags()
      expect(Object.keys(flags).sort()).toEqual([
        'enableBenchmarkComparison',
        'enableCaching',
        'enableCircuitBreaker',
        'enableDetailedLogging',
        'enableRateLimit',
      ])
    })

    it('returns a boolean for every flag', () => {
      const flags = getFeatureFlags()
      for (const value of Object.values(flags)) {
        expect(typeof value).toBe('boolean')
      }
    })

    it('defaults to the safe baseline when no env vars are set', () => {
      expect(getFeatureFlags()).toEqual({
        enableCaching: true,
        enableRateLimit: true,
        enableDetailedLogging: false,
        enableBenchmarkComparison: true,
        enableCircuitBreaker: true,
      })
    })

    it('honors explicit enablement for every flag', () => {
      process.env.ANALYSIS_CACHE_ENABLED = 'true'
      process.env.ANALYSIS_RATE_LIMIT_ENABLED = 'true'
      process.env.ANALYSIS_DEBUG = 'true'
      process.env.ANALYSIS_BENCHMARK_ENABLED = 'true'
      process.env.ANALYSIS_CIRCUIT_BREAKER = 'true'

      expect(getFeatureFlags()).toEqual({
        enableCaching: true,
        enableRateLimit: true,
        enableDetailedLogging: true,
        enableBenchmarkComparison: true,
        enableCircuitBreaker: true,
      })
    })

    it('satisfies the public FeatureFlags type contract (type-level)', () => {
      const flags = getFeatureFlags()
      expectTypeOf(flags).toMatchTypeOf<FeatureFlags>()
      expectTypeOf<FeatureFlags['enableCaching']>().toEqualTypeOf<boolean>()
      expectTypeOf<FeatureFlags['enableDetailedLogging']>().toEqualTypeOf<boolean>()
    })
  })

  describe.each([
    { flag: 'enableCaching', envKey: 'ANALYSIS_CACHE_ENABLED' },
    { flag: 'enableRateLimit', envKey: 'ANALYSIS_RATE_LIMIT_ENABLED' },
    { flag: 'enableBenchmarkComparison', envKey: 'ANALYSIS_BENCHMARK_ENABLED' },
    { flag: 'enableCircuitBreaker', envKey: 'ANALYSIS_CIRCUIT_BREAKER' },
  ])(
    'opt-out flag $flag ($envKey !== "false")',
    ({ flag, envKey }: { flag: string; envKey: string }) => {
      const flagKey = flag as keyof FeatureFlags
      it.each([
        ['unset', undefined, true],
        ['"true"', 'true', true],
        ['"false"', 'false', false],
        ['empty string', '', true],
        ['"FALSE" (wrong case)', 'FALSE', true],
        ['"0"', '0', true],
        ['"no"', 'no', true],
        ['"off"', 'off', true],
        ['"disabled"', 'disabled', true],
      ])('is %s → %j (env=%j)', (_label, value, expected) => {
        if (value === undefined) delete process.env[envKey]
        else process.env[envKey] = value as string

        expect(getFeatureFlags()[flagKey]).toBe(expected)
      })

      it('fail-safe: only the exact sentinel "false" disables; any other value keeps it ON', () => {
        process.env[envKey] = 'false'
        expect(getFeatureFlags()[flagKey]).toBe(false)
        process.env[envKey] = 'false '
        expect(getFeatureFlags()[flagKey]).toBe(true)
        process.env[envKey] = 'False'
        expect(getFeatureFlags()[flagKey]).toBe(true)
      })
    }
  )

  describe('opt-in flag enableDetailedLogging (ANALYSIS_DEBUG === "true")', () => {
    it.each([
      ['unset', undefined, false],
      ['"true"', 'true', true],
      ['"false"', 'false', false],
      ['empty string', '', false],
      ['"TRUE" (wrong case)', 'TRUE', false],
      ['"1"', '1', false],
      ['"yes"', 'yes', false],
      ['"on"', 'on', false],
      ['"debug"', 'debug', false],
    ])('is %s → %j (env=%j)', (_label, value, expected) => {
      if (value === undefined) delete process.env.ANALYSIS_DEBUG
      else process.env.ANALYSIS_DEBUG = value as string

      expect(getFeatureFlags().enableDetailedLogging).toBe(expected)
    })

    it('fail-safe: only the exact sentinel "true" enables; any other value stays OFF', () => {
      process.env.ANALYSIS_DEBUG = 'true'
      expect(getFeatureFlags().enableDetailedLogging).toBe(true)
      process.env.ANALYSIS_DEBUG = ' true'
      expect(getFeatureFlags().enableDetailedLogging).toBe(false)
      process.env.ANALYSIS_DEBUG = 'True'
      expect(getFeatureFlags().enableDetailedLogging).toBe(false)
    })

    it('stays OFF under NODE_ENV=development unless ANALYSIS_DEBUG="true" (DEFAULT value is shadowed)', () => {
      ;(process.env as { NODE_ENV: string }).NODE_ENV = 'development'
      expect(getFeatureFlags().enableDetailedLogging).toBe(false)

      process.env.ANALYSIS_DEBUG = 'true'
      expect(getFeatureFlags().enableDetailedLogging).toBe(true)
    })
  })

  describe('isolation & degradation to a safe state', () => {
    it('each call returns a fresh object (no shared mutable singleton)', () => {
      const a = getFeatureFlags()
      const b = getFeatureFlags()

      expect(a).not.toBe(b)
      expect(a).toEqual(b)
    })

    it('mutating one result does not leak into subsequent calls', () => {
      const a = getFeatureFlags()
      ;(a as { enableCaching: boolean }).enableCaching = false

      expect(getFeatureFlags().enableCaching).toBe(true)
    })

    it('setting one env var never flips unrelated flags', () => {
      process.env.ANALYSIS_CACHE_ENABLED = 'false'

      const flags = getFeatureFlags()
      expect(flags.enableCaching).toBe(false)
      expect(flags.enableRateLimit).toBe(true)
      expect(flags.enableBenchmarkComparison).toBe(true)
      expect(flags.enableCircuitBreaker).toBe(true)
      expect(flags.enableDetailedLogging).toBe(false)
    })

    it('disabling every opt-out flag simultaneously yields the all-off baseline', () => {
      process.env.ANALYSIS_CACHE_ENABLED = 'false'
      process.env.ANALYSIS_RATE_LIMIT_ENABLED = 'false'
      process.env.ANALYSIS_BENCHMARK_ENABLED = 'false'
      process.env.ANALYSIS_CIRCUIT_BREAKER = 'false'

      expect(getFeatureFlags()).toEqual({
        enableCaching: false,
        enableRateLimit: false,
        enableDetailedLogging: false,
        enableBenchmarkComparison: false,
        enableCircuitBreaker: false,
      })
    })

    it('never throws for arbitrary env var string values (no error path)', () => {
      process.env.ANALYSIS_CACHE_ENABLED = 'false'
      process.env.ANALYSIS_RATE_LIMIT_ENABLED = 'true'
      process.env.ANALYSIS_DEBUG = 'true'
      process.env.ANALYSIS_BENCHMARK_ENABLED = 'whatever'
      process.env.ANALYSIS_CIRCUIT_BREAKER = ''

      expect(() => getFeatureFlags()).not.toThrow()
    })
  })
})
