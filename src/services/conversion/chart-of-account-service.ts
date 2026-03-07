import { prisma } from '@/lib/db'
import type {
  ChartOfAccounts,
  ChartOfAccountItem,
  AccountCategory,
  AccountingStandard,
} from '@/types/conversion'
import {
  COAImporter,
  type ImportParseResult,
  type ParsedCOAItem,
} from '@/lib/conversion/coa-importer'
import { COAValidator, type ValidationResult } from '@/lib/conversion/coa-validator'

export interface CreateCOAInput {
  companyId: string
  standardId: string
  name: string
  description?: string
  items?: CreateCOAItemInput[]
}

export interface CreateCOAItemInput {
  code: string
  name: string
  nameEn: string
  category: AccountCategory
  subcategory?: string
  normalBalance: 'debit' | 'credit'
  parentId?: string
  parentCode?: string
  isConvertible?: boolean
}

export interface UpdateCOAInput {
  name?: string
  description?: string
  isActive?: boolean
}

export interface UpdateCOAItemInput {
  name?: string
  nameEn?: string
  category?: AccountCategory
  subcategory?: string
  normalBalance?: 'debit' | 'credit'
  parentId?: string
  isConvertible?: boolean
}

export interface ImportResult {
  success: boolean
  imported: number
  skipped: number
  errors: ImportError[]
}

export interface ImportError {
  row: number
  code: string
  message: string
  field?: string
}

export interface COATemplate {
  id: string
  standardId: string
  standardCode: string
  name: string
  description: string
  itemCount: number
}

const DEFAULT_TEMPLATES: COATemplate[] = [
  {
    id: 'template-jgaap-standard',
    standardId: 'jgaap',
    standardCode: 'JGAAP',
    name: '日本基準 標準勘定科目表',
    description: '一般的な日本企業向けの標準的な勘定科目表',
    itemCount: 150,
  },
  {
    id: 'template-usgaap-standard',
    standardId: 'usgaap',
    standardCode: 'USGAAP',
    name: 'US GAAP Standard Chart',
    description: 'Standard chart of accounts for US GAAP reporting',
    itemCount: 180,
  },
  {
    id: 'template-ifrs-standard',
    standardId: 'ifrs',
    standardCode: 'IFRS',
    name: 'IFRS Standard Chart',
    description: 'Standard chart of accounts for IFRS reporting',
    itemCount: 170,
  },
]

export class ChartOfAccountService {
  private importer: COAImporter
  private validator: COAValidator

  constructor() {
    this.importer = new COAImporter()
    this.validator = new COAValidator()
  }

  async create(input: CreateCOAInput): Promise<ChartOfAccounts> {
    const standard = await prisma.accountingStandard.findUnique({
      where: { id: input.standardId },
    })

    if (!standard) {
      throw new Error(`Accounting standard not found: ${input.standardId}`)
    }

    const existingCOA = await prisma.chartOfAccount.findFirst({
      where: {
        companyId: input.companyId,
        standardId: input.standardId,
        name: input.name,
      },
    })

    if (existingCOA) {
      throw new Error(`COA with name "${input.name}" already exists for this standard`)
    }

    const coa = await prisma.chartOfAccount.create({
      data: {
        companyId: input.companyId,
        standardId: input.standardId,
        name: input.name,
        description: input.description,
        version: 1,
        isActive: true,
        isDefault: false,
      },
      include: {
        items: true,
        standard: true,
      },
    })

    if (input.items && input.items.length > 0) {
      await this.createItems(coa.id, input.items)
    }

    return this.getById(coa.id) as Promise<ChartOfAccounts>
  }

  async getById(id: string): Promise<ChartOfAccounts | null> {
    const coa = await prisma.chartOfAccount.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
        },
        standard: true,
      },
    })

    if (!coa) return null

    return this.mapToChartOfAccounts(coa)
  }

  async getByCompany(companyId: string): Promise<ChartOfAccounts[]> {
    const coas = await prisma.chartOfAccount.findMany({
      where: { companyId },
      include: {
        items: {
          orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
        },
        standard: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return coas.map((coa) => this.mapToChartOfAccounts(coa))
  }

  async update(id: string, data: UpdateCOAInput): Promise<ChartOfAccounts> {
    const coa = await prisma.chartOfAccount.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
      },
      include: {
        items: {
          orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
        },
        standard: true,
      },
    })

    return this.mapToChartOfAccounts(coa)
  }

  async delete(id: string): Promise<void> {
    const hasMappings = await prisma.accountMapping.count({
      where: {
        OR: [{ sourceCoaId: id }, { targetCoaId: id }],
      },
    })

    if (hasMappings > 0) {
      throw new Error('Cannot delete COA with existing account mappings')
    }

    const hasProjects = await prisma.conversionProject.count({
      where: { targetCoaId: id },
    })

    if (hasProjects > 0) {
      throw new Error('Cannot delete COA used in conversion projects')
    }

    await prisma.chartOfAccount.delete({
      where: { id },
    })
  }

  async addItem(coaId: string, input: CreateCOAItemInput): Promise<ChartOfAccountItem> {
    const coa = await prisma.chartOfAccount.findUnique({
      where: { id: coaId },
      include: { items: true },
    })

    if (!coa) {
      throw new Error(`COA not found: ${coaId}`)
    }

    const existingItem = coa.items.find((item) => item.code === input.code)
    if (existingItem) {
      throw new Error(`Item with code "${input.code}" already exists in this COA`)
    }

    const level = await this.calculateLevel(coaId, input.parentId)

    const maxSortOrder = await prisma.chartOfAccountItem.aggregate({
      where: { coaId },
      _max: { sortOrder: true },
    })

    const item = await prisma.chartOfAccountItem.create({
      data: {
        coaId,
        code: input.code,
        name: input.name,
        nameEn: input.nameEn,
        category: input.category,
        subcategory: input.subcategory,
        normalBalance: input.normalBalance,
        parentId: input.parentId,
        level,
        sortOrder: (maxSortOrder._max.sortOrder || 0) + 1,
        isConvertible: input.isConvertible ?? true,
      },
    })

    return this.mapToChartOfAccountItem(item)
  }

  async updateItem(itemId: string, data: UpdateCOAItemInput): Promise<ChartOfAccountItem> {
    const item = await prisma.chartOfAccountItem.update({
      where: { id: itemId },
      data: {
        name: data.name,
        nameEn: data.nameEn,
        category: data.category,
        subcategory: data.subcategory,
        normalBalance: data.normalBalance,
        parentId: data.parentId,
        isConvertible: data.isConvertible,
      },
    })

    return this.mapToChartOfAccountItem(item)
  }

  async deleteItem(itemId: string): Promise<void> {
    const children = await prisma.chartOfAccountItem.count({
      where: { parentId: itemId },
    })

    if (children > 0) {
      throw new Error('Cannot delete item with child items')
    }

    const hasMappings = await prisma.accountMapping.count({
      where: {
        OR: [{ sourceItemId: itemId }, { targetItemId: itemId }],
      },
    })

    if (hasMappings > 0) {
      throw new Error('Cannot delete item with existing mappings')
    }

    await prisma.chartOfAccountItem.delete({
      where: { id: itemId },
    })
  }

  async reorderItems(coaId: string, itemIds: string[]): Promise<void> {
    await prisma.$transaction(
      itemIds.map((id, index) =>
        prisma.chartOfAccountItem.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    )
  }

  async importFromCSV(companyId: string, standardId: string, file: File): Promise<ImportResult> {
    const parseResult = await this.importer.parseCSV(file)

    if (!parseResult.success) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        errors: parseResult.errors,
      }
    }

    return this.importItems(companyId, standardId, parseResult)
  }

  async importFromExcel(companyId: string, standardId: string, file: File): Promise<ImportResult> {
    const parseResult = await this.importer.parseExcel(file)

    if (!parseResult.success) {
      return {
        success: false,
        imported: 0,
        skipped: 0,
        errors: parseResult.errors,
      }
    }

    return this.importItems(companyId, standardId, parseResult)
  }

  private async importItems(
    companyId: string,
    standardId: string,
    parseResult: ImportParseResult
  ): Promise<ImportResult> {
    const coa = await prisma.chartOfAccount.findFirst({
      where: { companyId, standardId },
    })

    if (!coa) {
      throw new Error(`No COA found for company ${companyId} and standard ${standardId}`)
    }

    const existingItems = await prisma.chartOfAccountItem.findMany({
      where: { coaId: coa.id },
    })

    const existingCodes = new Set(existingItems.map((item) => item.code))
    const codeToIdMap = new Map<string, string>()
    existingItems.forEach((item) => codeToIdMap.set(item.code, item.id))

    const itemsToCreate: ParsedCOAItem[] = []
    const errors: ImportError[] = [...parseResult.errors]
    let imported = 0
    let skipped = 0

    for (const item of parseResult.items) {
      if (existingCodes.has(item.code)) {
        skipped++
        continue
      }
      itemsToCreate.push(item)
    }

    const sortedItems = this.sortByDependency(itemsToCreate)
    const newCodeToIdMap = new Map<string, string>()

    await prisma.$transaction(async (tx) => {
      for (const item of sortedItems) {
        let parentId: string | undefined

        if (item.parentCode) {
          parentId = codeToIdMap.get(item.parentCode) || newCodeToIdMap.get(item.parentCode)
          if (!parentId) {
            errors.push({
              row: 0,
              code: 'PARENT_NOT_FOUND',
              message: `Parent code not found: ${item.parentCode} for item ${item.code}`,
              field: 'parent_code',
            })
            skipped++
            continue
          }
        }

        const level = this.calculateLevelFromCode(item.code)

        const created = await tx.chartOfAccountItem.create({
          data: {
            coaId: coa.id,
            code: item.code,
            name: item.name,
            nameEn: item.nameEn,
            category: item.category,
            subcategory: item.subcategory,
            normalBalance: item.normalBalance,
            parentId,
            level,
            isConvertible: item.isConvertible,
          },
        })

        newCodeToIdMap.set(item.code, created.id)
        imported++
      }
    })

    return {
      success: errors.length === 0,
      imported,
      skipped,
      errors,
    }
  }

  async getTemplates(): Promise<COATemplate[]> {
    return DEFAULT_TEMPLATES
  }

  async createFromTemplate(companyId: string, templateId: string): Promise<ChartOfAccounts> {
    const template = DEFAULT_TEMPLATES.find((t) => t.id === templateId)

    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    const standard = await prisma.accountingStandard.findFirst({
      where: { code: template.standardCode },
    })

    if (!standard) {
      throw new Error(`Standard not found: ${template.standardCode}`)
    }

    const existingCOA = await prisma.chartOfAccount.findFirst({
      where: {
        companyId,
        standardId: standard.id,
        name: template.name,
      },
    })

    if (existingCOA) {
      return this.getById(existingCOA.id) as Promise<ChartOfAccounts>
    }

    const templateItems = await this.getTemplateItems(templateId)

    const coa = await this.create({
      companyId,
      standardId: standard.id,
      name: template.name,
      description: template.description,
      items: templateItems,
    })

    return coa
  }

  private async getTemplateItems(templateId: string): Promise<CreateCOAItemInput[]> {
    if (templateId === 'template-jgaap-standard') {
      return this.getJGAAPTemplateItems()
    } else if (templateId === 'template-usgaap-standard') {
      return this.getUSGAAPTemplateItems()
    } else if (templateId === 'template-ifrs-standard') {
      return this.getIFRSTemplateItems()
    }

    return []
  }

  private getJGAAPTemplateItems(): CreateCOAItemInput[] {
    return [
      {
        code: '1000',
        name: '現金及び預金',
        nameEn: 'Cash and Cash Equivalents',
        category: 'current_asset',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '1100',
        name: '売掛金',
        nameEn: 'Accounts Receivable',
        category: 'current_asset',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '1200',
        name: '商品',
        nameEn: 'Merchandise Inventory',
        category: 'current_asset',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '1300',
        name: '前払費用',
        nameEn: 'Prepaid Expenses',
        category: 'current_asset',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '2000',
        name: '有形固定資産',
        nameEn: 'Tangible Fixed Assets',
        category: 'fixed_asset',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '2100',
        name: '建物',
        nameEn: 'Buildings',
        category: 'fixed_asset',
        normalBalance: 'debit',
        isConvertible: true,
        parentCode: '2000',
      },
      {
        code: '2200',
        name: '機械装置',
        nameEn: 'Machinery and Equipment',
        category: 'fixed_asset',
        normalBalance: 'debit',
        isConvertible: true,
        parentCode: '2000',
      },
      {
        code: '3000',
        name: '買掛金',
        nameEn: 'Accounts Payable',
        category: 'current_liability',
        normalBalance: 'credit',
        isConvertible: true,
      },
      {
        code: '3100',
        name: '短期借入金',
        nameEn: 'Short-term Loans',
        category: 'current_liability',
        normalBalance: 'credit',
        isConvertible: true,
      },
      {
        code: '4000',
        name: '資本金',
        nameEn: 'Capital Stock',
        category: 'equity',
        normalBalance: 'credit',
        isConvertible: true,
      },
      {
        code: '4100',
        name: '利益剰余金',
        nameEn: 'Retained Earnings',
        category: 'equity',
        normalBalance: 'credit',
        isConvertible: true,
      },
      {
        code: '5000',
        name: '売上高',
        nameEn: 'Revenue',
        category: 'revenue',
        normalBalance: 'credit',
        isConvertible: true,
      },
      {
        code: '6000',
        name: '売上原価',
        nameEn: 'Cost of Goods Sold',
        category: 'cogs',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '7000',
        name: '販売費及び一般管理費',
        nameEn: 'Selling, General and Administrative Expenses',
        category: 'sga_expense',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '8000',
        name: '営業外収益',
        nameEn: 'Non-operating Income',
        category: 'non_operating_income',
        normalBalance: 'credit',
        isConvertible: true,
      },
      {
        code: '9000',
        name: '営業外費用',
        nameEn: 'Non-operating Expenses',
        category: 'non_operating_expense',
        normalBalance: 'debit',
        isConvertible: true,
      },
    ]
  }

  private getUSGAAPTemplateItems(): CreateCOAItemInput[] {
    return [
      {
        code: '1000',
        name: 'Cash and Cash Equivalents',
        nameEn: 'Cash and Cash Equivalents',
        category: 'current_asset',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '1100',
        name: 'Accounts Receivable',
        nameEn: 'Accounts Receivable',
        category: 'current_asset',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '1200',
        name: 'Inventory',
        nameEn: 'Inventory',
        category: 'current_asset',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '1300',
        name: 'Prepaid Expenses',
        nameEn: 'Prepaid Expenses',
        category: 'current_asset',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '2000',
        name: 'Property, Plant and Equipment',
        nameEn: 'Property, Plant and Equipment',
        category: 'fixed_asset',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '3000',
        name: 'Accounts Payable',
        nameEn: 'Accounts Payable',
        category: 'current_liability',
        normalBalance: 'credit',
        isConvertible: true,
      },
      {
        code: '3100',
        name: 'Accrued Expenses',
        nameEn: 'Accrued Expenses',
        category: 'current_liability',
        normalBalance: 'credit',
        isConvertible: true,
      },
      {
        code: '4000',
        name: 'Common Stock',
        nameEn: 'Common Stock',
        category: 'equity',
        normalBalance: 'credit',
        isConvertible: true,
      },
      {
        code: '4100',
        name: 'Retained Earnings',
        nameEn: 'Retained Earnings',
        category: 'equity',
        normalBalance: 'credit',
        isConvertible: true,
      },
      {
        code: '5000',
        name: 'Revenue',
        nameEn: 'Revenue',
        category: 'revenue',
        normalBalance: 'credit',
        isConvertible: true,
      },
      {
        code: '6000',
        name: 'Cost of Goods Sold',
        nameEn: 'Cost of Goods Sold',
        category: 'cogs',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '7000',
        name: 'Operating Expenses',
        nameEn: 'Operating Expenses',
        category: 'sga_expense',
        normalBalance: 'debit',
        isConvertible: true,
      },
    ]
  }

  private getIFRSTemplateItems(): CreateCOAItemInput[] {
    return [
      {
        code: '1000',
        name: 'Cash and Cash Equivalents',
        nameEn: 'Cash and Cash Equivalents',
        category: 'current_asset',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '1100',
        name: 'Trade and Other Receivables',
        nameEn: 'Trade and Other Receivables',
        category: 'current_asset',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '1200',
        name: 'Inventories',
        nameEn: 'Inventories',
        category: 'current_asset',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '2000',
        name: 'Property, Plant and Equipment',
        nameEn: 'Property, Plant and Equipment',
        category: 'fixed_asset',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '2100',
        name: 'Intangible Assets',
        nameEn: 'Intangible Assets',
        category: 'fixed_asset',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '3000',
        name: 'Trade and Other Payables',
        nameEn: 'Trade and Other Payables',
        category: 'current_liability',
        normalBalance: 'credit',
        isConvertible: true,
      },
      {
        code: '4000',
        name: 'Equity',
        nameEn: 'Equity',
        category: 'equity',
        normalBalance: 'credit',
        isConvertible: true,
      },
      {
        code: '5000',
        name: 'Revenue',
        nameEn: 'Revenue',
        category: 'revenue',
        normalBalance: 'credit',
        isConvertible: true,
      },
      {
        code: '6000',
        name: 'Cost of Sales',
        nameEn: 'Cost of Sales',
        category: 'cogs',
        normalBalance: 'debit',
        isConvertible: true,
      },
      {
        code: '7000',
        name: 'Administrative Expenses',
        nameEn: 'Administrative Expenses',
        category: 'sga_expense',
        normalBalance: 'debit',
        isConvertible: true,
      },
    ]
  }

  async validate(coaId: string): Promise<ValidationResult> {
    const coa = await this.getById(coaId)

    if (!coa) {
      return {
        isValid: false,
        errors: [{ code: 'NOT_FOUND', message: `COA not found: ${coaId}` }],
        warnings: [],
      }
    }

    return this.validator.validateCOA({
      ...coa,
      items: coa.items,
    })
  }

  async setAsDefault(coaId: string): Promise<void> {
    const coa = await prisma.chartOfAccount.findUnique({
      where: { id: coaId },
    })

    if (!coa) {
      throw new Error(`COA not found: ${coaId}`)
    }

    await prisma.$transaction([
      prisma.chartOfAccount.updateMany({
        where: {
          companyId: coa.companyId,
          standardId: coa.standardId,
          isDefault: true,
        },
        data: { isDefault: false },
      }),
      prisma.chartOfAccount.update({
        where: { id: coaId },
        data: { isDefault: true },
      }),
    ])
  }

  private async createItems(coaId: string, items: CreateCOAItemInput[]): Promise<void> {
    const sortedItems = this.sortByDependency(items)

    const codeToIdMap = new Map<string, string>()

    for (const item of sortedItems) {
      let parentId: string | undefined

      if (item.parentCode) {
        parentId = codeToIdMap.get(item.parentCode)
      } else if (item.parentId) {
        parentId = item.parentId
      }

      const level = await this.calculateLevel(coaId, parentId)

      const created = await prisma.chartOfAccountItem.create({
        data: {
          coaId,
          code: item.code,
          name: item.name,
          nameEn: item.nameEn,
          category: item.category,
          subcategory: item.subcategory,
          normalBalance: item.normalBalance,
          parentId,
          level,
          isConvertible: item.isConvertible ?? true,
        },
      })

      codeToIdMap.set(item.code, created.id)
    }
  }

  private async calculateLevel(coaId: string, parentId?: string): Promise<number> {
    if (!parentId) return 0

    const parent = await prisma.chartOfAccountItem.findUnique({
      where: { id: parentId },
    })

    if (!parent) return 0

    return parent.level + 1
  }

  private calculateLevelFromCode(code: string): number {
    const parts = code.split(/[-_.]/)
    return Math.max(0, parts.length - 1)
  }

  private sortByDependency<T extends { code: string; parentCode?: string }>(items: T[]): T[] {
    const codeSet = new Set(items.map((item) => item.code))
    const sorted: T[] = []
    const remaining = [...items]

    while (remaining.length > 0) {
      const readyItems = remaining.filter(
        (item) =>
          !item.parentCode ||
          codeSet.has(item.parentCode) === false ||
          sorted.some((s) => s.code === item.parentCode)
      )

      if (readyItems.length === 0) {
        sorted.push(...remaining)
        break
      }

      for (const item of readyItems) {
        sorted.push(item)
        const index = remaining.indexOf(item)
        remaining.splice(index, 1)
      }
    }

    return sorted
  }

  private mapToChartOfAccounts(coa: {
    id: string
    companyId: string
    standard: { code: string }
    name: string
    description: string | null
    version: number
    isActive: boolean
    items: Array<{
      id: string
      code: string
      name: string
      nameEn: string
      category: string
      subcategory: string | null
      normalBalance: string
      parentId: string | null
      level: number
      isConvertible: boolean
      metadata: string | null
    }>
    createdAt: Date
    updatedAt: Date
  }): ChartOfAccounts {
    return {
      id: coa.id,
      companyId: coa.companyId,
      standard: coa.standard.code as AccountingStandard,
      name: coa.name,
      description: coa.description || undefined,
      items: coa.items.map((item) => this.mapToChartOfAccountItem(item)),
      version: coa.version,
      isActive: coa.isActive,
      createdAt: coa.createdAt,
      updatedAt: coa.updatedAt,
    }
  }

  private mapToChartOfAccountItem(item: {
    id: string
    code: string
    name: string
    nameEn: string
    category: string
    subcategory: string | null
    normalBalance: string
    parentId: string | null
    level: number
    isConvertible: boolean
    metadata: string | null
  }): ChartOfAccountItem {
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      nameEn: item.nameEn,
      standard: 'JGAAP',
      category: item.category as AccountCategory,
      subcategory: item.subcategory || undefined,
      normalBalance: item.normalBalance as 'debit' | 'credit',
      parentId: item.parentId || undefined,
      level: item.level,
      isConvertible: item.isConvertible,
      metadata: item.metadata ? JSON.parse(item.metadata) : undefined,
    }
  }
}

export const chartOfAccountService = new ChartOfAccountService()
