import { NextRequest, NextResponse } from 'next/server'
import { TaxService } from '@/services/tax/tax-service'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const schedule = await TaxService.getTaxScheduleById(params.id)

    if (!schedule) {
      return NextResponse.json({ error: 'Tax schedule not found' }, { status: 404 })
    }

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('Error fetching tax schedule:', error)
    return NextResponse.json({ error: 'Failed to fetch tax schedule' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()
    const { amount, status, filedDate, paidDate, note } = body

    const schedule = await TaxService.updateTaxSchedule(params.id, {
      amount,
      status,
      filedDate: filedDate ? new Date(filedDate) : undefined,
      paidDate: paidDate ? new Date(paidDate) : undefined,
      note,
    })

    return NextResponse.json(schedule)
  } catch (error) {
    console.error('Error updating tax schedule:', error)
    return NextResponse.json({ error: 'Failed to update tax schedule' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await TaxService.deleteTaxSchedule(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tax schedule:', error)
    return NextResponse.json({ error: 'Failed to delete tax schedule' }, { status: 500 })
  }
}
