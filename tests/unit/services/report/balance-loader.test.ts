import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchBalancesByFiscalYear, clearBalanceCache } from '@/services/report/balance-loader'
import { prisma } from '@/lib/db'

vi.mock('@/lib/db', () => ({
  prisma: {
    monthlyBalance: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

const sampleRow = {
  id: 'mb-1',
  companyId: 'co-1',
  fiscalYear: 2024,
  month: 1,
  accountCode: '1000',
  accountName: '現金及び預金',
  category: 'current_asset',
  amount: 1000,
  createdAt: new Date(),
}

describe('fetchBalancesByFiscalYear', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearBalanceCache()
  })

  it('should return success with rows on a cache miss', async () => {
    vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValueOnce([sampleRow])

    const result = await fetchBalancesByFiscalYear('co-1', 2024)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toEqual([sampleRow])
    expect(prisma.monthlyBalance.findMany).toHaveBeenCalledTimes(1)
  })

  it('should serve a repeat call from cache without hitting the database', async () => {
    vi.mocked(prisma.monthlyBalance.findMany).mockResolvedValueOnce([sampleRow])

    await fetchBalancesByFiscalYear('co-1', 2024)
    const result = await fetchBalancesByFiscalYear('co-1', 2024)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toEqual([sampleRow])
    expect(prisma.monthlyBalance.findMany).toHaveBeenCalledTimes(1)
  })

  it('should return failure for an empty companyId without querying', async () => {
    const result = await fetchBalancesByFiscalYear('', 2024)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.code).toBe('VALIDATION_ERROR')
    expect(prisma.monthlyBalance.findMany).not.toHaveBeenCalled()
  })

  it('should return failure for an out-of-range fiscalYear without querying', async () => {
    const result = await fetchBalancesByFiscalYear('co-1', 1800)

    expect(result.success).toBe(false)
    expect(prisma.monthlyBalance.findMany).not.toHaveBeenCalled()
  })
})
