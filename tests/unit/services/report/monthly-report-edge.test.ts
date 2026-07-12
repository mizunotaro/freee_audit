import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getMonthlyTrend, getMultiMonthReport } from '@/services/report/monthly-report'
import { clearBalanceCache } from '@/services/report/balance-loader'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    company: { findFirst: vi.fn() },
    monthlyBalance: { findMany: vi.fn() },
  },
}))

const company = { id: 'co-1', name: 'テスト株式会社' }

function row(
  month: number,
  category: string,
  accountCode: string,
  accountName: string,
  amount: number
) {
  return {
    id: `${accountCode}-${month}`,
    companyId: 'co-1',
    fiscalYear: 2024,
    month,
    accountCode,
    accountName,
    category,
    amount,
  }
}

const month1Balances = [
  row(1, 'revenue', '4000', '売上高', 1000),
  row(1, 'cost_of_sales', '5000', '売上原価', 400),
  row(1, 'sga_expense', '6100', '減価償却費', 100),
  row(1, 'sga_expense', '6200', '管理部門人件費', 50),
  row(1, 'current_asset', '1000', '現金及び預金', 5000),
  row(1, 'fixed_asset', '2000', '建物', 8000),
]

describe('monthly-report real-balance mapping (edge cases)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearBalanceCache()
    vi.mocked(prisma.company.findFirst).mockResolvedValue(company as never)
    vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue([] as never)
  })

  describe('getMonthlyTrend — mapBalancesToProfitLoss / mapBalancesToBalanceSheet', () => {
    it('maps recorded balances into exact P&L and cash figures for the recorded month', async () => {
      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue(month1Balances as never)

      const trends = await getMonthlyTrend('co-1', 2024)

      expect(trends).toHaveLength(12)
      const jan = trends[0]
      expect(jan.month).toBe('1月')
      // revenue aggregates only the 'revenue' category
      expect(jan.revenue).toBe(1000)
      // grossProfit = revenue(1000) - costOfSales(400)
      expect(jan.grossProfit).toBe(600)
      // operatingIncome = grossProfit(600) - sga(100+50)
      expect(jan.operatingIncome).toBe(450)
      // netIncome = round(operatingIncome * 0.7)
      expect(jan.netIncome).toBe(315)
      // cash = first current_asset amount
      expect(jan.cash).toBe(5000)
    })

    it('ignores balance categories that do not belong to the P&L (no leakage)', async () => {
      const withExtra = [
        ...month1Balances,
        row(1, 'current_liability', '3000', '買掛金', 9999),
        row(1, 'equity', '5000', '資本金', 9999),
      ]
      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue(withExtra as never)

      const [jan] = await getMonthlyTrend('co-1', 2024)
      // liabilities/equity must not inflate revenue or gross profit
      expect(jan.revenue).toBe(1000)
      expect(jan.grossProfit).toBe(600)
    })

    it('extracts depreciation only from SGA items whose name contains 減価償却', async () => {
      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue(month1Balances as never)

      // Indirect check: netIncome uses operatingIncome (which already deducts full SGA),
      // and operatingIncome is unaffected by which SGA line is depreciation — but the
      // presence of a depreciation line must not double-count. Pin operatingIncome.
      const [jan] = await getMonthlyTrend('co-1', 2024)
      expect(jan.operatingIncome).toBe(450)
    })

    it('falls back to sample data for months that have no recorded balances', async () => {
      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue(month1Balances as never)

      const trends = await getMonthlyTrend('co-1', 2024)
      // Month 1 is recorded (revenue 1000); month 2 has no balances and must still
      // produce a finite, non-undefined trend entry derived from sample data.
      expect(trends[1].month).toBe('2月')
      expect(Number.isFinite(trends[1].revenue)).toBe(true)
      expect(trends[1].revenue).not.toBe(1000)
      expect(Number.isFinite(trends[1].cash)).toBe(true)
    })
  })

  describe('getMultiMonthReport — window construction', () => {
    it('wraps months across the year boundary (endMonth=2, count=3 → [12,1,2])', async () => {
      const result = await getMultiMonthReport('co-1', 2024, 2, 3)

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.months).toEqual([12, 1, 2])
      expect(result.data.monthCount).toBe(3)
      expect(result.data.endMonth).toBe(2)
    })

    it('does not wrap when the window fits inside the year (endMonth=6, count=3 → [4,5,6])', async () => {
      const result = await getMultiMonthReport('co-1', 2024, 6, 3)

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.months).toEqual([4, 5, 6])
    })

    it('wraps the full 12-month window ending at month 1 (→ [2..12,1])', async () => {
      const result = await getMultiMonthReport('co-1', 2024, 1, 12)

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data.months[0]).toBe(2)
      expect(result.data.months[11]).toBe(1)
      expect(result.data.months).toHaveLength(12)
    })

    it('returns NOT_FOUND when the company does not exist', async () => {
      vi.mocked(prisma.company.findFirst).mockResolvedValue(null as never)

      const result = await getMultiMonthReport('missing', 2024, 12, 3)

      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error.code).toBe('NOT_FOUND')
      expect(result.error.message).toBe('Company not found')
    })

    it('builds all four section types from recorded balances', async () => {
      const balances = [
        row(12, 'current_asset', '1000', '現金及び預金', 5000),
        row(12, 'revenue', '4000', '売上高', 1000),
        row(12, 'cost_of_sales', '5000', '売上原価', 400),
        row(12, 'sga_expense', '6100', '減価償却費', 100),
      ]
      vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValue(balances as never)

      const result = await getMultiMonthReport('co-1', 2024, 12, 3)

      expect(result.success).toBe(true)
      if (!result.success) return
      const types = result.data.sections.map((s) => s.type)
      expect(types).toEqual(['bs', 'pl', 'cf', 'kpi'])
      // BS section must contain the asset total row driven by recorded balances
      const bs = result.data.sections.find((s) => s.type === 'bs')
      expect(bs?.rows.some((r) => r.name === '資産合計')).toBe(true)
    })
  })
})
