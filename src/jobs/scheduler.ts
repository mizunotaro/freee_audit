import cron, { ScheduledTask } from 'node-cron'
import { runAuditJob } from './audit-job'
import { syncJournals } from './journal-sync'
import { fetchExchangeRates } from './exchange-rate-fetch-job'
import { subDays, subMonths, startOfMonth, endOfMonth, format } from 'date-fns'

type JobHandler = () => Promise<unknown>

const WEEKLY_AUDIT_ENABLED = process.env.WEEKLY_AUDIT_ENABLED !== 'false'
const MONTHLY_AUDIT_ENABLED = process.env.MONTHLY_AUDIT_ENABLED !== 'false'

interface ScheduledJob {
  name: string
  schedule: string
  handler: JobHandler
  task?: ScheduledTask
  timezone: string
  enabled?: boolean
}

const runningJobs = new Set<string>()

const jobs: ScheduledJob[] = [
  {
    name: 'journal-sync',
    schedule: '0 1 * * *',
    handler: () => syncJournals(),
    timezone: 'Asia/Tokyo',
  },
  {
    name: 'audit-job',
    schedule: '0 2 * * *',
    handler: () => runAuditJob(),
    timezone: 'Asia/Tokyo',
  },
  {
    name: 'exchange-rate-fetch',
    schedule: '0 11 * * 1-5',
    handler: () => fetchExchangeRates(),
    timezone: 'Asia/Tokyo',
  },
  {
    name: 'weekly-audit',
    schedule: '15 2 * * 1',
    handler: () => {
      const endDate = new Date()
      const startDate = subDays(endDate, 7)
      return runAuditJob({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        notifyOnComplete: true,
      })
    },
    timezone: 'Asia/Tokyo',
    enabled: WEEKLY_AUDIT_ENABLED,
  },
  {
    name: 'monthly-audit',
    schedule: '30 2 1 * *',
    handler: () => {
      const lastMonth = subMonths(new Date(), 1)
      return runAuditJob({
        startDate: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd'),
        notifyOnComplete: true,
      })
    },
    timezone: 'Asia/Tokyo',
    enabled: MONTHLY_AUDIT_ENABLED,
  },
]

export function startScheduler(): void {
  console.log('[Scheduler] Starting job scheduler...')

  for (const job of jobs) {
    if (job.enabled === false) {
      console.log(`[Scheduler] Skipping disabled job: ${job.name}`)
      continue
    }

    console.log(`[Scheduler] Scheduling ${job.name} with cron "${job.schedule}" (${job.timezone})`)

    job.task = cron.schedule(
      job.schedule,
      async () => {
        if (runningJobs.has(job.name)) {
          console.warn(`[Scheduler] Skipping ${job.name}: already running`)
          return
        }
        runningJobs.add(job.name)
        const startTime = Date.now()
        console.log(`[Scheduler] Running job: ${job.name}`)

        try {
          await job.handler()
          const duration = Date.now() - startTime
          console.log(`[Scheduler] Job ${job.name} completed in ${duration}ms`)
        } catch (error) {
          const duration = Date.now() - startTime
          console.error(`[Scheduler] Job ${job.name} failed after ${duration}ms:`, error)
        } finally {
          runningJobs.delete(job.name)
        }
      },
      {
        timezone: job.timezone,
      }
    )
  }

  console.log('[Scheduler] All jobs scheduled')
}

export function stopScheduler(): void {
  console.log('[Scheduler] Stopping scheduler...')

  for (const job of jobs) {
    if (job.task) {
      job.task.stop()
      console.log(`[Scheduler] Stopped job: ${job.name}`)
    }
  }

  console.log('[Scheduler] All jobs stopped')
}

if (require.main === module) {
  startScheduler()

  process.on('SIGINT', () => {
    stopScheduler()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    stopScheduler()
    process.exit(0)
  })
}
