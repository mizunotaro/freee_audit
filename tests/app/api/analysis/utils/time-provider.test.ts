import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  type TimeProvider,
  SystemTimeProvider,
  MockTimeProvider,
  getTimeProvider,
  setTimeProvider,
  resetTimeProvider,
} from '@/app/api/analysis/utils/time-provider'

const FIXED_DATE = new Date('2024-01-15T12:00:00.000Z')

describe('time-provider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_DATE)
  })

  afterEach(() => {
    resetTimeProvider()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('SystemTimeProvider', () => {
    it('returns a Date equal to the current system time', () => {
      const provider: TimeProvider = new SystemTimeProvider()

      expect(provider.now()).toBeInstanceOf(Date)
      expect(provider.now()).toEqual(FIXED_DATE)
    })

    it('returns an ISO-8601 timestamp string for the current system time', () => {
      const provider = new SystemTimeProvider()

      expect(provider.timestamp()).toBe('2024-01-15T12:00:00.000Z')
    })

    it('produces a timestamp that round-trips to the same epoch millisecond', () => {
      const provider = new SystemTimeProvider()

      expect(new Date(provider.timestamp()).getTime()).toBe(FIXED_DATE.getTime())
    })

    it('emits a timestamp matching the canonical ISO-8601 shape', () => {
      const provider = new SystemTimeProvider()

      expect(provider.timestamp()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)
    })

    it('reflects an advancing system clock', () => {
      const provider = new SystemTimeProvider()
      const later = new Date('2024-06-01T00:00:00.000Z')

      vi.setSystemTime(later)

      expect(provider.now()).toEqual(later)
      expect(provider.timestamp()).toBe('2024-06-01T00:00:00.000Z')
    })

    it('returns a fresh Date whose value stays frozen while the fake clock is frozen', () => {
      const provider = new SystemTimeProvider()

      const a = provider.now()
      const b = provider.now()

      expect(a).toEqual(b)
    })
  })

  describe('MockTimeProvider', () => {
    it('now() returns a Date equal to the fixed construction time', () => {
      const provider: TimeProvider = new MockTimeProvider(FIXED_DATE)

      expect(provider.now()).toBeInstanceOf(Date)
      expect(provider.now()).toEqual(FIXED_DATE)
    })

    it('timestamp() returns the ISO-8601 string of the fixed time', () => {
      const provider = new MockTimeProvider(FIXED_DATE)

      expect(provider.timestamp()).toBe('2024-01-15T12:00:00.000Z')
    })

    it('stays pinned to the fixed time regardless of the real system clock', () => {
      const provider = new MockTimeProvider(FIXED_DATE)

      vi.setSystemTime(new Date('2030-12-31T23:59:59.000Z'))

      expect(provider.now()).toEqual(FIXED_DATE)
      expect(provider.timestamp()).toBe('2024-01-15T12:00:00.000Z')
    })

    it('advance(0) leaves the time value unchanged', () => {
      const provider = new MockTimeProvider(FIXED_DATE)

      provider.advance(0)

      expect(provider.now()).toEqual(FIXED_DATE)
      expect(provider.timestamp()).toBe('2024-01-15T12:00:00.000Z')
    })

    it('advance(positive ms) moves the clock forward and updates timestamp()', () => {
      const provider = new MockTimeProvider(FIXED_DATE)

      provider.advance(60_000)

      expect(provider.now()).toEqual(new Date('2024-01-15T12:01:00.000Z'))
      expect(provider.timestamp()).toBe('2024-01-15T12:01:00.000Z')
    })

    it('advance(negative ms) moves the clock backward', () => {
      const provider = new MockTimeProvider(FIXED_DATE)

      provider.advance(-3_600_000)

      expect(provider.now()).toEqual(new Date('2024-01-15T11:00:00.000Z'))
    })

    it('accumulates multiple advance() calls', () => {
      const provider = new MockTimeProvider(FIXED_DATE)

      provider.advance(1_000)
      provider.advance(2_000)
      provider.advance(3_000)

      expect(provider.now()).toEqual(new Date(FIXED_DATE.getTime() + 6_000))
    })

    it('advance() returns no value', () => {
      const provider = new MockTimeProvider(FIXED_DATE)

      expect(provider.advance(1_000)).toBeUndefined()
    })

    it('shares the stored reference across now() calls until advance() replaces it', () => {
      const provider = new MockTimeProvider(FIXED_DATE)
      const first = provider.now()

      expect(provider.now()).toBe(first)

      provider.advance(1_000)

      expect(provider.now()).not.toBe(first)
      expect(provider.now()).toEqual(new Date(FIXED_DATE.getTime() + 1_000))
    })
  })

  describe('global provider management', () => {
    it('getTimeProvider() defaults to a SystemTimeProvider', () => {
      expect(getTimeProvider()).toBeInstanceOf(SystemTimeProvider)
    })

    it('the default provider reads the system clock', () => {
      expect(getTimeProvider().now()).toEqual(FIXED_DATE)
      expect(getTimeProvider().timestamp()).toBe('2024-01-15T12:00:00.000Z')
    })

    it('setTimeProvider() installs the given provider as the global singleton', () => {
      const mock = new MockTimeProvider(FIXED_DATE)

      setTimeProvider(mock)

      expect(getTimeProvider()).toBe(mock)
      expect(getTimeProvider().timestamp()).toBe('2024-01-15T12:00:00.000Z')
    })

    it('accepts any duck-typed object satisfying the TimeProvider contract', () => {
      const custom: TimeProvider = {
        now: () => FIXED_DATE,
        timestamp: () => 'custom-ts',
      }

      setTimeProvider(custom)

      expect(getTimeProvider()).toBe(custom)
      expect(getTimeProvider().now()).toEqual(FIXED_DATE)
      expect(getTimeProvider().timestamp()).toBe('custom-ts')
    })

    it('resetTimeProvider() restores a fresh SystemTimeProvider', () => {
      const mock = new MockTimeProvider(FIXED_DATE)
      setTimeProvider(mock)

      resetTimeProvider()

      const current = getTimeProvider()
      expect(current).not.toBe(mock)
      expect(current).toBeInstanceOf(SystemTimeProvider)
      expect(current.now()).toEqual(FIXED_DATE)
    })

    it('resetTimeProvider() returns no value', () => {
      expect(resetTimeProvider()).toBeUndefined()
    })

    it('setTimeProvider() returns no value', () => {
      expect(setTimeProvider(new MockTimeProvider(FIXED_DATE))).toBeUndefined()
    })
  })

  describe('fail-safe / error behavior', () => {
    it('SystemTimeProvider never throws on repeated calls', () => {
      const provider = new SystemTimeProvider()

      expect(() => provider.now()).not.toThrow()
      expect(() => provider.timestamp()).not.toThrow()
      expect(() => {
        provider.now()
        provider.timestamp()
        provider.now()
      }).not.toThrow()
    })

    it('MockTimeProvider.now() returns the invalid Date (getTime NaN) without throwing', () => {
      const provider = new MockTimeProvider(new Date(NaN))

      expect(provider.now()).toBeInstanceOf(Date)
      expect(provider.now().getTime()).toBeNaN()
    })

    it('MockTimeProvider.timestamp() propagates the RangeError for an invalid date rather than degrading silently', () => {
      const provider = new MockTimeProvider(new Date(NaN))

      expect(() => provider.timestamp()).toThrow(RangeError)
    })

    it('global accessor functions do not throw for valid providers', () => {
      expect(() => getTimeProvider()).not.toThrow()
      expect(() => setTimeProvider(new MockTimeProvider(FIXED_DATE))).not.toThrow()
      expect(() => resetTimeProvider()).not.toThrow()
    })
  })
})
