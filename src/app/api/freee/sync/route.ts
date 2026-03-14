import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import {
  syncAllFinancialData,
  syncJournalsToDatabase,
  syncTrialBalanceToDatabase,
} from '@/lib/integrations/freee/data-sync'
import { getToken } from '@/lib/integrations/freee/token-store'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, fiscalYear, startMonth, endMonth } = body

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { freeeCompanyId: true },
    })

    if (!company?.freeeCompanyId) {
      return NextResponse.json(
        { error: 'freee連携が設定されていません。先にfreee連携を行ってください。' },
        { status: 400 }
      )
    }

    const token = await getToken(user.companyId)
    if (!token) {
      return NextResponse.json(
        { error: 'freee認証トークンが無効です。再度連携してください。' },
        { status: 401 }
      )
    }

    const targetFiscalYear = fiscalYear || new Date().getFullYear()
    const targetStartMonth = startMonth || 1
    const targetEndMonth = endMonth || 12

    switch (action) {
      case 'sync_all': {
        const result = await syncAllFinancialData(
          user.companyId,
          token.accessToken,
          parseInt(company.freeeCompanyId),
          targetFiscalYear
        )
        return NextResponse.json({
          success: true,
          message: '財務データの同期が完了しました',
          result,
        })
      }

      case 'sync_journals': {
        const result = await syncJournalsToDatabase(
          user.companyId,
          token.accessToken,
          parseInt(company.freeeCompanyId),
          targetFiscalYear,
          targetStartMonth,
          targetEndMonth
        )
        return NextResponse.json({
          success: result.success,
          message: result.success ? `${result.journalsCount}件の仕訳を同期しました` : result.error,
          result,
        })
      }

      case 'sync_trial_balance': {
        const result = await syncTrialBalanceToDatabase(
          user.companyId,
          token.accessToken,
          parseInt(company.freeeCompanyId),
          targetFiscalYear,
          targetStartMonth
        )
        return NextResponse.json({
          success: result.success,
          message: result.success ? `${result.balancesCount}件の残高を同期しました` : result.error,
          result,
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use sync_all, sync_journals, or sync_trial_balance' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Failed to sync freee data:', error)
    return NextResponse.json(
      {
        error: 'データ同期中にエラーが発生しました',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: {
        freeeCompanyId: true,
        name: true,
      },
    })

    const token = await getToken(user.companyId)

    return NextResponse.json({
      connected: !!company?.freeeCompanyId && !!token,
      companyName: company?.name,
      freeeCompanyId: company?.freeeCompanyId,
      hasToken: !!token,
      tokenExpiresAt: token?.expiresAt,
    })
  } catch (error) {
    console.error('Failed to get sync status:', error)
    return NextResponse.json({ error: 'Failed to get sync status' }, { status: 500 })
  }
}
