import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateSession } from '@/lib/auth'

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user?.companyId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'
    const industry = searchParams.get('industry') ?? undefined

    const peers = await prisma.peerCompany.findMany({
      where: {
        companyId: user.companyId,
        ...(activeOnly && { isActive: true }),
        ...(industry && { industry }),
      },
      orderBy: [{ similarityScore: 'desc' }, { name: 'asc' }],
    })

    return NextResponse.json({ success: true, data: peers })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user?.companyId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      ticker,
      name,
      nameEn,
      exchange,
      industry,
      marketCap,
      revenue,
      employees,
      per,
      pbr,
      evEbitda,
      psr,
      beta,
      similarityScore,
      dataSource,
      sourceUrl,
    } = body

    if (!name) {
      return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
    }

    if (ticker) {
      const existing = await prisma.peerCompany.findUnique({
        where: {
          companyId_ticker: {
            companyId: user.companyId,
            ticker,
          },
        },
      })
      if (existing) {
        return NextResponse.json(
          { success: false, error: 'Peer company with this ticker already exists' },
          { status: 409 }
        )
      }
    }

    const peer = await prisma.peerCompany.create({
      data: {
        companyId: user.companyId,
        ticker: ticker ?? null,
        name,
        nameEn: nameEn ?? null,
        exchange: exchange ?? null,
        industry: industry ?? null,
        marketCap: marketCap ?? null,
        revenue: revenue ?? null,
        employees: employees ?? null,
        per: per ?? null,
        pbr: pbr ?? null,
        evEbitda: evEbitda ?? null,
        psr: psr ?? null,
        beta: beta ?? null,
        similarityScore: similarityScore ?? null,
        dataSource: dataSource ?? 'manual',
        sourceUrl: sourceUrl ?? null,
        isActive: true,
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
