import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseBudgetCsv, validateBudgetCsv } from '@/services/budget/budget-import'

/**
 * EDGE-01 — error / edge-case deepening for budget CSV parsing/validation.
 *
 * Covers branches left uncovered by budget-import.test.ts:
 *   - parseBudgetCsv: a header column at index ≥2 that is not a month (no digit),
 *     so the `if (monthMatch)` false branch is taken and the column is skipped.
 *   - parseBudgetCsv: a data row with fewer than 2 cells (`if (row.length < 2) continue`).
 *   - validateBudgetCsv: a data row with fewer than 2 cells, producing the
 *     "コードと名称が必要です" row error and a continue.
 */

vi.mock('@/lib/utils', () => ({
  parseCsv: vi.fn((content: string) => {
    const lines = content.split('\n').filter((l) => l.trim())
    return lines.map((line) => line.split(','))
  }),
}))

describe('parseBudgetCsv — non-month header columns are ignored', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips a 備考 (notes) column that contains no digit, keeping only real month columns', () => {
    // Header: code, name, 1月, 備考, 2月. The 備考 column matches no `(\d+)月?` →
    // skipped, so only two month columns are detected. The data row omits the
    // notes column (sparse header), so its 3rd/4th cells align to 1月/2月.
    const csv = `勘定科目コード,勘定科目名,1月,備考,2月
400,売上高,1000000,2000000`

    const result = parseBudgetCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].accountCode).toBe('400')
    // Two month columns detected (1月 and 2月); 備考 was not treated as a month.
    expect(result[0].months).toEqual([1000000, 2000000])
    expect(result[0].months).toHaveLength(2)
  })
})

describe('parseBudgetCsv — short data rows are skipped', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('skips a data row that has fewer than 2 cells', () => {
    // Row 2 ("400") has only one cell → length 1 < 2 → skipped.
    const csv = `勘定科目コード,勘定科目名,1月
400
500,売上原価,1000000`

    const result = parseBudgetCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].accountCode).toBe('500')
    expect(result[0].months).toEqual([1000000])
  })
})

describe('validateBudgetCsv — short data rows produce a row error', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports 勘定科目コードと名称が必要です for a single-cell data row', () => {
    const csv = `勘定科目コード,勘定科目名,1月
400
500,売上原価,1000000`

    const result = validateBudgetCsv(csv)

    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('2行目'))).toBe(true)
    expect(result.errors.some((e) => e.includes('勘定科目コードと名称が必要です'))).toBe(true)
  })

  it('still validates the well-formed rows alongside the short row', () => {
    const csv = `勘定科目コード,勘定科目名,1月
400
500,売上原価,notanumber`

    const result = validateBudgetCsv(csv)

    // Short row (2行目) + invalid number in row 3.
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('2行目: 勘定科目コードと名称が必要です'))).toBe(
      true
    )
    expect(result.errors.some((e) => e.includes('3行目') && e.includes('数値が無効'))).toBe(true)
  })
})
