import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateSession } from '@/lib/auth'

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
    const body = await request.json()

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

    return NextResponse.json({ success: true, data: peer })
  } catch (error) {
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

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
