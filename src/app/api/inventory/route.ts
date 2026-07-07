import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
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

const inventoryQuerySchema = z.object({
  action: z.enum(['alerts', 'trend', 'status']).optional(),
  fiscalYear: z.coerce.number().int().min(1).optional(),
  month: z.coerce.number().int().min(0).max(12).optional(),
})

const skipAdjustmentSchema = z.object({
  action: z.literal('skip'),
  fiscalYear: z.coerce.number().int().min(1),
  month: z.coerce.number().int().min(1).max(12),
  reason: z.string().optional(),
})

const createAdjustmentSchema = z.object({
  fiscalYear: z.coerce.number().int().min(1),
  month: z.coerce.number().int().min(1).max(12),
  openingBalance: z.coerce.number(),
  closingBalance: z.coerce.number(),
})

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
    const query = inventoryQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!query.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: query.error.flatten() },
        { status: 400 }
      )
    }
    const action = query.data.action
    const fiscalYear = query.data.fiscalYear
    const month = query.data.month

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

    if (body?.action === 'skip') {
      const parsed = skipAdjustmentSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: parsed.error.flatten() },
          { status: 400 }
        )
      }
      await skipInventoryAdjustment(
        companyId,
        parsed.data.fiscalYear,
        parsed.data.month,
        parsed.data.reason || ''
      )
      return NextResponse.json({ success: true })
    }

    const parsed = createAdjustmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data: InventoryAdjustmentData = {
      companyId,
      fiscalYear: parsed.data.fiscalYear,
      month: parsed.data.month,
      openingBalance: parsed.data.openingBalance,
      closingBalance: parsed.data.closingBalance,
    }

    const result = await createInventoryAdjustment(data)
    return NextResponse.json({ adjustment: result })
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export const GET = withRateLimit(handler, { windowMs: 60000, maxRequests: 60 })
export const POST = withRateLimit(handler, { windowMs: 60000, maxRequests: 30 })
