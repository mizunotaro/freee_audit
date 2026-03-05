import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { withRateLimit } from '@/lib/security'
import {
  checkInventoryAdjustmentStatus,
  getInventoryAdjustments,
  createInventoryAdjustment,
  detectInventoryAlerts,
  analyzeInventoryTrend,
  skipInventoryAdjustment,
  type InventoryAdjustmentData,
} from '@/services/inventory/inventory-adjustment'

async function handler(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await validateSession(token)
  if (!user || !user.companyId) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  const companyId = user.companyId

  if (request.method === 'GET') {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const fiscalYear = parseInt(searchParams.get('fiscalYear') || '0', 10)
    const month = parseInt(searchParams.get('month') || '0', 10)

    if (action === 'alerts' && fiscalYear) {
      const currentMonth = month || new Date().getMonth() + 1
      const alerts = await detectInventoryAlerts(companyId, fiscalYear, currentMonth)
      return NextResponse.json({ alerts })
    }

    if (action === 'trend' && fiscalYear) {
      const trend = await analyzeInventoryTrend(companyId, fiscalYear)
      return NextResponse.json({ trend })
    }

    if (action === 'status' && fiscalYear && month) {
      const result = await checkInventoryAdjustmentStatus(companyId, fiscalYear, month)
      return NextResponse.json(result)
    }

    if (fiscalYear) {
      const adjustments = await getInventoryAdjustments(companyId, fiscalYear)
      return NextResponse.json({ adjustments })
    }

    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }

  if (request.method === 'POST') {
    const body = await request.json()

    if (body.action === 'skip') {
      const { fiscalYear, month } = body
      if (!fiscalYear || !month) {
        return NextResponse.json({ error: 'Missing fiscalYear or month' }, { status: 400 })
      }
      await skipInventoryAdjustment(companyId, fiscalYear, month, body.reason || '')
      return NextResponse.json({ success: true })
    }

    const data: InventoryAdjustmentData = {
      companyId,
      fiscalYear: body.fiscalYear,
      month: body.month,
      openingBalance: body.openingBalance,
      closingBalance: body.closingBalance,
    }

    if (!data.fiscalYear || !data.month) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await createInventoryAdjustment(data)
    return NextResponse.json({ adjustment: result })
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export const GET = withRateLimit(handler, { windowMs: 60000, maxRequests: 60 })
export const POST = withRateLimit(handler, { windowMs: 60000, maxRequests: 30 })
