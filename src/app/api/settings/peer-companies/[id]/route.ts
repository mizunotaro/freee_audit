import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { validateSession } from '@/lib/auth'
import { logRouteAudit } from '@/lib/route-audit'

const updatePeerSchema = z.object({
  ticker: z.string().nullable().optional(),
  name: z.string().min(1).optional(),
  nameEn: z.string().nullable().optional(),
  exchange: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  marketCap: z.number().nullable().optional(),
  revenue: z.number().nullable().optional(),
  employees: z.number().int().nullable().optional(),
  per: z.number().nullable().optional(),
  pbr: z.number().nullable().optional(),
  evEbitda: z.number().nullable().optional(),
  psr: z.number().nullable().optional(),
  beta: z.number().nullable().optional(),
  similarityScore: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
})

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request)
    if (!user?.companyId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const peer = await prisma.peerCompany.findFirst({
      where: { id, companyId: user.companyId },
    })

    if (!peer) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: peer })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request)
    if (!user?.companyId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const parsed = updatePeerSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const body = parsed.data

    const existing = await prisma.peerCompany.findFirst({
      where: { id, companyId: user.companyId },
    })

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    const peer = await prisma.peerCompany.update({
      where: { id },
      data: {
        ticker: body.ticker ?? existing.ticker,
        name: body.name ?? existing.name,
        nameEn: body.nameEn ?? existing.nameEn,
        exchange: body.exchange ?? existing.exchange,
        industry: body.industry ?? existing.industry,
        marketCap: body.marketCap ?? existing.marketCap,
        revenue: body.revenue ?? existing.revenue,
        employees: body.employees ?? existing.employees,
        per: body.per ?? existing.per,
        pbr: body.pbr ?? existing.pbr,
        evEbitda: body.evEbitda ?? existing.evEbitda,
        psr: body.psr ?? existing.psr,
        beta: body.beta ?? existing.beta,
        similarityScore: body.similarityScore ?? existing.similarityScore,
        isActive: body.isActive ?? existing.isActive,
      },
    })

    await logRouteAudit({
      request,
      userId: user.id,
      action: 'PEER_COMPANY_UPDATE',
      resource: 'peer_company',
      resourceId: id,
    })

    return NextResponse.json({ success: true, data: peer })
  } catch (error) {
    await logRouteAudit({
      request,
      action: 'PEER_COMPANY_UPDATE',
      resource: 'peer_company',
      result: 'FAILURE',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user?.companyId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const existing = await prisma.peerCompany.findFirst({
      where: { id, companyId: user.companyId },
    })

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    await prisma.peerCompany.delete({ where: { id } })

    await logRouteAudit({
      request,
      userId: user.id,
      action: 'PEER_COMPANY_DELETE',
      resource: 'peer_company',
      resourceId: id,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    await logRouteAudit({
      request,
      action: 'PEER_COMPANY_DELETE',
      resource: 'peer_company',
      result: 'FAILURE',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
