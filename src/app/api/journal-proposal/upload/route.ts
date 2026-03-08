import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { prisma } from '@/lib/db'
import { createStorageProvider, type StorageConfig } from '@/lib/storage'
import {
  uploadSchema,
  validateFile,
  verifyCompanyAccess,
  createErrorResponse,
  createSuccessResponse,
  withRetry,
  sanitizeForLog,
} from '../_utils'

async function postHandler(req: AuthenticatedRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const companyId = formData.get('companyId') as string | null

    if (!file) {
      return NextResponse.json(createErrorResponse('VALIDATION_ERROR', 'File is required'), {
        status: 400,
      })
    }

    const parseResult = uploadSchema.safeParse({ companyId })
    if (!parseResult.success) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', 'Invalid input', parseResult.error.flatten()),
        { status: 400 }
      )
    }

    const hasAccess = await verifyCompanyAccess(req, parseResult.data.companyId)
    if (!hasAccess) {
      return NextResponse.json(createErrorResponse('FORBIDDEN', 'Access denied to this company'), {
        status: 403,
      })
    }

    const fileValidation = validateFile(file)
    if (!fileValidation.valid) {
      return NextResponse.json(
        createErrorResponse('VALIDATION_ERROR', fileValidation.error || 'Invalid file'),
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const storageConfig: StorageConfig = {
      provider: 'local',
      encryption: { enabled: true, algorithm: 'AES-256-GCM' },
      maxFileSize: 10 * 1024 * 1024,
      allowedTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'],
      retentionDays: 30,
    }
    const storage = createStorageProvider(storageConfig)

    const uploadResult = await withRetry(
      () =>
        storage.putFile({
          data: buffer,
          originalName: file.name,
          contentType: file.type,
          companyId: parseResult.data.companyId,
          userId: req.user.id,
          expiresInDays: 30,
        }),
      { maxRetries: 2, initialDelayMs: 500, maxDelayMs: 2000, backoffMultiplier: 2 }
    )

    if (!uploadResult.success) {
      console.error('Upload failed:', sanitizeForLog({ error: uploadResult.error.message }))
      return NextResponse.json(createErrorResponse('UPLOAD_FAILED', uploadResult.error.message), {
        status: 500,
      })
    }

    const document = await withRetry(
      () =>
        prisma.receiptDocument.create({
          data: {
            id: uploadResult.data.id,
            companyId: parseResult.data.companyId,
            encryptedPath: uploadResult.data.encryptedPath,
            originalName: file.name,
            contentType: file.type,
            fileSize: file.size,
            fileHash: uploadResult.data.hash,
            status: 'uploaded',
            expiresAt: uploadResult.data.expiresAt,
            uploadedBy: req.user.id,
          },
        }),
      { maxRetries: 2, initialDelayMs: 500, maxDelayMs: 2000, backoffMultiplier: 2 }
    )

    return NextResponse.json(
      createSuccessResponse({
        receiptId: document.id,
        fileName: document.originalName,
        fileSize: document.fileSize,
      }),
      { status: 201 }
    )
  } catch (error) {
    console.error(
      'Failed to upload receipt:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return NextResponse.json(createErrorResponse('INTERNAL_ERROR', 'Failed to upload receipt'), {
      status: 500,
    })
  }
}

export const POST = withAuth(postHandler, { rateLimit: 'upload', requireCompany: true })
