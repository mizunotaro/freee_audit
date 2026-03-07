import { PrismaClient } from '@prisma/client'
import {
  USGAAP_COA_TEMPLATE,
  USGAAP_COA_METADATA,
} from '@/lib/conversion/templates/usgaap-coa-template'

const prisma = new PrismaClient()

export async function seedUSGAAPCOA(companyId: string): Promise<void> {
  const standard = await prisma.accountingStandard.upsert({
    where: { code: 'USGAAP' },
    update: {},
    create: {
      code: 'USGAAP',
      name: '米国会計基準',
      nameEn: 'US Generally Accepted Accounting Principles',
      description: 'United States Generally Accepted Accounting Principles',
      countryCode: 'US',
      isActive: true,
      sortOrder: 2,
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
    console.log('USGAAP COA already exists for company:', companyId)
    return
  }

  const coa = await prisma.chartOfAccount.create({
    data: {
      companyId,
      standardId: standard.id,
      name: USGAAP_COA_METADATA.name,
      description: USGAAP_COA_METADATA.description,
      version: USGAAP_COA_METADATA.version,
      isActive: true,
      isDefault: true,
    },
  })

  const itemIdMap: Record<string, string> = {}

  for (const item of USGAAP_COA_TEMPLATE) {
    const newItemId = item.id.replace('us-', '')
    itemIdMap[item.id] = newItemId

    await prisma.chartOfAccountItem.create({
      data: {
        id: newItemId,
        coaId: coa.id,
        code: item.code,
        name: item.name,
        nameEn: item.nameEn,
        category: item.category,
        subcategory: item.subcategory ?? null,
        normalBalance: item.normalBalance,
        level: item.level,
        isConvertible: item.isConvertible,
        metadata: item.metadata ? JSON.stringify(item.metadata) : null,
      },
    })
  }

  for (const item of USGAAP_COA_TEMPLATE) {
    if (item.parentId) {
      await prisma.chartOfAccountItem.update({
        where: { id: itemIdMap[item.id] },
        data: { parentId: itemIdMap[item.parentId] },
      })
    }
  }

  console.log(`Seeded ${USGAAP_COA_TEMPLATE.length} USGAAP accounts for company:`, companyId)
}

export async function main(): Promise<void> {
  const companies = await prisma.company.findMany()

  for (const company of companies) {
    await seedUSGAAPCOA(company.id)
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
