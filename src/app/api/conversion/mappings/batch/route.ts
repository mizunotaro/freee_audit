import { NextResponse } from 'next/server'
import { withAccountantAuth, type AuthenticatedRequest } from '@/lib/api'
import {
  accountMappingService,
  type BatchResult,
} from '@/services/conversion/account-mapping-service'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const MAX_BATCH_SIZE = 500

const conversionRuleSchema = z.object({
  type: z.enum(['direct', 'percentage', 'formula', 'ai_suggested']),
  percentage: z.number().min(0).max(100).optional(),
  formula: z.string().max(500).optional(),
  conditions: z
    .array(
      z.object({
        field: z.string(),
        operator: z.enum(['equals', 'contains', 'gt', 'lt', 'between']),
        value: z.union([z.string(), z.number()]),
        targetAccountId: z.string(),
      })
    )
    .optional(),
})

const batchCreateSchema = z.object({
  action: z.literal('create'),
  mappings: z
    .array(
      z.object({
        sourceCoaId: z.string(),
        sourceItemId: z.string(),
        targetCoaId: z.string(),
        targetItemId: z.string(),
        mappingType: z.enum(['1to1', '1toN', 'Nto1', 'complex']),
        conversionRule: conversionRuleSchema.optional(),
        percentage: z.number().min(0).max(100).optional(),
        notes: z.string().max(1000).optional(),
      })
    )
    .min(1)
    .max(MAX_BATCH_SIZE),
})

const batchApproveSchema = z.object({
  action: z.literal('approve'),
  mappingIds: z.array(z.string()).min(1).max(MAX_BATCH_SIZE),
})

const batchDeleteSchema = z.object({
  action: z.literal('delete'),
  mappingIds: z.array(z.string()).min(1).max(MAX_BATCH_SIZE),
})

const batchSchema = z.discriminatedUnion('action', [
  batchCreateSchema,
  batchApproveSchema,
  batchDeleteSchema,
])

async function postHandler(req: AuthenticatedRequest) {
  const companyId = req.user.companyId
  if (!companyId) {
    return NextResponse.json(
      { error: 'Company ID is required', code: 'COMPANY_REQUIRED' },
      { status: 400 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'INVALID_JSON' }, { status: 400 })
  }

  const parseResult = batchSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: parseResult.error.flatten(),
      },
      { status: 400 }
    )
  }

  const validated = parseResult.data

  try {
    let result: BatchResult

    switch (validated.action) {
      case 'create':
        result = await accountMappingService.createBatch(
          validated.mappings.map((m) => ({
            companyId,
            sourceCoaId: m.sourceCoaId,
            sourceItemId: m.sourceItemId,
            targetCoaId: m.targetCoaId,
            targetItemId: m.targetItemId,
            mappingType: m.mappingType,
            conversionRule: m.conversionRule,
            percentage: m.percentage,
            notes: m.notes,
            createdBy: req.user.id,
          }))
        )
        break

      case 'approve':
        result = await accountMappingService.approveBatch(validated.mappingIds, req.user.id)
        break

      case 'delete':
        result = await deleteBatch(validated.mappingIds)
        break
    }

    return NextResponse.json({
      success: result.failed === 0,
      processed: result.success,
      failed: result.failed,
      errors: result.errors,
    })
  } catch (error) {
    console.error('Batch operation failed:', error)
    return NextResponse.json(
      { error: 'Batch operation failed', code: 'BATCH_ERROR' },
      { status: 500 }
    )
  }
}

async function deleteBatch(ids: string[]): Promise<BatchResult> {
  const result: BatchResult = {
    success: 0,
    failed: 0,
    errors: [],
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < ids.length; i++) {
      try {
        const mapping = await tx.accountMapping.findUnique({
          where: { id: ids[i] },
        })

        if (!mapping) {
          result.failed++
          result.errors.push({ index: i, message: 'Mapping not found' })
          continue
        }

        await tx.accountMapping.delete({
          where: { id: ids[i] },
        })

        result.success++
      } catch (error) {
        result.failed++
        result.errors.push({
          index: i,
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  })

  return result
}

export const POST = withAccountantAuth(postHandler)
