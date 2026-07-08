import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { validateSession } from '@/lib/auth'
import { logRouteAudit } from '@/lib/route-audit'

const createProviderSchema = z.object({
  provider: z.string().min(1),
  encryptedEmail: z.string().nullable().optional(),
  encryptedPassword: z.string().nullable().optional(),
  encryptedApiKey: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
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

    const parsed = createProviderSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { provider, encryptedEmail, encryptedPassword, encryptedApiKey, enabled, priority } =
      parsed.data

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

    await logRouteAudit({
      request,
      userId: user.id,
      action: 'MARKET_DATA_PROVIDER_CREATE',
      resource: 'market_data_provider',
      resourceId: providerRecord.id,
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
    await logRouteAudit({
      request,
      action: 'MARKET_DATA_PROVIDER_CREATE',
      resource: 'market_data_provider',
      result: 'FAILURE',
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    })
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
