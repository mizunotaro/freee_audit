import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api/auth-helpers'
import { createDatabaseBackup, getBackupHistory, exportData } from '@/services/backup'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const result = await getBackupHistory(user.companyId ?? undefined)
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: result.data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'export') {
      if (!user.companyId) {
        return NextResponse.json({ success: false, error: 'Company not set' }, { status: 400 })
      }
      const result = await exportData({
        companyId: user.companyId,
        format: body.format ?? 'json',
        tables: body.tables ?? ['journals', 'monthlyBalances'],
      })
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error.message }, { status: 400 })
      }
      return NextResponse.json({ success: true, data: result.data })
    }

    const result = await createDatabaseBackup({
      companyId: user.companyId ?? undefined,
      backupType: body.backupType ?? 'full',
      destination: body.destination ?? 'local',
    })

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, data: result.data }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
