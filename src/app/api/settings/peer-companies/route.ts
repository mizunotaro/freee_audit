import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { validateSession } from '@/lib/auth'

const listPeersQuerySchema = z.object({
  activeOnly: z.string().optional(),
  industry: z.string().optional(),
})

const createPeerSchema = z.object({
  ticker: z.string().nullable().optional(),
  name: z.string().min(1),
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
  dataSource: z.string().optional(),
  sourceUrl: z.string().nullable().optional(),
})

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
    const query = listPeersQuerySchema.safeParse(Object.fromEntries(searchParams))
    if (!query.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters', details: query.error.flatten() },
        { status: 400 }
      )
    }
    const activeOnly = query.data.activeOnly === 'true'
    const industry = query.data.industry ?? undefined

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

    const parsed = createPeerSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

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
    } = parsed.data

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
