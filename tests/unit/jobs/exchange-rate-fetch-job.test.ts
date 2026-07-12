import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { success, failure, type Result } from '@/types/result'
import type { ExchangeRate } from '@/services/currency/types'
import { fetchExchangeRates, startExchangeRateFetchJob } from '@/jobs/exchange-rate-fetch-job'

type FetchRates = (date: Date) => Promise<Result<ExchangeRate[], Error>>

// The SUT instantiates the provider at module top level
// (`const bojProvider = new BOJRateProvider()`), so the mock constructor runs at
// import time. vi.hoisted keeps the fetchRates stub reachable across vi.mock's
// hoist boundary (the SUT's top-level `new` fires during import, before normal
// consts initialize), and a real `function` expression (not an arrow) is mandatory
// so `new` succeeds under vitest 4. Mocking the provider whole means the real class
// — which imports @/lib/db / @prisma/client — never loads, so no DB mock is needed.
const { fetchRatesMock } = vi.hoisted(() => ({
  fetchRatesMock: vi.fn<FetchRates>(),
}))

vi.mock('@/services/currency/providers/boj-rate-provider', () => ({
  BOJRateProvider: vi.fn(function () {
    return { fetchRates: fetchRatesMock }
  }),
}))

const FIXED_NOW = new Date('2024-06-15T12:00:00.000Z')
// Mirror of the SUT's RETRY_DELAYS: [5min, 15min, 60min].
const RETRY_DELAYS_MS = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000]

function buildRate(over: Partial<ExchangeRate> = {}): ExchangeRate {
  return {
    id: 'rate-1',
    rateDate: new Date('2024-06-15T00:00:00.000Z'),
    fromCurrency: 'JPY',
    toCurrency: 'USD',
    rate: 150.25,
    source: 'BOJ',
    sourceUrl: null,
    confidence: 1,
    isOfficial: true,
    createdAt: new Date('2024-06-15T00:00:00.000Z'),
    updatedAt: new Date('2024-06-15T00:00:00.000Z'),
    ...over,
  }
}

describe('exchange-rate-fetch-job', () => {
  let consoleLogSpy: MockInstance
  let consoleErrorSpy: MockInstance

  beforeEach(() => {
    // Pin `new Date()` in the SUT and make setTimeout deterministic.
    vi.useFakeTimers({ now: FIXED_NOW })
    vi.clearAllTimers()
    fetchRatesMock.mockReset()

    consoleLogSpy = vi.spyOn(console, 'log')
    consoleErrorSpy = vi.spyOn(console, 'error')
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('startExchangeRateFetchJob', () => {
    it('logs the module-loaded notice and returns void', () => {
      const result = startExchangeRateFetchJob()

      expect(result).toBeUndefined()
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ExchangeRateJob] Job module loaded - use scheduler.ts to schedule'
      )
    })
  })

  describe('fetchExchangeRates — happy path', () => {
    it('fetches rates, logs success, notifies, and schedules no retry', async () => {
      const rates = [buildRate({ id: 'r1' }), buildRate({ id: 'r2', toCurrency: 'EUR' })]
      fetchRatesMock.mockResolvedValue(success(rates))

      await fetchExchangeRates()

      expect(fetchRatesMock).toHaveBeenCalledTimes(1)
      // The job always passes "today"; fake timers pin new Date() to FIXED_NOW.
      expect(fetchRatesMock).toHaveBeenCalledWith(FIXED_NOW)
      expect(consoleLogSpy).toHaveBeenCalledWith('[ExchangeRateJob] Starting daily fetch...')
      expect(consoleLogSpy).toHaveBeenCalledWith('[ExchangeRateJob] Success: 2 rates fetched')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ExchangeRateJob] Notification: 2 rates fetched successfully'
      )
      expect(vi.getTimerCount()).toBe(0)
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })
  })

  describe('fetchExchangeRates — edge cases', () => {
    it('treats a zero-rate success as success without retrying', async () => {
      fetchRatesMock.mockResolvedValue(success([]))

      await fetchExchangeRates()

      expect(fetchRatesMock).toHaveBeenCalledTimes(1)
      expect(consoleLogSpy).toHaveBeenCalledWith('[ExchangeRateJob] Success: 0 rates fetched')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ExchangeRateJob] Notification: 0 rates fetched successfully'
      )
      expect(vi.getTimerCount()).toBe(0)
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it('reports the exact count for a large batch', async () => {
      const many = Array.from({ length: 100 }, (_, i) =>
        buildRate({ id: `r${i}`, toCurrency: 'USD' })
      )
      fetchRatesMock.mockResolvedValue(success(many))

      await fetchExchangeRates()

      expect(consoleLogSpy).toHaveBeenCalledWith('[ExchangeRateJob] Success: 100 rates fetched')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ExchangeRateJob] Notification: 100 rates fetched successfully'
      )
      expect(vi.getTimerCount()).toBe(0)
    })
  })

  describe('fetchExchangeRates — retry / backoff', () => {
    it('on a single failure schedules exactly one retry and logs the first backoff', async () => {
      fetchRatesMock.mockResolvedValue(failure(new Error('BOJ HTTP 500')))

      await fetchExchangeRates()

      expect(fetchRatesMock).toHaveBeenCalledTimes(1)
      expect(fetchRatesMock).toHaveBeenCalledWith(FIXED_NOW)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ExchangeRateJob] Attempt 1 failed:',
        expect.any(Error)
      )
      expect(consoleLogSpy).toHaveBeenCalledWith('[ExchangeRateJob] Retrying in 300 seconds...')
      expect(vi.getTimerCount()).toBe(1)
    })

    it('does not fire the first retry before the 5-minute boundary', async () => {
      fetchRatesMock.mockResolvedValue(failure(new Error('BOJ HTTP 500')))

      await fetchExchangeRates()
      // 1ms short of the 5-minute delay: the retry must still be pending.
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0] - 1)
      expect(fetchRatesMock).toHaveBeenCalledTimes(1)
      expect(vi.getTimerCount()).toBe(1)

      // Crossing the boundary fires attempt 2.
      await vi.advanceTimersByTimeAsync(1)
      expect(fetchRatesMock).toHaveBeenCalledTimes(2)
    })

    it('recovers when a retry succeeds: stops retrying, logs success, and notifies', async () => {
      fetchRatesMock
        .mockResolvedValueOnce(failure(new Error('transient')))
        .mockResolvedValueOnce(success([buildRate()]))

      await fetchExchangeRates()
      expect(fetchRatesMock).toHaveBeenCalledTimes(1)
      expect(consoleLogSpy).toHaveBeenCalledWith('[ExchangeRateJob] Retrying in 300 seconds...')

      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0])
      expect(fetchRatesMock).toHaveBeenCalledTimes(2)
      expect(consoleLogSpy).toHaveBeenCalledWith('[ExchangeRateJob] Success: 1 rates fetched')
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[ExchangeRateJob] Notification: 1 rates fetched successfully'
      )
      expect(vi.getTimerCount()).toBe(0)
    })

    it('logs the escalating backoff schedule (300s -> 900s -> 3600s)', async () => {
      fetchRatesMock.mockResolvedValue(failure(new Error('BOJ down')))

      await fetchExchangeRates() // attempt 1 fails
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]) // attempt 2 fails
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]) // attempt 3 fails
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[2]) // attempt 4 fails

      const retryMessages = consoleLogSpy.mock.calls
        .map((c) => c[0])
        .filter((m): m is string => typeof m === 'string' && m.includes('Retrying in'))
      expect(retryMessages).toEqual([
        '[ExchangeRateJob] Retrying in 300 seconds...',
        '[ExchangeRateJob] Retrying in 900 seconds...',
        '[ExchangeRateJob] Retrying in 3600 seconds...',
      ])
    })
  })

  describe('fetchExchangeRates — fail-safe exhaustion', () => {
    it('bounds retries to the schedule (4 total fetches) and emits one failure notification', async () => {
      fetchRatesMock.mockResolvedValue(failure(new Error('BOJ unreachable')))

      await fetchExchangeRates() // attempt 0 -> schedules retry 0
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[0]) // attempt 1 -> retry 1
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[1]) // attempt 2 -> retry 2
      await vi.advanceTimersByTimeAsync(RETRY_DELAYS_MS[2]) // attempt 3 -> no retry

      // Initial attempt + 3 retries == 4 total; the loop does not run forever.
      expect(fetchRatesMock).toHaveBeenCalledTimes(4)
      expect(vi.getTimerCount()).toBe(0)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ExchangeRateJob] Notification: Fetch failed - BOJ unreachable'
      )
      const failureNotifs = consoleErrorSpy.mock.calls.filter((c) =>
        String(c[0]).includes('Fetch failed')
      )
      expect(failureNotifs).toHaveLength(1)
    })

    it('resolves (never throws or hangs) under the documented Result failure contract', async () => {
      fetchRatesMock.mockResolvedValue(failure(new Error('persistent failure')))

      await expect(fetchExchangeRates()).resolves.toBeUndefined()
      // A retry is pending, not an open-ended hang.
      expect(vi.getTimerCount()).toBe(1)
    })
  })

  describe('fetchExchangeRates — contract violation', () => {
    it('propagates an unexpected provider rejection rather than swallowing it', async () => {
      // The job has no try/catch around fetchRates: a provider that throws (instead
      // of returning a Result failure) surfaces as a rejected fetchExchangeRates.
      fetchRatesMock.mockRejectedValue(new Error('provider crashed'))

      await expect(fetchExchangeRates()).rejects.toThrow('provider crashed')
      expect(vi.getTimerCount()).toBe(0)
    })
  })
})
