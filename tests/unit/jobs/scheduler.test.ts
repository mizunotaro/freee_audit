import { describe, it, expect, vi, beforeEach } from 'vitest'

interface CapturedCallback {
  schedule: string
  cb: () => void | Promise<void>
}

const captured: CapturedCallback[] = []

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn((schedule: string, cb: () => void | Promise<void>) => {
      captured.push({ schedule, cb })
      return { stop: vi.fn() }
    }),
  },
}))

vi.mock('@/jobs/audit-job', () => ({ runAuditJob: vi.fn() }))
vi.mock('@/jobs/journal-sync', () => ({ syncJournals: vi.fn() }))
vi.mock('@/jobs/exchange-rate-fetch-job', () => ({ fetchExchangeRates: vi.fn() }))

import { startScheduler } from '@/jobs/scheduler'
import { runAuditJob, type AuditJobResult } from '@/jobs/audit-job'

describe('scheduler inter-job guard (PERF-03-06)', () => {
  beforeEach(() => {
    captured.length = 0
    vi.clearAllMocks()
  })

  it('staggers weekly and monthly audits off the daily 02:00 minute', () => {
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

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const first = audit!.cb() // starts the job; handler stays pending
    await Promise.resolve() // let the handler invocation flush

    await audit!.cb() // second tick while the first is still running -> skipped

    expect(vi.mocked(runAuditJob)).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already running'))

    release()
    await first
    warnSpy.mockRestore()
  })
})
