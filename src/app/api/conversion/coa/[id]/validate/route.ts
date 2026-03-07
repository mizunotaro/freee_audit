import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { chartOfAccountService } from '@/services/conversion/chart-of-account-service'

async function postHandler(
  req: AuthenticatedRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> }
) {
  if (!context?.params) {
    return NextResponse.json(
      { error: 'Missing parameters', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const params = await Promise.resolve(context.params)
  const id = params.id

  try {
    const coa = await chartOfAccountService.getById(id)

    if (!coa) {
      return NextResponse.json(
        { error: 'Chart of Accounts not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (
      coa.companyId !== req.user.companyId &&
      req.user.role !== 'ADMIN' &&
      req.user.role !== 'SUPER_ADMIN'
    ) {
      return NextResponse.json({ error: 'Access denied', code: 'FORBIDDEN' }, { status: 403 })
    }

    const result = await chartOfAccountService.validate(id)

    return NextResponse.json({
      isValid: result.isValid,
      errors: result.errors,
      warnings: result.warnings,
    })
  } catch (error) {
    console.error('Validation failed:', error)
    return NextResponse.json(
      { error: 'Validation failed', code: 'VALIDATION_ERROR' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(postHandler)
