import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import { prisma } from '@/lib/db'
import type { ReportTemplateType } from '@/types/reports/business'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { templateType, data } = body as {
      templateType: ReportTemplateType
      data: Record<string, unknown>
    }

    if (!templateType || !data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const companyId = user.companyId
    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 400 })
    }

    const fiscalYear =
      typeof data.fiscalYear === 'number' ? data.fiscalYear : new Date().getFullYear()
    const schemaTemplateType = templateType === 'simple' ? 'simple' : 'keidanren_standard'

    const saved = await prisma.businessReport.upsert({
      where: {
        companyId_fiscalYear_version: {
          companyId,
          fiscalYear,
          version: 1,
        },
      },
      update: {
        templateType: schemaTemplateType,
        content: JSON.stringify(data),
        updatedAt: new Date(),
      },
      create: {
        companyId,
        fiscalYear,
        version: 1,
        templateType: schemaTemplateType,
        content: JSON.stringify(data),
        status: 'draft',
      },
    })

    return NextResponse.json({ success: true, id: saved.id })
  } catch (error) {
    console.error('Error saving business report:', error)
    return NextResponse.json({ error: 'Failed to save business report' }, { status: 500 })
  }
}
