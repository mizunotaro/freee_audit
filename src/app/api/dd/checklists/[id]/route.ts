import { NextRequest, NextResponse } from 'next/server'
import { validateSession } from '@/lib/auth'
import { ddChecklistService } from '@/services/dd/checklist-service'
import { prisma } from '@/lib/db'

async function getAuthUser(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  if (!token) return null
  return validateSession(token)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const result = await ddChecklistService.getChecklist(id)

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: result.error.message } },
        { status: 404 }
      )
    }

    const checklist = result.data

    if (checklist.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({
      data: {
        id: checklist.id,
        type: checklist.type,
        fiscalYear: checklist.fiscalYear,
        status: checklist.status,
        materiality: checklist.materiality,
        overallScore: checklist.overallScore,
        createdAt: checklist.createdAt.toISOString(),
        updatedAt: checklist.updatedAt.toISOString(),
        items: checklist.items.map((item) => ({
          id: item.id,
          category: item.category,
          itemCode: item.itemCode,
          title: item.title,
          description: item.description,
          status: item.status,
          severity: item.severity,
          findings: item.findings ? JSON.parse(item.findings) : null,
          recommendation: item.recommendation,
          evidence: item.evidence,
          checkedAt: item.checkedAt?.toISOString(),
          checkedBy: item.checkedBy,
        })),
      },
    })
  } catch (error) {
    console.error('Error fetching DD checklist:', error)
    return NextResponse.json({ error: 'Failed to fetch DD checklist' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { itemId, status, findings, recommendation, evidence } = body

    const checklistResult = await ddChecklistService.getChecklist(id)
    if (!checklistResult.success) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: checklistResult.error.message } },
        { status: 404 }
      )
    }

    if (checklistResult.data.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!itemId) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'itemId is required' } },
        { status: 400 }
      )
    }

    const result = await ddChecklistService.updateChecklistItem(itemId, {
      status,
      findings: findings ? JSON.stringify(findings) : undefined,
      recommendation,
      evidence,
      checkedBy: user.id,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: result.error.message } },
        { status: 400 }
      )
    }

    return NextResponse.json({
      data: {
        id: result.data.id,
        status: result.data.status,
        checkedAt: result.data.checkedAt?.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error updating DD checklist item:', error)
    return NextResponse.json({ error: 'Failed to update DD checklist item' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request)
    if (!user || !user.companyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const checklist = await prisma.dDChecklist.findUnique({
      where: { id },
      select: { companyId: true },
    })

    if (!checklist) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Checklist not found' } },
        { status: 404 }
      )
    }

    if (checklist.companyId !== user.companyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.dDChecklist.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Checklist deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting DD checklist:', error)
    return NextResponse.json({ error: 'Failed to delete DD checklist' }, { status: 500 })
  }
}
