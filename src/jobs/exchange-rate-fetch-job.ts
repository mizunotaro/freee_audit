import { BOJRateProvider } from '@/services/currency/providers/boj-rate-provider'

const bojProvider = new BOJRateProvider()

const RETRY_DELAYS = [5 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000]

export async function fetchExchangeRates(): Promise<void> {
  console.log('[ExchangeRateJob] Starting daily fetch...')
  await executeWithRetry()
}

async function executeWithRetry(attempt: number = 0): Promise<void> {
  const result = await bojProvider.fetchRates(new Date())

  if (result.success) {
    console.log(`[ExchangeRateJob] Success: ${result.data.length} rates fetched`)
    await sendSuccessNotification(result.data.length)
    return
  }

  console.error(`[ExchangeRateJob] Attempt ${attempt + 1} failed:`, result.error)

  if (attempt < RETRY_DELAYS.length) {
    console.log(`[ExchangeRateJob] Retrying in ${RETRY_DELAYS[attempt] / 1000} seconds...`)
    setTimeout(() => executeWithRetry(attempt + 1), RETRY_DELAYS[attempt])
  } else {
    await sendFailureNotification(result.error.message)
  }
}

async function sendSuccessNotification(count: number): Promise<void> {
  console.log(`[ExchangeRateJob] Notification: ${count} rates fetched successfully`)
}

async function sendFailureNotification(error: string): Promise<void> {
  console.error(`[ExchangeRateJob] Notification: Fetch failed - ${error}`)
}

export function startExchangeRateFetchJob(): void {
  console.log('[ExchangeRateJob] Job module loaded - use scheduler.ts to schedule')
}
