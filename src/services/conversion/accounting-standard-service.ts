import { prisma } from '@/lib/db'
import type { AccountingStandardInfo, AccountingStandard } from '@/types/conversion'

const SEED_STANDARDS: Array<{
  code: string
  name: string
  nameEn: string
  description: string
  countryCode: string
  sortOrder: number
  isActive: boolean
}> = [
  {
    code: 'JGAAP',
    name: '日本基準',
    nameEn: 'Japanese GAAP',
    description: '日本の一般に公正妥当と認められる企業会計の原則',
    countryCode: 'JP',
    sortOrder: 1,
    isActive: true,
  },
  {
    code: 'USGAAP',
    name: 'US GAAP',
    nameEn: 'United States Generally Accepted Accounting Principles',
    description: '米国の一般に公正妥当と認められる企業会計の原則',
    countryCode: 'US',
    sortOrder: 2,
    isActive: true,
  },
  {
    code: 'IFRS',
    name: 'IFRS',
    nameEn: 'International Financial Reporting Standards',
    description: '国際会計基準',
    countryCode: 'XX',
    sortOrder: 3,
    isActive: true,
  },
]

export class AccountingStandardServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: unknown
  ) {
    super(message)
    this.name = 'AccountingStandardServiceError'
  }
}

export class AccountingStandardService {
  private cache: Map<string, { data: AccountingStandardInfo[]; expiresAt: number }> = new Map()
  private cacheTTL = 5 * 60 * 1000

  async getAll(): Promise<AccountingStandardInfo[]> {
    const cacheKey = 'all'
    const cached = this.cache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data
    }

    try {
      const standards = await prisma.accountingStandard.findMany({
        orderBy: { sortOrder: 'asc' },
      })

      const result = standards.map(this.toAccountingStandardInfo)

      this.cache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + this.cacheTTL,
      })

      return result
    } catch (error) {
      throw new AccountingStandardServiceError(
        'Failed to fetch accounting standards',
        'FETCH_ERROR',
        error
      )
    }
  }

  async getByCode(code: AccountingStandard): Promise<AccountingStandardInfo | null> {
    const cacheKey = `code:${code}`
    const cached = this.cache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data[0] || null
    }

    try {
      const standard = await prisma.accountingStandard.findUnique({
        where: { code },
      })

      if (!standard) {
        return null
      }

      const result = this.toAccountingStandardInfo(standard)

      this.cache.set(cacheKey, {
        data: [result],
        expiresAt: Date.now() + this.cacheTTL,
      })

      return result
    } catch (error) {
      throw new AccountingStandardServiceError(
        `Failed to fetch accounting standard with code: ${code}`,
        'FETCH_ERROR',
        error
      )
    }
  }

  async getActive(): Promise<AccountingStandardInfo[]> {
    const cacheKey = 'active'
    const cached = this.cache.get(cacheKey)

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data
    }

    try {
      const standards = await prisma.accountingStandard.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      })

      const result = standards.map(this.toAccountingStandardInfo)

      this.cache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + this.cacheTTL,
      })

      return result
    } catch (error) {
      throw new AccountingStandardServiceError(
        'Failed to fetch active accounting standards',
        'FETCH_ERROR',
        error
      )
    }
  }

  async initializeSeed(): Promise<void> {
    try {
      const existingCount = await prisma.accountingStandard.count()

      if (existingCount > 0) {
        return
      }

      await prisma.accountingStandard.createMany({
        data: SEED_STANDARDS,
        skipDuplicates: true,
      } as Parameters<typeof prisma.accountingStandard.createMany>[0])
    } catch (error) {
      throw new AccountingStandardServiceError(
        'Failed to initialize seed data',
        'SEED_ERROR',
        error
      )
    }
  }

  clearCache(): void {
    this.cache.clear()
  }

  private toAccountingStandardInfo(
    standard: Awaited<ReturnType<typeof prisma.accountingStandard.findFirst>> & {
      code: string
      name: string
      nameEn: string
      countryCode: string
    }
  ): AccountingStandardInfo {
    return {
      code: standard.code as AccountingStandard,
      name: standard.name,
      nameEn: standard.nameEn,
      description: standard.description ?? undefined,
      countryCode: standard.countryCode,
    }
  }
}

export const accountingStandardService = new AccountingStandardService()
