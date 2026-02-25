import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateSession } from '@/lib/auth'
import { withRateLimit } from '@/lib/security'

async function handler(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const user = await validateSession(token)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Invalid session' }, { status: 401 })
  }

  if (req.method === 'GET') {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get('companyId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!companyId) {
      return NextResponse.json({ success: false, error: 'companyId is required' }, { status: 400 })
    }

    const where: Record<string, unknown> = { companyId }

    if (startDate || endDate) {
      where.entryDate = {} as Record<string, Date>
      if (startDate) (where.entryDate as Record<string, Date>).gte = new Date(startDate)
      if (endDate) (where.entryDate as Record<string, Date>).lte = new Date(endDate)
    }

    const journals = await prisma.journal.findMany({
      where,
      orderBy: { entryDate: 'desc' },
      take: 100,
    })

    return NextResponse.json({ success: true, data: journals })
  }

  return NextResponse.json({ success: false, error: 'Method not allowed' }, { status: 405 })
}

export const GET = withRateLimit(handler, { windowMs: 60000, maxRequests: 60 })
