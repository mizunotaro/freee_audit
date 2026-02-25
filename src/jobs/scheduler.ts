import cron, { ScheduledTask } from 'node-cron'
import { runAuditJob } from './audit-job'
import { syncJournals } from './journal-sync'

type JobHandler = () => Promise<unknown>

interface ScheduledJob {
  name: string
  schedule: string
  handler: JobHandler
  task?: ScheduledTask
  timezone: string
}

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
]

export function startScheduler(): void {
  console.log('[Scheduler] Starting job scheduler...')

  for (const job of jobs) {
    console.log(`[Scheduler] Scheduling ${job.name} with cron "${job.schedule}" (${job.timezone})`)

    job.task = cron.schedule(
      job.schedule,
      async () => {
        console.log(`[Scheduler] Running job: ${job.name}`)
        const startTime = Date.now()

        try {
          await job.handler()
          const duration = Date.now() - startTime
          console.log(`[Scheduler] Job ${job.name} completed in ${duration}ms`)
        } catch (error) {
          const duration = Date.now() - startTime
          console.error(`[Scheduler] Job ${job.name} failed after ${duration}ms:`, error)
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

export function getJobStatus(): Array<{
  name: string
  schedule: string
  timezone: string
  running: boolean
}> {
  return jobs.map((job) => ({
    name: job.name,
    schedule: job.schedule,
    timezone: job.timezone,
    running: job.task !== undefined,
  }))
}

export async function runJobManually(
  jobName: string
): Promise<{ success: boolean; error?: string }> {
  const job = jobs.find((j) => j.name === jobName)

  if (!job) {
    return { success: false, error: `Job not found: ${jobName}` }
  }

  try {
    console.log(`[Scheduler] Manually running job: ${jobName}`)
    await job.handler()
    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[Scheduler] Manual job ${jobName} failed:`, error)
    return { success: false, error: errorMessage }
  }
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
