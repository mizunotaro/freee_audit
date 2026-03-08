import { ExchangeRate, ExchangeRateProvider, ExchangeRateSource } from '../types'
import { prisma } from '@/lib/db'
import { Result, success, failure } from '@/types/result'

const BOJ_BASE_URL = 'https://www.boj.or.jp/statistics'
const BOJ_RATE_URL = `${BOJ_BASE_URL}/dl/finance/price/kawase/`

interface BOJRateData {
  currencyCode: string
  rate: number
}

export class BOJRateProvider implements ExchangeRateProvider {
  readonly source: ExchangeRateSource = 'BOJ'
  readonly priority = 1
  readonly confidence = 1.0

  async fetchRates(date: Date): Promise<Result<ExchangeRate[], Error>> {
    const startTime = Date.now()

    try {
      const url = this.buildCSVUrl(date)
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        return failure(new Error(`BOJ fetch failed: ${response.status}`))
      }

      const csv = await response.text()
      const rates = this.parseBOJCSV(csv, date)

      if (rates.length === 0) {
        return failure(new Error('No rates found in BOJ response'))
      }

      const savedRates = await this.saveRates(rates)

      await this.logFetch(date, 'SUCCESS', savedRates.length, Date.now() - startTime)

      return success(savedRates)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.logFetch(date, 'FAILED', 0, Date.now() - startTime, errorMessage)
      return failure(error instanceof Error ? error : new Error(errorMessage))
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(BOJ_BASE_URL, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  private buildCSVUrl(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${BOJ_RATE_URL}${year}${month}.csv`
  }

  private parseBOJCSV(csv: string, _date: Date): BOJRateData[] {
    const lines = csv.trim().split('\n')
    const rates: BOJRateData[] = []

    for (const line of lines.slice(1)) {
      const parts = line.split(',')
      if (parts.length >= 2) {
        const currencyCode = parts[0].trim()
        const rateStr = parts[1].trim()
        const rate = parseFloat(rateStr)

        if (currencyCode && !isNaN(rate)) {
          rates.push({ currencyCode, rate })
        }
      }
    }

    return rates
  }

  private async saveRates(rates: BOJRateData[]): Promise<ExchangeRate[]> {
    const savedRates: ExchangeRate[] = []
    const rateDate = new Date()
    rateDate.setHours(0, 0, 0, 0)

    for (const rateData of rates) {
      const existing = await prisma.exchangeRate.findFirst({
        where: {
          rateDate,
          fromCurrency: 'JPY',
          toCurrency: rateData.currencyCode,
          source: 'BOJ',
        },
      })

      let saved
      if (existing) {
        saved = await prisma.exchangeRate.update({
          where: { id: existing.id },
          data: {
            rate: rateData.rate,
            confidence: this.confidence,
            isOfficial: true,
          },
        })
      } else {
        saved = await prisma.exchangeRate.create({
          data: {
            rateDate,
            fromCurrency: 'JPY',
            toCurrency: rateData.currencyCode,
            rate: rateData.rate,
            source: 'BOJ',
            confidence: this.confidence,
            isOfficial: true,
          },
        })
      }

      savedRates.push({
        ...saved,
        source: saved.source as ExchangeRateSource,
      })
    }

    return savedRates
  }

  private async logFetch(
    rateDate: Date,
    status: string,
    recordsCount: number,
    durationMs: number,
    errorMessage?: string
  ): Promise<void> {
    await prisma.exchangeRateFetchLog.create({
      data: {
        source: 'BOJ',
        rateDate,
        status,
        recordsCount,
        durationMs,
        errorMessage,
      },
    })
  }
}

export function createBOJRateProvider(): BOJRateProvider {
  return new BOJRateProvider()
}
