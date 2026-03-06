import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { prisma } from '@/lib/db'

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
    const reports = await prisma.boardReport.findMany({
      where: { companyId },
      include: {
        sections: {
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: [{ fiscalYear: 'desc' }, { month: 'desc' }],
    })

    return NextResponse.json({ reports })
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export const GET = handler
