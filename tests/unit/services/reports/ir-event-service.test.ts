import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { success, failure, type Result } from '@/types/result'
import type {
  IREvent,
  IREventList,
  IREventFilters,
  CreateIREventData,
  UpdateIREventData,
  IREventType,
  IREventStatus,
} from '@/types/ir-report'

type IREventServiceError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

type IREventResult<T> = Result<T, IREventServiceError>

const DB_TIMEOUT_MS = 30000
const DB_MAX_WAIT_MS = 5000

function createServiceError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): IREventServiceError {
  return { code, message, details }
}

async function getIREvents(
  companyId: string,
  filters?: IREventFilters
): Promise<IREventResult<IREventList[]>> {
  if (!companyId || typeof companyId !== 'string') {
    return failure(createServiceError('VALIDATION_ERROR', 'companyId is required'))
  }

  try {
    const where: Record<string, unknown> = { companyId }

    if (filters?.eventType) {
      where.eventType = filters.eventType
    }
    if (filters?.status) {
      where.status = filters.status
    }
    if (filters?.startDate) {
      where.scheduledDate = { ...(where.scheduledDate as object), gte: filters.startDate }
    }
    if (filters?.endDate) {
      where.scheduledDate = { ...(where.scheduledDate as object), lte: filters.endDate }
    }

    const events = await prisma.$transaction(
      async (tx) => {
        return tx.iREvent.findMany({
          where,
          select: {
            id: true,
            companyId: true,
            eventType: true,
            title: true,
            scheduledDate: true,
            status: true,
          },
          orderBy: { scheduledDate: 'asc' },
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(events as IREventList[])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get IR events'
    return failure(createServiceError('DATABASE_ERROR', message, { companyId, filters }))
  }
}

async function getIREvent(id: string): Promise<IREventResult<IREvent>> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError('VALIDATION_ERROR', 'id is required'))
  }

  try {
    const event = await prisma.$transaction(
      async (tx) => {
        return tx.iREvent.findUnique({ where: { id } })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    if (!event) {
      return failure(createServiceError('NOT_FOUND', `IR Event not found: ${id}`))
    }

    return success(event as IREvent)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get IR event'
    return failure(createServiceError('DATABASE_ERROR', message, { id }))
  }
}

async function createIREvent(data: CreateIREventData): Promise<IREventResult<IREvent>> {
  if (!data.companyId || !data.title || !data.scheduledDate) {
    return failure(createServiceError('VALIDATION_ERROR', 'Missing required fields'))
  }

  try {
    const event = await prisma.$transaction(
      async (tx) => {
        return tx.iREvent.create({
          data: {
            companyId: data.companyId,
            eventType: data.eventType,
            title: data.title,
            titleEn: data.titleEn ?? null,
            description: data.description ?? null,
            descriptionEn: data.descriptionEn ?? null,
            scheduledDate: data.scheduledDate,
            status: 'scheduled',
          },
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(event as IREvent)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create IR event'
    return failure(createServiceError('DATABASE_ERROR', message, { data }))
  }
}

async function updateIREvent(id: string, data: UpdateIREventData): Promise<IREventResult<IREvent>> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError('VALIDATION_ERROR', 'id is required'))
  }

  if (!data || Object.keys(data).length === 0) {
    return failure(createServiceError('VALIDATION_ERROR', 'No update data provided'))
  }

  if (data.description && typeof data.description !== 'string') {
    return failure(createServiceError('VALIDATION_ERROR', 'description must be a string'))
  }

  try {
    const event = await prisma.$transaction(
      async (tx) => {
        return tx.iREvent.update({
          where: { id },
          data,
        })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(event as IREvent)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return failure(createServiceError('NOT_FOUND', `IR Event not found: ${id}`))
    }
    const message = error instanceof Error ? error.message : 'Failed to update IR event'
    return failure(createServiceError('DATABASE_ERROR', message, { id, data }))
  }
}

async function deleteIREvent(id: string): Promise<IREventResult<void>> {
  if (!id || typeof id !== 'string') {
    return failure(createServiceError('VALIDATION_ERROR', 'id is required'))
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.iREvent.findUnique({ where: { id } })
        if (!existing) {
          throw new Error('NOT_FOUND')
        }
        await tx.iREvent.delete({ where: { id } })
      },
      { maxWait: DB_MAX_WAIT_MS, timeout: DB_TIMEOUT_MS }
    )

    return success(undefined)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return failure(createServiceError('NOT_FOUND', `IR Event not found: ${id}`))
    }
    const message = error instanceof Error ? error.message : 'Failed to delete IR event'
    return failure(createServiceError('DATABASE_ERROR', message, { id }))
  }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
    iREvent: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

describe('IREventService', () => {
  const mockCompanyId = 'company-123'
  const mockEventId = 'event-456'

  const mockEvent: IREvent = {
    id: mockEventId,
    companyId: mockCompanyId,
    eventType: 'earnings_release',
    title: '2024年度 第3四半期 決算発表',
    titleEn: 'Q3 2024 Earnings Release',
    description: '決算発表の説明',
    descriptionEn: 'Q3 2024 Earnings Release Description',
    scheduledDate: new Date('2024-11-15'),
    status: 'scheduled',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockEventList: IREventList = {
    id: mockEventId,
    companyId: mockCompanyId,
    eventType: 'earnings_release',
    title: '2024年度 第3四半期 決算発表',
    scheduledDate: new Date('2024-11-15'),
    status: 'scheduled',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getIREvents', () => {
    it('should return success with events list', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iREvent: {
            findMany: vi.fn().mockResolvedValue([mockEventList]),
          },
        }
        return fn(tx)
      })

      const result = await getIREvents(mockCompanyId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveLength(1)
        expect(result.data[0].title).toBe('2024年度 第3四半期 決算発表')
      }
    })

    it('should return failure when companyId is missing', async () => {
      const result = await getIREvents('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should apply eventType filter', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iREvent: {
            findMany: vi.fn().mockResolvedValue([mockEventList]),
          },
        }
        return fn(tx)
      })

      const filters: IREventFilters = { eventType: 'earnings_release' }
      const result = await getIREvents(mockCompanyId, filters)

      expect(result.success).toBe(true)
    })

    it('should apply status filter', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iREvent: {
            findMany: vi.fn().mockResolvedValue([mockEventList]),
          },
        }
        return fn(tx)
      })

      const filters: IREventFilters = { status: 'scheduled' }
      const result = await getIREvents(mockCompanyId, filters)

      expect(result.success).toBe(true)
    })

    it('should apply date range filters', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iREvent: {
            findMany: vi.fn().mockResolvedValue([mockEventList]),
          },
        }
        return fn(tx)
      })

      const filters: IREventFilters = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      }
      const result = await getIREvents(mockCompanyId, filters)

      expect(result.success).toBe(true)
    })

    it('should return empty array when no events', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iREvent: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        }
        return fn(tx)
      })

      const result = await getIREvents(mockCompanyId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual([])
      }
    })
  })

  describe('getIREvent', () => {
    it('should return success with event details', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iREvent: {
            findUnique: vi.fn().mockResolvedValue(mockEvent),
          },
        }
        return fn(tx)
      })

      const result = await getIREvent(mockEventId)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe(mockEventId)
        expect(result.data.description).toBe('決算発表の説明')
      }
    })

    it('should return failure when id is missing', async () => {
      const result = await getIREvent('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when event not found', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iREvent: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        }
        return fn(tx)
      })

      const result = await getIREvent('non-existent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('createIREvent', () => {
    const createData: CreateIREventData = {
      companyId: mockCompanyId,
      eventType: 'earnings_release',
      title: '2024年度 決算発表',
      scheduledDate: new Date('2024-11-15'),
    }

    it('should return success with created event', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iREvent: {
            create: vi.fn().mockResolvedValue({
              ...mockEvent,
              title: createData.title,
            }),
          },
        }
        return fn(tx)
      })

      const result = await createIREvent(createData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe(createData.title)
        expect(result.data.status).toBe('scheduled')
      }
    })

    it('should return failure when companyId is missing', async () => {
      const result = await createIREvent({ ...createData, companyId: '' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('Missing required fields')
      }
    })

    it('should return failure when title is missing', async () => {
      const result = await createIREvent({ ...createData, title: '' })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when scheduledDate is missing', async () => {
      const result = await createIREvent({ ...createData, scheduledDate: undefined as any })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should create event with description', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iREvent: {
            create: vi.fn().mockResolvedValue(mockEvent),
          },
        }
        return fn(tx)
      })

      const result = await createIREvent({
        ...createData,
        description: 'Description',
      })

      expect(result.success).toBe(true)
    })
  })

  describe('updateIREvent', () => {
    const updateData: UpdateIREventData = {
      title: 'Updated Title',
    }

    it('should return success with updated event', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iREvent: {
            findUnique: vi.fn().mockResolvedValue(mockEvent),
            update: vi.fn().mockResolvedValue({ ...mockEvent, ...updateData }),
          },
        }
        return fn(tx)
      })

      const result = await updateIREvent(mockEventId, updateData)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.title).toBe('Updated Title')
      }
    })

    it('should return failure when id is missing', async () => {
      const result = await updateIREvent('', updateData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when no update data provided', async () => {
      const result = await updateIREvent(mockEventId, {})

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(result.error.message).toBe('No update data provided')
      }
    })

    it('should return failure when event not found', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iREvent: {
            findUnique: vi.fn().mockResolvedValue(null),
            update: vi.fn(),
          },
        }
        return fn(tx)
      })

      const result = await updateIREvent('non-existent', updateData)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })

    it('should update status to completed', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iREvent: {
            findUnique: vi.fn().mockResolvedValue(mockEvent),
            update: vi.fn().mockResolvedValue({ ...mockEvent, status: 'completed' }),
          },
        }
        return fn(tx)
      })

      const result = await updateIREvent(mockEventId, { status: 'completed' })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.status).toBe('completed')
      }
    })
  })

  describe('deleteIREvent', () => {
    it('should return success when event deleted', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iREvent: {
            findUnique: vi.fn().mockResolvedValue(mockEvent),
            delete: vi.fn().mockResolvedValue(mockEvent),
          },
        }
        return fn(tx)
      })

      const result = await deleteIREvent(mockEventId)

      expect(result.success).toBe(true)
    })

    it('should return failure when id is missing', async () => {
      const result = await deleteIREvent('')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('VALIDATION_ERROR')
      }
    })

    it('should return failure when event not found', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iREvent: {
            findUnique: vi.fn().mockResolvedValue(null),
            delete: vi.fn(),
          },
        }
        return fn(tx)
      })

      const result = await deleteIREvent('non-existent')

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND')
      }
    })
  })

  describe('Edge cases', () => {
    it('should handle all event types', async () => {
      const eventTypes: IREventType[] = [
        'earnings_release',
        'briefing',
        'agm',
        'dividend',
        'briefing',
        'briefing',
      ]

      for (const eventType of eventTypes) {
        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
          const tx = {
            iREvent: {
              create: vi.fn().mockResolvedValue({ ...mockEvent, eventType }),
            },
          }
          return fn(tx)
        })

        const result = await createIREvent({
          companyId: mockCompanyId,
          eventType,
          title: `Test ${eventType}`,
          scheduledDate: new Date(),
        })

        expect(result.success).toBe(true)
      }
    })

    it('should handle all event statuses', async () => {
      const statuses: IREventStatus[] = ['scheduled', 'completed', 'cancelled']

      for (const status of statuses) {
        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
          const tx = {
            iREvent: {
              findUnique: vi.fn().mockResolvedValue(mockEvent),
              update: vi.fn().mockResolvedValue({ ...mockEvent, status }),
            },
          }
          return fn(tx)
        })

        const result = await updateIREvent(mockEventId, { status })

        expect(result.success).toBe(true)
      }
    })

    it('should handle past event date', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iREvent: {
            create: vi.fn().mockResolvedValue({
              ...mockEvent,
              scheduledDate: new Date('2020-01-01'),
            }),
          },
        }
        return fn(tx)
      })

      const result = await createIREvent({
        companyId: mockCompanyId,
        eventType: 'earnings_release',
        title: 'Past Event',
        scheduledDate: new Date('2020-01-01'),
      })

      expect(result.success).toBe(true)
    })

    it('should handle very long description', async () => {
      const longDescription = 'a'.repeat(10000)
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          iREvent: {
            create: vi.fn().mockResolvedValue({
              ...mockEvent,
              description: longDescription,
            }),
          },
        }
        return fn(tx)
      })

      const result = await createIREvent({
        companyId: mockCompanyId,
        eventType: 'earnings_release',
        title: 'Event with long description',
        scheduledDate: new Date(),
        description: longDescription,
      })

      expect(result.success).toBe(true)
    })
  })
})

export { getIREvents, getIREvent, createIREvent, updateIREvent, deleteIREvent }
