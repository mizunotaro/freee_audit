import { NextResponse } from 'next/server'
import { withAdminAuth, type AuthenticatedRequest } from '@/lib/api'
import { prisma } from '@/lib/db'
import { encrypt } from '@/lib/crypto'
import { z } from 'zod'

const providerSchema = z.enum(['openai', 'gemini', 'claude', 'azure', 'aws', 'gcp', 'freee'])

const updateApiKeySchema = z.object({
  apiKey: z.string().min(1),
  endpoint: z.string().url().optional(),
  region: z.string().optional(),
  projectId: z.string().optional(),
})

const FIELD_MAPPING: Record<string, { keyField: string; extraFields?: string[] }> = {
  openai: { keyField: 'openaiApiKey' },
  gemini: { keyField: 'geminiApiKey' },
  claude: { keyField: 'claudeApiKey' },
  azure: { keyField: 'azureApiKey', extraFields: ['azureEndpoint'] },
  aws: { keyField: 'awsSecretAccessKey', extraFields: ['awsRegion'] },
  gcp: { keyField: 'gcpApiKey', extraFields: ['gcpProjectId'] },
  freee: { keyField: 'freeeClientSecret' },
}

async function getHandler(
  req: AuthenticatedRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> }
) {
  try {
    if (!context?.params) {
      return NextResponse.json(
        { success: false, error: 'Provider parameter is required' },
        { status: 400 }
      )
    }

    const params = await context.params
    const provider = params.provider
    const parsedProvider = providerSchema.safeParse(provider)

    if (!parsedProvider.success) {
      return NextResponse.json({ success: false, error: 'Invalid provider' }, { status: 400 })
    }

    const mapping = FIELD_MAPPING[parsedProvider.data]

    const settings = await prisma.settings.findUnique({
      where: { userId: req.user.id },
      select: {
        [mapping.keyField]: true,
      },
    })

    const hasKey = !!(settings && (settings as Record<string, unknown>)[mapping.keyField])

    return NextResponse.json({
      provider: parsedProvider.data,
      hasKey,
      lastUpdated: settings ? new Date().toISOString() : null,
    })
  } catch (error) {
    console.error('Failed to fetch API key status:', error)
    return NextResponse.json({ error: 'Failed to fetch API key status' }, { status: 500 })
  }
}

async function putHandler(
  req: AuthenticatedRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> }
) {
  try {
    if (!context?.params) {
      return NextResponse.json(
        { success: false, error: 'Provider parameter is required' },
        { status: 400 }
      )
    }

    const params = await context.params
    const provider = params.provider
    const parsedProvider = providerSchema.safeParse(provider)

    if (!parsedProvider.success) {
      return NextResponse.json({ success: false, error: 'Invalid provider' }, { status: 400 })
    }

    const body = await req.json()
    const validatedBody = updateApiKeySchema.safeParse(body)

    if (!validatedBody.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validatedBody.error.flatten() },
        { status: 400 }
      )
    }

    const providerKey = parsedProvider.data
    const mapping = FIELD_MAPPING[providerKey]
    const encryptedKey = encrypt(validatedBody.data.apiKey)

    const updateData: Record<string, unknown> = {
      [mapping.keyField]: encryptedKey,
    }

    if (providerKey === 'azure' && validatedBody.data.endpoint) {
      updateData.azureEndpoint = validatedBody.data.endpoint
    }
    if (providerKey === 'aws' && validatedBody.data.region) {
      updateData.awsRegion = validatedBody.data.region
    }
    if (providerKey === 'gcp' && validatedBody.data.projectId) {
      updateData.gcpProjectId = validatedBody.data.projectId
    }

    await prisma.settings.upsert({
      where: { userId: req.user.id },
      update: updateData,
      create: {
        userId: req.user.id,
        ...updateData,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'API_KEY_UPDATE',
        resource: 'settings',
        resourceId: providerKey,
        result: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      message: `${providerKey} API key updated`,
    })
  } catch (error) {
    console.error('Failed to update API key:', error)
    return NextResponse.json({ error: 'Failed to update API key' }, { status: 500 })
  }
}

async function deleteHandler(
  req: AuthenticatedRequest,
  context?: { params?: Record<string, string> | Promise<Record<string, string>> }
) {
  try {
    if (!context?.params) {
      return NextResponse.json(
        { success: false, error: 'Provider parameter is required' },
        { status: 400 }
      )
    }

    const params = await context.params
    const provider = params.provider
    const parsedProvider = providerSchema.safeParse(provider)

    if (!parsedProvider.success) {
      return NextResponse.json({ success: false, error: 'Invalid provider' }, { status: 400 })
    }

    const providerKey = parsedProvider.data
    const mapping = FIELD_MAPPING[providerKey]

    await prisma.settings.update({
      where: { userId: req.user.id },
      data: {
        [mapping.keyField]: null,
      },
    })

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'API_KEY_DELETE',
        resource: 'settings',
        resourceId: providerKey,
        result: 'SUCCESS',
      },
    })

    return NextResponse.json({
      success: true,
      message: `${providerKey} API key deleted`,
    })
  } catch (error) {
    console.error('Failed to delete API key:', error)
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 })
  }
}

export const GET = withAdminAuth(getHandler)
export const PUT = withAdminAuth(putHandler, { rateLimit: 'strict' })
export const DELETE = withAdminAuth(deleteHandler, { rateLimit: 'strict' })
