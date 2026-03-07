import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyId = user.companyId

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
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyId = user.companyId
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
