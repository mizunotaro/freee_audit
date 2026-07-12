import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest'
import { differenceInCalendarDays } from 'date-fns'

interface CapturedJob {
  schedule: string
  cb: () => void | Promise<void>
  opts?: { timezone?: string }
  stop: ReturnType<typeof vi.fn>
}

// node-cron is mocked so no real timers are scheduled. Each schedule() call is
// captured so tests can drive the wrapped callback and assert on the registered
// cron expression, timezone option, and the returned task handle's stop().
const captured: CapturedJob[] = []

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn(
      (schedule: string, cb: () => void | Promise<void>, opts?: { timezone?: string }) => {
        const stop = vi.fn()
        captured.push({ schedule, cb, opts, stop })
        return { stop }
      }
    ),
  },
}))

vi.mock('@/jobs/audit-job', () => ({ runAuditJob: vi.fn() }))
vi.mock('@/jobs/journal-sync', () => ({ syncJournals: vi.fn() }))
vi.mock('@/jobs/exchange-rate-fetch-job', () => ({ fetchExchangeRates: vi.fn() }))

import { startScheduler, stopScheduler, getJobStatus, runJobManually } from '@/jobs/scheduler'
import { runAuditJob, type AuditJobResult } from '@/jobs/audit-job'
import { syncJournals } from '@/jobs/journal-sync'

describe('src/jobs/scheduler', () => {
  let logSpy: MockInstance<typeof console.log>
  let warnSpy: MockInstance<typeof console.warn>
  let errorSpy: MockInstance<typeof console.error>

  beforeEach(() => {
    captured.length = 0
    vi.clearAllMocks()
    // Safe defaults so a rejection/error set in one test can never leak into the next.
    vi.mocked(runAuditJob).mockResolvedValue({} as AuditJobResult)
    vi.mocked(syncJournals).mockResolvedValue(undefined as never)
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('startScheduler', () => {
    it('schedules every enabled job with its cron expression and Asia/Tokyo timezone', () => {
      startScheduler()

      expect(captured).toHaveLength(5)
      for (const job of captured) {
        expect(job.opts?.timezone).toBe('Asia/Tokyo')
      }
      expect(captured.map((c) => c.schedule)).toEqual(
        expect.arrayContaining([
          '0 1 * * *', // journal-sync
          '0 2 * * *', // audit-job
          '0 11 * * 1-5', // exchange-rate-fetch (weekdays only)
          '15 2 * * 1', // weekly-audit
          '30 2 1 * *', // monthly-audit
        ])
      )
    })

    it('staggers weekly and monthly audits off the daily 02:00 minute (PERF-03-06)', () => {
      startScheduler()
      const schedules = captured.map((c) => c.schedule)

      expect(schedules).toContain('0 2 * * *') // daily audit-job unchanged
      expect(schedules).toContain('15 2 * * 1') // weekly staggered to 02:15
      expect(schedules).toContain('30 2 1 * *') // monthly staggered to 02:30
      expect(schedules).not.toContain('0 2 * * 1') // weekly no longer collides at 02:00
      expect(schedules).not.toContain('0 2 1 * *') // monthly no longer collides at 02:00
    })

    it('prevents the same job from running concurrently (re-entrancy guard)', async () => {
      let release = (): void => {
        // replaced per-run below
      }
      vi.mocked(runAuditJob).mockImplementation(
        () =>
          new Promise<AuditJobResult>((resolve) => {
            release = () => resolve({} as AuditJobResult)
          })
      )

      startScheduler()
      const audit = captured.find((c) => c.schedule === '0 2 * * *')
      expect(audit).toBeDefined()

      const first = audit!.cb() // starts the job; handler stays pending
      await Promise.resolve() // let the handler invocation + runningJobs.add flush

      await audit!.cb() // second tick while the first is still running -> skipped

      expect(vi.mocked(runAuditJob)).toHaveBeenCalledTimes(1)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already running'))

      release()
      await first
    })

    it('logs completion with duration and frees the slot when a handler resolves', async () => {
      startScheduler()
      const audit = captured.find((c) => c.schedule === '0 2 * * *')!

      await audit.cb()

      expect(vi.mocked(runAuditJob)).toHaveBeenCalledTimes(1)
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('completed in'))

      // fail-safe: a finished run clears the guard, so the next tick is NOT skipped
      await audit.cb()
      expect(vi.mocked(runAuditJob)).toHaveBeenCalledTimes(2)
    })

    it('logs the error and still clears the guard when a handler rejects (fail-safe)', async () => {
      vi.mocked(runAuditJob).mockRejectedValue(new Error('boom'))
      startScheduler()
      const audit = captured.find((c) => c.schedule === '0 2 * * *')!

      await audit.cb() // wrapper swallows the rejection; must not throw

      expect(vi.mocked(runAuditJob)).toHaveBeenCalledTimes(1)
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('failed after'),
        expect.any(Error)
      )

      // fail-safe: a failed run must NOT permanently block subsequent runs
      await audit.cb()
      expect(vi.mocked(runAuditJob)).toHaveBeenCalledTimes(2)
    })

    it('skips jobs disabled via WEEKLY_AUDIT_ENABLED / MONTHLY_AUDIT_ENABLED', async () => {
      const prevWeekly = process.env.WEEKLY_AUDIT_ENABLED
      const prevMonthly = process.env.MONTHLY_AUDIT_ENABLED
      process.env.WEEKLY_AUDIT_ENABLED = 'false'
      process.env.MONTHLY_AUDIT_ENABLED = 'false'

      // Flags are captured at module-eval time, so a fresh module is required.
      vi.resetModules()
      const { startScheduler: freshStart } = await import('@/jobs/scheduler')
      freshStart()

      const schedules = captured.map((c) => c.schedule)
      expect(schedules).not.toContain('15 2 * * 1') // weekly disabled -> not scheduled
      expect(schedules).not.toContain('30 2 1 * *') // monthly disabled -> not scheduled
      expect(schedules).toContain('0 1 * * *') // unaffected jobs still scheduled
      expect(schedules).toContain('0 2 * * *')
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping disabled job: weekly-audit')
      )
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping disabled job: monthly-audit')
      )

      process.env.WEEKLY_AUDIT_ENABLED = prevWeekly
      process.env.MONTHLY_AUDIT_ENABLED = prevMonthly
    })
  })

  describe('stopScheduler', () => {
    it('stops every scheduled task', () => {
      startScheduler()
      expect(captured).toHaveLength(5)

      stopScheduler()

      for (const job of captured) {
        expect(job.stop).toHaveBeenCalledTimes(1)
      }
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Stopped job: journal-sync'))
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('All jobs stopped'))
    })

    it('is a no-op (and does not throw) when no jobs have been scheduled', async () => {
      vi.resetModules()
      const fresh = await import('@/jobs/scheduler')

      expect(() => fresh.stopScheduler()).not.toThrow()
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('All jobs stopped'))
    })
  })

  describe('getJobStatus', () => {
    it('reports running=false for every job before any scheduling', async () => {
      vi.resetModules()
      const fresh = await import('@/jobs/scheduler')

      const status = fresh.getJobStatus()
      expect(status).toHaveLength(5)
      expect(status.every((j) => j.running === false)).toBe(true)
      expect(status.map((s) => s.name)).toEqual(
        expect.arrayContaining([
          'journal-sync',
          'audit-job',
          'exchange-rate-fetch',
          'weekly-audit',
          'monthly-audit',
        ])
      )
    })

    it('reports running=true and full metadata after scheduling', () => {
      startScheduler()

      const status = getJobStatus()
      const byName = Object.fromEntries(status.map((s) => [s.name, s]))

      expect(status.every((j) => j.running === true)).toBe(true)
      expect(byName['journal-sync']).toEqual({
        name: 'journal-sync',
        schedule: '0 1 * * *',
        timezone: 'Asia/Tokyo',
        running: true,
      })
      expect(byName['exchange-rate-fetch'].schedule).toBe('0 11 * * 1-5')
      expect(byName['weekly-audit'].schedule).toBe('15 2 * * 1')
      expect(byName['monthly-audit'].schedule).toBe('30 2 1 * *')
    })
  })

  describe('runJobManually', () => {
    it('returns success:false with a not-found message for an unknown job', async () => {
      const res = await runJobManually('does-not-exist')
      expect(res).toEqual({ success: false, error: 'Job not found: does-not-exist' })
    })

    it('runs a known job and returns success:true', async () => {
      const res = await runJobManually('journal-sync')
      expect(res).toEqual({ success: true })
      expect(syncJournals).toHaveBeenCalledTimes(1)
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Manually running job: journal-sync')
      )
    })

    it('computes a 7-day window ending today for weekly-audit', async () => {
      const res = await runJobManually('weekly-audit')
      expect(res).toEqual({ success: true })

      expect(runAuditJob).toHaveBeenCalledTimes(1)
      const arg = vi.mocked(runAuditJob).mock.calls[0]![0] as unknown as {
        startDate: string
        endDate: string
        notifyOnComplete: boolean
      }
      expect(arg.notifyOnComplete).toBe(true)
      expect(arg.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(arg.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      // Relative check only (no absolute clock dependency): exactly 7 calendar days.
      expect(differenceInCalendarDays(new Date(arg.endDate), new Date(arg.startDate))).toBe(7)
    })

    it('computes a full last-calendar-month window for monthly-audit', async () => {
      const res = await runJobManually('monthly-audit')
      expect(res).toEqual({ success: true })

      const arg = vi.mocked(runAuditJob).mock.calls[0]![0] as unknown as {
        startDate: string
        endDate: string
        notifyOnComplete: boolean
      }
      expect(arg.notifyOnComplete).toBe(true)
      expect(arg.startDate).toMatch(/^\d{4}-\d{2}-01$/) // first day of a month
      expect(arg.endDate.slice(0, 7)).toBe(arg.startDate.slice(0, 7)) // same year-month
      expect(arg.endDate > arg.startDate).toBe(true) // last day > first day
    })

    it('returns the error message and logs when the handler throws an Error', async () => {
      vi.mocked(runAuditJob).mockRejectedValue(new Error('audit failed'))
      const res = await runJobManually('audit-job')
      expect(res).toEqual({ success: false, error: 'audit failed' })
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Manual job audit-job failed'),
        expect.any(Error)
      )
    })

    it('stringifies non-Error throwables into the error field', async () => {
      vi.mocked(runAuditJob).mockRejectedValue('plain string failure' as never)
      const res = await runJobManually('audit-job')
      expect(res).toEqual({ success: false, error: 'plain string failure' })
    })
  })
})
