import { describe, it, expect, vi, beforeAll } from 'vitest'
import { performance } from 'node:perf_hooks'

vi.mock('@/lib/db', () => ({
  prisma: {
    company: {
      findFirst: vi.fn().mockResolvedValue({ id: 'bench-co-1', name: 'BenchCo' }),
    },
  },
}))

vi.mock('@/services/report/balance-loader', () => ({
  fetchBalancesByFiscalYear: vi.fn(),
  clearBalanceCache: vi.fn(),
}))

import { fetchBalancesByFiscalYear } from '@/services/report/balance-loader'
import { getMultiMonthReport } from '@/services/report/monthly-report'
import { generateJournals } from './support/journal-factory'
import { journalsToBalanceRows } from './support/derive'
import { recordBench } from './support/bench-reporter'

const SEED = 0x12345678
const COUNT = 100_000
const FISCAL_YEAR = 2024
const COMPANY_ID = 'bench-co-1'
const WARMUP = 1
const ITERATIONS = 5

describe('benchmark: report aggregation', () => {
  beforeAll(() => {
    const journals = generateJournals({
      count: COUNT,
      companyId: COMPANY_ID,
      fiscalYear: FISCAL_YEAR,
      seed: SEED,
    })
    if (!journals.success) throw journals.error
    const rows = journalsToBalanceRows(journals.data, COMPANY_ID, FISCAL_YEAR)
    if (!rows.success) throw rows.error
    vi.mocked(fetchBalancesByFiscalYear).mockResolvedValue({
      success: true,
      data: rows.data,
    })
  })

  it('aggregates a full-year multi-month report over balances derived from 100k journals', async () => {
    for (let w = 0; w < WARMUP; w++) {
      await getMultiMonthReport(COMPANY_ID, FISCAL_YEAR, 12, 12)
    }

    const samples: number[] = []
    let lastSections = 0
    let lastMonths = 0
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now()
      const result = await getMultiMonthReport(COMPANY_ID, FISCAL_YEAR, 12, 12)
      const end = performance.now()
      samples.push(end - start)

      expect(result.success).toBe(true)
      if (result.success) {
        lastSections = result.data.sections.length
        lastMonths = result.data.months.length
      }
    }

    const ok = lastSections === 4 && lastMonths === 12
    expect(ok).toBe(true)

    const recorded = recordBench({
      name: 'report-aggregation',
      inputSize: COUNT,
      iterations: ITERATIONS,
      samplesMs: samples,
      assertion: ok ? 'passed' : 'failed',
      meta: { target: 'getMultiMonthReport', months: 12 },
    })
    expect(recorded.success).toBe(true)

    const median = [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)]
    console.log(
      `[bench] report-aggregation: median=${median.toFixed(2)}ms over ${ITERATIONS} runs ` +
        `(${lastSections} sections x ${lastMonths} months)`
    )
  })
})
