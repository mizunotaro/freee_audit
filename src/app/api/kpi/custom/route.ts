import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { withRateLimit } from '@/lib/security'
import {
  getCustomKPIs,
  createCustomKPI,
  updateCustomKPI,
  deleteCustomKPI,
  updateKPIVisibility,
  updateKPIOrder,
  initializeDefaultKPIs,
  validateFormula,
  type CustomKPIInput,
} from '@/services/kpi/custom-kpi-service'

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
    const kpis = await getCustomKPIs(companyId)
    return NextResponse.json({ kpis })
  }

  if (request.method === 'POST') {
    const body = await request.json()

    if (body.action === 'initialize') {
      const count = await initializeDefaultKPIs(companyId)
      return NextResponse.json({ success: true, count })
    }

    if (body.action === 'updateOrder') {
      await updateKPIOrder(body.updates)
      return NextResponse.json({ success: true })
    }

    if (body.action === 'updateVisibility') {
      await updateKPIVisibility(body.id, body.isVisible)
      return NextResponse.json({ success: true })
    }

    if (body.action === 'validate') {
      const result = validateFormula(body.formula)
      return NextResponse.json(result)
    }

    const data: CustomKPIInput = {
      name: body.name,
      formula: body.formula,
      category: body.category,
      unit: body.unit,
      targetValue: body.targetValue,
      isVisible: body.isVisible,
    }

    if (!data.name || !data.formula || !data.category || !data.unit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const validation = validateFormula(data.formula)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const kpi = await createCustomKPI(companyId, data)
    return NextResponse.json({ kpi })
  }

  if (request.method === 'PUT') {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'Missing KPI ID' }, { status: 400 })
    }

    if (body.formula) {
      const validation = validateFormula(body.formula)
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 })
      }
    }

    const kpi = await updateCustomKPI(body.id, body)
    return NextResponse.json({ kpi })
  }

  if (request.method === 'DELETE') {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing KPI ID' }, { status: 400 })
    }

    await deleteCustomKPI(id)
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export const GET = withRateLimit(handler, { windowMs: 60000, maxRequests: 60 })
export const POST = withRateLimit(handler, { windowMs: 60000, maxRequests: 30 })
export const PUT = withRateLimit(handler, { windowMs: 60000, maxRequests: 30 })
export const DELETE = withRateLimit(handler, { windowMs: 60000, maxRequests: 30 })
