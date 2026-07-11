import { describe, it, expect, beforeAll } from 'vitest'
import { performance } from 'node:perf_hooks'
import { JournalChecker, type JournalEntryData } from '@/services/audit/journal-checker'
import { analyzeJournal } from '@/services/audit'
import type { Journal, JournalEntry } from '@/types'
import type { DocumentAnalysisResult } from '@/types/audit'
import type { AIProviderInterface } from '@/lib/integrations/ai'
import { generateJournals } from './support/journal-factory'
import { recordBench } from './support/bench-reporter'

const SEED = 0x12345678
const COUNT = 100_000
const FISCAL_YEAR = 2024
const COMPANY_ID = 'bench-co-1'
const ANALYZE_SAMPLE = 5_000

const NOOP_AI_PROVIDER: AIProviderInterface = {
  analyzeDocument: async () => ({
    date: null,
    amount: 0,
    taxAmount: 0,
    description: '',
    vendorName: '',
    confidence: 0,
  }),
}

function isoDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

function buildBatchPairs(
  journals: Journal[]
): Array<{ entry: JournalEntryData; documentData: DocumentAnalysisResult }> {
  return journals.map((j, i) => {
    const mismatch = i % 10 === 0
    const docDate = new Date(FISCAL_YEAR, j.entryDate.getMonth(), j.entryDate.getDate() - 2)
    return {
      entry: {
        id: j.id,
        date: isoDate(j.entryDate),
        debitAccount: j.debitAccount,
        creditAccount: j.creditAccount,
        amount: j.amount,
        taxAmount: j.taxAmount,
        taxType: j.taxType,
        description: j.description,
      },
      documentData: {
        date: mismatch ? isoDate(docDate) : isoDate(j.entryDate),
        amount: mismatch ? j.amount + 500 : j.amount,
        taxAmount: j.taxAmount,
        description: j.description,
        vendorName: '分析対象取引先',
        confidence: 0.9,
      },
    }
  })
}

function buildAnalyzePairs(journals: Journal[]): Array<{ entry: JournalEntry; content: string }> {
  return journals.slice(0, ANALYZE_SAMPLE).map((j, i) => {
    const mismatch = i % 10 === 0
    const docDate = new Date(FISCAL_YEAR, j.entryDate.getMonth(), j.entryDate.getDate() - 3)
    const docAmount = mismatch ? j.amount + 5000 : j.amount
    const content = `ご請求額：¥${docAmount.toLocaleString()}\n日付：${mismatch ? isoDate(docDate) : isoDate(j.entryDate)}\n摘要：${j.description}`
    return {
      entry: {
        id: j.id,
        entryDate: j.entryDate,
        description: j.description,
        debitAccount: j.debitAccount,
        creditAccount: j.creditAccount,
        amount: j.amount,
        taxAmount: j.taxAmount,
        taxType: j.taxType,
      },
      content,
    }
  })
}

describe('benchmark: analysis queries (journal audit)', () => {
  let journals: Journal[]
  let checker: JournalChecker

  beforeAll(() => {
    const result = generateJournals({
      count: COUNT,
      companyId: COMPANY_ID,
      fiscalYear: FISCAL_YEAR,
      seed: SEED,
    })
    if (!result.success) throw result.error
    journals = result.data
    checker = new JournalChecker({ aiProvider: NOOP_AI_PROVIDER })
  })

  it('batch-checks 100k journals with document verification (no AI)', async () => {
    const pairs = buildBatchPairs(journals)
    const ITERATIONS = 3

    await checker.batchCheck(pairs.slice(0, 1000))

    const samples: number[] = []
    let lastCount = 0
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now()
      const results = await checker.batchCheck(pairs)
      const end = performance.now()
      samples.push(end - start)
      lastCount = results.length
    }

    const ok = lastCount === COUNT
    expect(ok).toBe(true)

    const recorded = recordBench({
      name: 'analysis-batch-check',
      inputSize: COUNT,
      iterations: ITERATIONS,
      samplesMs: samples,
      assertion: ok ? 'passed' : 'failed',
      meta: { target: 'JournalChecker.batchCheck', aiEnabled: false },
    })
    expect(recorded.success).toBe(true)

    const median = [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)]
    console.log(
      `[bench] analysis-batch-check: median=${median.toFixed(2)}ms over ${ITERATIONS} runs (${lastCount} entries)`
    )
  })

  it('runs per-entry document analysis over a 5k sample', async () => {
    const pairs = buildAnalyzePairs(journals)
    const WARMUP = 1
    const ITERATIONS = 3

    for (let i = 0; i < WARMUP; i++) {
      await analyzeJournal(pairs[0].entry, pairs[0].content)
    }

    const samples: number[] = []
    let allHaveStatus = true
    for (let iter = 0; iter < ITERATIONS; iter++) {
      const start = performance.now()
      for (const { entry, content } of pairs) {
        const res = await analyzeJournal(entry, content)
        if (res.status !== 'PASSED' && res.status !== 'FAILED' && res.status !== 'ERROR') {
          allHaveStatus = false
        }
      }
      const end = performance.now()
      samples.push(end - start)
    }

    expect(allHaveStatus).toBe(true)

    const recorded = recordBench({
      name: 'analysis-per-entry',
      inputSize: ANALYZE_SAMPLE,
      iterations: ITERATIONS,
      samplesMs: samples,
      assertion: allHaveStatus ? 'passed' : 'failed',
      meta: { target: 'analyzeJournal', sampleSize: ANALYZE_SAMPLE },
    })
    expect(recorded.success).toBe(true)

    const median = [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)]
    console.log(
      `[bench] analysis-per-entry: median=${median.toFixed(2)}ms over ${ITERATIONS} runs (${ANALYZE_SAMPLE} entries)`
    )
  })
})
