import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

async function getCompanyId(_request: NextRequest): Promise<string> {
  const companies = await prisma.company.findMany({ take: 1 })
  if (companies.length > 0) {
    return companies[0].id
  }
  const company = await prisma.company.create({
    data: {
      name: 'Default Company',
      fiscalYearStart: 1,
    },
  })
  return company.id
}

export async function GET(request: NextRequest) {
  try {
    const companyId = await getCompanyId(request)

    let settings = await prisma.taxSettings.findUnique({
      where: { companyId },
    })

    if (!settings) {
      settings = await prisma.taxSettings.create({
        data: {
          companyId,
          withholdingSpecialRule: false,
          withholdingEmployeeCount: 0,
          fiscalYearStart: 1,
          consumptionTaxable: true,
          taxFilingMethod: 'BLUE',
        },
      })
    }

    return NextResponse.json(settings)
  } catch (error) {
    console.error('Failed to fetch tax settings:', error)
    return NextResponse.json({ error: 'Failed to fetch tax settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const companyId = await getCompanyId(request)
    const body = await request.json()

    const data = {
      withholdingSpecialRule: body.withholdingSpecialRule ?? false,
      withholdingEmployeeCount: body.withholdingEmployeeCount ?? 0,
      fiscalYearStart: body.fiscalYearStart ?? 1,
      consumptionTaxable: body.consumptionTaxable ?? true,
      taxFilingMethod: body.taxFilingMethod ?? 'BLUE',
    }

    const settings = await prisma.taxSettings.upsert({
      where: { companyId },
      update: data,
      create: {
        companyId,
        ...data,
      },
    })

    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('Failed to save tax settings:', error)
    return NextResponse.json({ error: 'Failed to save tax settings' }, { status: 500 })
  }
}
