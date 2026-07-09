import { z } from 'zod'
import { prisma } from '@/lib/db'
import { MemoryCache } from '@/lib/cache'
import {
  type AppError,
  type Result,
  ERROR_CODES,
  createAppError,
  failure,
  success,
} from '@/types/result'

export interface MonthlyBalanceRow {
  id: string
  companyId: string
  fiscalYear: number
  month: number
  accountCode: string
  accountName: string
  category: string
  amount: number
}

const balanceQuerySchema = z.object({
  companyId: z.string().min(1),
  fiscalYear: z.number().int().min(1900).max(2100),
})

const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_REPORT_BALANCES || '30000', 10)

const balancesCache = new MemoryCache<MonthlyBalanceRow[]>(CACHE_TTL_MS)

function cacheKey(companyId: string, fiscalYear: number): string {
  return `report:balances:${companyId}:${fiscalYear}`
}

export async function fetchBalancesByFiscalYear(
  companyId: string,
  fiscalYear: number
): Promise<Result<MonthlyBalanceRow[], AppError>> {
  const parsed = balanceQuerySchema.safeParse({ companyId, fiscalYear })
  if (!parsed.success) {
    return failure(createAppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid balance query input'))
  }

  const key = cacheKey(parsed.data.companyId, parsed.data.fiscalYear)
  const cached = balancesCache.get(key)
  if (cached) {
    return success(cached)
  }

  const rows = await prisma.monthlyBalance.findMany({
    where: {
      companyId: parsed.data.companyId,
      fiscalYear: parsed.data.fiscalYear,
    },
  })

  balancesCache.set(key, rows)
  return success(rows)
}

export function clearBalanceCache(): void {
  balancesCache.clear()
}
