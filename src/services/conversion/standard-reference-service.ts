import { prisma } from '@/lib/db'
import type { AccountingStandard, StandardReference, ReferenceType } from '@/types/conversion'

export interface SearchParams {
  standard?: AccountingStandard
  query?: string
  keywords?: string[]
  includeSuperseded?: boolean
}

const STANDARD_REFERENCES_SEED = [
  {
    standard: 'JGAAP',
    referenceType: 'ASBJ_statement' as ReferenceType,
    referenceNumber: '会計基準第14号',
    title: 'リース取引に関する会計基準',
    titleEn: 'Accounting Standard for Lease Transactions',
    keywords: JSON.stringify(['リース', '賃貸借', 'オペレーティングリース', 'ファイナンスリース']),
  },
  {
    standard: 'JGAAP',
    referenceType: 'ASBJ_statement' as ReferenceType,
    referenceNumber: '会計基準第26号',
    title: '収益認識に関する会計基準',
    titleEn: 'Accounting Standard for Revenue Recognition',
    keywords: JSON.stringify(['収益認識', '売上', '契約', '履行義務']),
  },
  {
    standard: 'JGAAP',
    referenceType: 'ASBJ_statement' as ReferenceType,
    referenceNumber: '会計基準第17号',
    title: '研究開発費に関する会計基準',
    titleEn: 'Accounting Standard for Research and Development Expenses',
    keywords: JSON.stringify(['研究開発', 'R&D', 'のれん']),
  },
  {
    standard: 'JGAAP',
    referenceType: 'ASBJ_guidance' as ReferenceType,
    referenceNumber: '適用指針第26号',
    title: '収益認識に関する会計基準の適用指針',
    titleEn: 'Guidance on Application of Accounting Standard for Revenue Recognition',
    keywords: JSON.stringify(['収益認識', '適用指針', '売上']),
  },
  {
    standard: 'JGAAP',
    referenceType: 'JICPA_guideline' as ReferenceType,
    referenceNumber: '実務対応報告第26号',
    title: '退職給付債務の会計処理に関する実務対応報告',
    titleEn: 'Practical Report on Accounting for Retirement Benefit Obligations',
    keywords: JSON.stringify(['退職給付', '年金', '退職金']),
  },
  {
    standard: 'USGAAP',
    referenceType: 'ASC_topic' as ReferenceType,
    referenceNumber: 'ASC 606',
    title: 'Revenue from Contracts with Customers',
    titleEn: 'Revenue from Contracts with Customers',
    keywords: JSON.stringify(['revenue', 'contract', 'customer', 'performance obligation']),
  },
  {
    standard: 'USGAAP',
    referenceType: 'ASC_topic' as ReferenceType,
    referenceNumber: 'ASC 842',
    title: 'Leases',
    titleEn: 'Leases',
    keywords: JSON.stringify(['lease', 'operating lease', 'finance lease', 'ROU asset']),
  },
  {
    standard: 'USGAAP',
    referenceType: 'ASC_topic' as ReferenceType,
    referenceNumber: 'ASC 805',
    title: 'Business Combinations',
    titleEn: 'Business Combinations',
    keywords: JSON.stringify(['business combination', 'goodwill', 'acquisition', 'consolidation']),
  },
  {
    standard: 'USGAAP',
    referenceType: 'ASC_topic' as ReferenceType,
    referenceNumber: 'ASC 740',
    title: 'Income Taxes',
    titleEn: 'Income Taxes',
    keywords: JSON.stringify(['income tax', 'deferred tax', 'tax asset', 'tax liability']),
  },
  {
    standard: 'USGAAP',
    referenceType: 'ASC_topic' as ReferenceType,
    referenceNumber: 'ASC 815',
    title: 'Derivatives and Hedging',
    titleEn: 'Derivatives and Hedging',
    keywords: JSON.stringify(['derivative', 'hedge', 'forward', 'option', 'swap']),
  },
  {
    standard: 'IFRS',
    referenceType: 'IFRS_standard' as ReferenceType,
    referenceNumber: 'IFRS 15',
    title: 'Revenue from Contracts with Customers',
    titleEn: 'Revenue from Contracts with Customers',
    keywords: JSON.stringify(['revenue', 'contract', 'customer', 'performance obligation']),
  },
  {
    standard: 'IFRS',
    referenceType: 'IFRS_standard' as ReferenceType,
    referenceNumber: 'IFRS 16',
    title: 'Leases',
    titleEn: 'Leases',
    keywords: JSON.stringify(['lease', 'lessee', 'lessor', 'right-of-use']),
  },
  {
    standard: 'IFRS',
    referenceType: 'IFRS_standard' as ReferenceType,
    referenceNumber: 'IFRS 3',
    title: 'Business Combinations',
    titleEn: 'Business Combinations',
    keywords: JSON.stringify([
      'business combination',
      'goodwill',
      'acquisition',
      'bargain purchase',
    ]),
  },
  {
    standard: 'IFRS',
    referenceType: 'IFRS_standard' as ReferenceType,
    referenceNumber: 'IFRS 9',
    title: 'Financial Instruments',
    titleEn: 'Financial Instruments',
    keywords: JSON.stringify([
      'financial instrument',
      'impairment',
      'hedge accounting',
      'classification',
    ]),
  },
  {
    standard: 'IFRS',
    referenceType: 'IAS_standard' as ReferenceType,
    referenceNumber: 'IAS 12',
    title: 'Income Taxes',
    titleEn: 'Income Taxes',
    keywords: JSON.stringify(['income tax', 'deferred tax', 'tax base', 'temporary difference']),
  },
  {
    standard: 'IFRS',
    referenceType: 'IAS_standard' as ReferenceType,
    referenceNumber: 'IAS 19',
    title: 'Employee Benefits',
    titleEn: 'Employee Benefits',
    keywords: JSON.stringify(['employee benefit', 'pension', 'retirement', 'post-employment']),
  },
  {
    standard: 'IFRS',
    referenceType: 'IAS_standard' as ReferenceType,
    referenceNumber: 'IAS 21',
    title: 'The Effects of Changes in Foreign Exchange Rates',
    titleEn: 'The Effects of Changes in Foreign Exchange Rates',
    keywords: JSON.stringify([
      'foreign currency',
      'exchange rate',
      'functional currency',
      'translation',
    ]),
  },
]

export class StandardReferenceService {
  async search(params: SearchParams): Promise<StandardReference[]> {
    const where: Record<string, unknown> = {}

    if (params.standard) {
      where.standard = params.standard
    }

    if (!params.includeSuperseded) {
      where.isActive = true
    }

    const references = await prisma.standardReference.findMany({
      where,
      orderBy: [{ standard: 'asc' }, { referenceNumber: 'asc' }],
    })

    let results = references.map(this.mapToStandardReference)

    if (params.query) {
      const query = params.query.toLowerCase()
      results = results.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.titleEn?.toLowerCase().includes(query) ||
          r.referenceNumber.toLowerCase().includes(query) ||
          r.description?.toLowerCase().includes(query)
      )
    }

    if (params.keywords && params.keywords.length > 0) {
      results = results.filter((r) => {
        if (!r.keywords) return false
        return params.keywords!.some((k) =>
          r.keywords!.some((rk) => rk.toLowerCase().includes(k.toLowerCase()))
        )
      })
    }

    return results
  }

  async getByNumber(
    standard: AccountingStandard,
    referenceNumber: string
  ): Promise<StandardReference | null> {
    const reference = await prisma.standardReference.findUnique({
      where: {
        standard_referenceNumber: {
          standard,
          referenceNumber,
        },
      },
    })

    if (!reference) return null

    return this.mapToStandardReference(reference)
  }

  async findByKeywords(keywords: string[]): Promise<StandardReference[]> {
    if (keywords.length === 0) return []

    const references = await prisma.standardReference.findMany({
      where: {
        isActive: true,
      },
    })

    return references.map(this.mapToStandardReference).filter((r) => {
      if (!r.keywords) return false
      return keywords.some((k) =>
        r.keywords!.some((rk) => rk.toLowerCase().includes(k.toLowerCase()))
      )
    })
  }

  async getActive(standard: AccountingStandard): Promise<StandardReference[]> {
    const references = await prisma.standardReference.findMany({
      where: {
        standard,
        isActive: true,
      },
      orderBy: [{ referenceNumber: 'asc' }],
    })

    return references.map(this.mapToStandardReference)
  }

  async getById(id: string): Promise<StandardReference | null> {
    const reference = await prisma.standardReference.findUnique({
      where: { id },
    })

    if (!reference) return null

    return this.mapToStandardReference(reference)
  }

  async getByNumbers(
    numbers: string[],
    standard?: AccountingStandard
  ): Promise<StandardReference[]> {
    if (numbers.length === 0) return []

    const where: Record<string, unknown> = {
      referenceNumber: { in: numbers },
    }

    if (standard) {
      where.standard = standard
    }

    const references = await prisma.standardReference.findMany({
      where,
    })

    return references.map(this.mapToStandardReference)
  }

  async initializeSeed(): Promise<void> {
    const existingCount = await prisma.standardReference.count()

    if (existingCount > 0) {
      return
    }

    for (const seed of STANDARD_REFERENCES_SEED) {
      try {
        await prisma.standardReference.create({
          data: seed,
        })
      } catch {
        // Skip duplicates
      }
    }
  }

  async create(data: {
    standard: AccountingStandard
    referenceType: ReferenceType
    referenceNumber: string
    title: string
    titleEn?: string
    description?: string
    descriptionEn?: string
    effectiveDate?: Date
    officialUrl?: string
    keywords?: string[]
  }): Promise<StandardReference> {
    const reference = await prisma.standardReference.create({
      data: {
        standard: data.standard,
        referenceType: data.referenceType,
        referenceNumber: data.referenceNumber,
        title: data.title,
        titleEn: data.titleEn,
        description: data.description,
        descriptionEn: data.descriptionEn,
        effectiveDate: data.effectiveDate,
        officialUrl: data.officialUrl,
        keywords: data.keywords ? JSON.stringify(data.keywords) : null,
      },
    })

    return this.mapToStandardReference(reference)
  }

  async update(
    id: string,
    data: {
      title?: string
      titleEn?: string
      description?: string
      descriptionEn?: string
      effectiveDate?: Date
      supersededDate?: Date
      isActive?: boolean
      officialUrl?: string
      keywords?: string[]
    }
  ): Promise<StandardReference> {
    const reference = await prisma.standardReference.update({
      where: { id },
      data: {
        title: data.title,
        titleEn: data.titleEn,
        description: data.description,
        descriptionEn: data.descriptionEn,
        effectiveDate: data.effectiveDate,
        supersededDate: data.supersededDate,
        isActive: data.isActive,
        officialUrl: data.officialUrl,
        keywords: data.keywords ? JSON.stringify(data.keywords) : undefined,
      },
    })

    return this.mapToStandardReference(reference)
  }

  private mapToStandardReference(reference: {
    id: string
    standard: string
    referenceType: string
    referenceNumber: string
    title: string
    titleEn: string | null
    description: string | null
    descriptionEn: string | null
    effectiveDate: Date | null
    supersededDate: Date | null
    isActive: boolean
    officialUrl: string | null
    keywords: string | null
  }): StandardReference {
    return {
      id: reference.id,
      standard: reference.standard as AccountingStandard,
      referenceType: reference.referenceType as ReferenceType,
      referenceNumber: reference.referenceNumber,
      title: reference.title,
      titleEn: reference.titleEn ?? undefined,
      description: reference.description ?? undefined,
      descriptionEn: reference.descriptionEn ?? undefined,
      effectiveDate: reference.effectiveDate ?? undefined,
      supersededDate: reference.supersededDate ?? undefined,
      isActive: reference.isActive,
      officialUrl: reference.officialUrl ?? undefined,
      keywords: reference.keywords ? JSON.parse(reference.keywords) : undefined,
    }
  }
}

export const standardReferenceService = new StandardReferenceService()
