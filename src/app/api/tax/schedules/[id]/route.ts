import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { TaxService } from '@/services/tax/tax-service'

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

async function verifyScheduleOwnership(scheduleId: string, companyId: string): Promise<boolean> {
  const schedule = await TaxService.getTaxScheduleById(scheduleId)
  return schedule?.companyId === companyId
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const schedule = await TaxService.getTaxScheduleById(params.id)

    if (!schedule) {
      return NextResponse.json({ error: 'Tax schedule not found' }, { status: 404 })
    }

    if (schedule.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('Error fetching tax schedule:', error)
    return NextResponse.json({ error: 'Failed to fetch tax schedule' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await verifyScheduleOwnership(params.id, user.companyId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { amount, note, status } = body

    const schedule = await TaxService.updateTaxSchedule(params.id, {
      amount,
      note,
      status,
    })

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('Error updating tax schedule:', error)
    return NextResponse.json({ error: 'Failed to update tax schedule' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await verifyScheduleOwnership(params.id, user.companyId))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await TaxService.deleteTaxSchedule(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tax schedule:', error)
    return NextResponse.json({ error: 'Failed to delete tax schedule' }, { status: 500 })
  }
}
