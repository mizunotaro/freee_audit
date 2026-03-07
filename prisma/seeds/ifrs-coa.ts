import { PrismaClient } from '@prisma/client'
import { IFRS_COA_TEMPLATE, IFRS_COA_METADATA } from '@/lib/conversion/templates/ifrs-coa-template'

const prisma = new PrismaClient()

export async function seedIFRSCOA(companyId: string): Promise<void> {
  const standard = await prisma.accountingStandard.upsert({
    where: { code: 'IFRS' },
    update: {},
    create: {
      code: 'IFRS',
      name: '国際財務報告基準',
      nameEn: 'International Financial Reporting Standards',
      description: 'International Financial Reporting Standards as issued by the IASB',
      countryCode: 'XX',
      isActive: true,
      sortOrder: 3,
    },
  })

  const existingCoa = await prisma.chartOfAccount.findFirst({
    where: {
      companyId,
      standardId: standard.id,
      isDefault: true,
    },
  })

  if (existingCoa) {
    console.log('IFRS COA already exists for company:', companyId)
    return
  }

  const coa = await prisma.chartOfAccount.create({
    data: {
      companyId,
      standardId: standard.id,
      name: IFRS_COA_METADATA.name,
      description: IFRS_COA_METADATA.description,
      version: IFRS_COA_METADATA.version,
      isActive: true,
      isDefault: true,
    },
  })

  const itemIdMap: Record<string, string> = {}

  for (const item of IFRS_COA_TEMPLATE) {
    const newItemId = item.id.replace('ifrs-', '')
    itemIdMap[item.id] = newItemId

    await prisma.chartOfAccountItem.create({
      data: {
        id: newItemId,
        coaId: coa.id,
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        category: item.category,
        subcategory: item.subcategory,
        normalBalance: item.normalBalance,
        level: item.level,
        isConvertible: item.isConvertible,
        metadata: item.metadata ? JSON.stringify(item.metadata) : null,
      },
    })
  }

  for (const item of IFRS_COA_TEMPLATE) {
    if (item.parentId) {
      await prisma.chartOfAccountItem.update({
        where: { id: itemIdMap[item.id] },
        data: { parentId: itemIdMap[item.parentId] },
      })
    }
  }

  console.log(`Seeded ${IFRS_COA_TEMPLATE.length} IFRS accounts for company:`, companyId)
}

export async function main(): Promise<void> {
  const companies = await prisma.company.findMany()

  for (const company of companies) {
    await seedIFRSCOA(company.id)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
