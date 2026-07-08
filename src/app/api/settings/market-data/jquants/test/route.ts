import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { validateSession } from '@/lib/auth'
import { createJQuantsProvider } from '@/services/market-data'
import { decrypt } from '@/lib/crypto'
import { logRouteAudit } from '@/lib/route-audit'

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user?.companyId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const providerConfig = await prisma.marketDataProvider.findUnique({
      where: {
        companyId_provider: {
          companyId: user.companyId,
          provider: 'jquants',
        },
      },
    })

    if (!providerConfig || !providerConfig.encryptedEmail || !providerConfig.encryptedPassword) {
      return NextResponse.json(
        {
          success: false,
          error: 'J-Quants not configured. Please save credentials first.',
        },
        { status: 400 }
      )
    }

    const email = decrypt(providerConfig.encryptedEmail)
    const password = decrypt(providerConfig.encryptedPassword)

    const jquants = createJQuantsProvider()

    const authResult = await jquants.authenticate({
      provider: 'jquants',
      email,
      password,
    })

    if (!authResult.success) {
      await prisma.marketDataProvider.update({
        where: { id: providerConfig.id },
        data: { lastError: authResult.error.message },
      })

      await logRouteAudit({
        request,
        userId: user.id,
        action: 'JQUANTS_CONNECTION_TEST',
        resource: 'market_data_provider',
        resourceId: providerConfig.id,
        result: 'FAILURE',
        details: { error: authResult.error.message },
      })

      return NextResponse.json({
        success: false,
        error: authResult.error.message,
      })
    }

    const testResult = await jquants.testConnection()

    if (testResult.success && testResult.data) {
      await prisma.marketDataProvider.update({
        where: { id: providerConfig.id },
        data: {
          lastSyncAt: new Date(),
          lastError: null,
        },
      })

      await logRouteAudit({
        request,
        userId: user.id,
        action: 'JQUANTS_CONNECTION_TEST',
        resource: 'market_data_provider',
        resourceId: providerConfig.id,
      })

      return NextResponse.json({
        success: true,
        data: { connected: true },
      })
    } else {
      await prisma.marketDataProvider.update({
        where: { id: providerConfig.id },
        data: { lastError: 'Connection test failed' },
      })

      await logRouteAudit({
        request,
        userId: user.id,
        action: 'JQUANTS_CONNECTION_TEST',
        resource: 'market_data_provider',
        resourceId: providerConfig.id,
        result: 'FAILURE',
      })

      return NextResponse.json({
        success: false,
        error: 'Connection test failed',
      })
    }
  } catch (error) {
    await logRouteAudit({
      request,
      action: 'JQUANTS_CONNECTION_TEST',
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
