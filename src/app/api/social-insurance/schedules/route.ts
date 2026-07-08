import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateSession } from '@/lib/auth'
import { ScheduleManager } from '@/services/social-insurance'
import { logRouteAudit } from '@/lib/route-audit'

const schedulesQuerySchema = z.object({
  insuranceType: z.enum(['health', 'pension', 'employment', 'work_accident', 'care']).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'OVERDUE']).optional(),
})

const createScheduleSchema = z.object({
  insuranceType: z.enum(['health', 'pension', 'employment', 'work_accident', 'care']),
  taskName: z.string().min(1),
  dueDate: z.coerce.date(),
  notes: z.string().optional(),
})

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
    const query = schedulesQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!query.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: query.error.flatten() },
        { status: 400 }
      )
    }

    const schedules = await ScheduleManager.getSchedules(user.companyId, {
      insuranceType: query.data.insuranceType,
      status: query.data.status,
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

    const parsed = createScheduleSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const schedule = await ScheduleManager.createSchedule({
      companyId: user.companyId,
      ...parsed.data,
    })

    await logRouteAudit({
      request,
      userId: user.id,
      action: 'SOCIAL_INSURANCE_SCHEDULE_CREATE',
      resource: 'social_insurance_schedule',
      resourceId: schedule.id,
    })

    return NextResponse.json(schedule, { status: 201 })
  } catch (error) {
    await logRouteAudit({
      request,
      action: 'SOCIAL_INSURANCE_SCHEDULE_CREATE',
      resource: 'social_insurance_schedule',
      result: 'FAILURE',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    })
    console.error('Error creating social insurance schedule:', error)
    return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
  }
}
