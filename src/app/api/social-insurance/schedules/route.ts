import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { ScheduleManager } from '@/services/social-insurance'

async function getCompanyId(): Promise<string> {
  const companies = await prisma.company.findMany({ take: 1 })
  if (companies.length > 0) {
    return companies[0].id
  }
  const company = await prisma.company.create({
    data: { name: 'Default Company', fiscalYearStart: 1 },
  })
  return company.id
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId') || (await getCompanyId())
    const insuranceType = searchParams.get('insuranceType') as any
    const status = searchParams.get('status') as any

    const schedules = await ScheduleManager.getSchedules(companyId, {
      insuranceType: insuranceType || undefined,
      status: status || undefined,
    })

    return NextResponse.json(schedules)
  } catch (error) {
    console.error('Error fetching social insurance schedules:', error)
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const companyId = body.companyId || (await getCompanyId())

    const schedule = await ScheduleManager.createSchedule({
      companyId,
      insuranceType: body.insuranceType,
      taskName: body.taskName,
      dueDate: new Date(body.dueDate),
      notes: body.notes,
    })

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    console.error('Error creating social insurance schedule:', error)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }
}
