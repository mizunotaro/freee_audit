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

    const providers = await prisma.marketDataProvider.findMany({
      where: { companyId: user.companyId },
      orderBy: { priority: 'asc' },
    })

    const safeProviders = providers.map((p) => ({
      id: p.id,
      provider: p.provider,
      enabled: p.enabled,
      priority: p.priority,
      lastSyncAt: p.lastSyncAt,
      lastError: p.lastError,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))

    return NextResponse.json({ success: true, data: safeProviders })
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
    const { provider, encryptedEmail, encryptedPassword, encryptedApiKey, enabled, priority } = body

    if (!provider) {
      return NextResponse.json({ success: false, error: 'Provider is required' }, { status: 400 })
    }

    const existing = await prisma.marketDataProvider.findUnique({
      where: {
        companyId_provider: {
          companyId: user.companyId,
          provider,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Provider already configured' },
        { status: 409 }
      )
    }

    const providerRecord = await prisma.marketDataProvider.create({
      data: {
        companyId: user.companyId,
        provider,
        encryptedEmail: encryptedEmail ?? null,
        encryptedPassword: encryptedPassword ?? null,
        encryptedApiKey: encryptedApiKey ?? null,
        enabled: enabled ?? true,
        priority: priority ?? 10,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: providerRecord.id,
        provider: providerRecord.provider,
        enabled: providerRecord.enabled,
        priority: providerRecord.priority,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
