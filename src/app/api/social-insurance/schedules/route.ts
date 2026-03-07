import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { ScheduleManager } from '@/services/social-insurance'

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

    const { searchParams } = new URL(request.url)
    const insuranceType = searchParams.get('insuranceType') as any
    const status = searchParams.get('status') as any

    const schedules = await ScheduleManager.getSchedules(user.companyId, {
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
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const schedule = await ScheduleManager.createSchedule({
      companyId: user.companyId,
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
