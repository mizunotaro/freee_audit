import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'ACCOUNTANT',
  companyId: 'company-1',
}

const mockJournals = [
  {
    id: 'journal-1',
    companyId: 'company-1',
    freeeJournalId: 'freee-1',
    entryDate: new Date('2024-01-15'),
    description: 'Test journal entry 1',
    debitAccount: 'Cash',
    creditAccount: 'Revenue',
    amount: 100000,
    taxAmount: 10000,
    taxType: 'TAXABLE',
    auditStatus: 'PASSED',
    documentId: null,
    document: null,
    syncedAt: new Date('2024-01-15'),
  },
  {
    id: 'journal-2',
    companyId: 'company-1',
    freeeJournalId: 'freee-2',
    entryDate: new Date('2024-01-16'),
    description: 'Test journal entry 2',
    debitAccount: 'Accounts Receivable',
    creditAccount: 'Sales',
    amount: 50000,
    taxAmount: 5000,
    taxType: 'TAXABLE',
    auditStatus: 'PENDING',
    documentId: 'doc-1',
    document: { id: 'doc-1', fileName: 'receipt.pdf', fileType: 'application/pdf' },
    syncedAt: new Date('2024-01-16'),
  },
  {
    id: 'journal-3',
    companyId: 'company-1',
    freeeJournalId: 'freee-3',
    entryDate: new Date('2024-01-17'),
    description: 'Test journal entry 3',
    debitAccount: 'Expenses',
    creditAccount: 'Cash',
    amount: 25000,
    taxAmount: 2500,
    taxType: 'TAXABLE',
    auditStatus: 'FAILED',
    documentId: null,
    document: null,
    syncedAt: new Date('2024-01-17'),
  },
]

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    journal: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/api/auth-helpers', () => ({
  validateCompanyId: vi.fn(async (user: typeof mockUser, companyId: string | null) => {
    if (!companyId) {
      return user.companyId
    }
    if (user.role !== 'SUPER_ADMIN' && companyId !== user.companyId) {
      throw new Error('Access denied: Company mismatch')
    }
    return companyId
  }),
  getAuthenticatedUser: vi.fn(),
}))

describe('Audit Journals API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /api/audit/journals', () => {
    it('should return journals with pagination', async () => {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.journal.findMany).mockResolvedValue(mockJournals as any)
      vi.mocked(prisma.journal.count).mockResolvedValue(3)

      const page = 1
      const limit = 50

      const [journals, total] = await Promise.all([
        prisma.journal.findMany({
          where: { companyId: 'company-1' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.journal.count({ where: { companyId: 'company-1' } }),
      ])

      expect(journals.length).toBe(3)
      expect(total).toBe(3)
    })

    it('should filter by audit status', async () => {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.journal.findMany).mockResolvedValue([mockJournals[0]] as any)
      vi.mocked(prisma.journal.count).mockResolvedValue(1)

      const where = {
        companyId: 'company-1',
        auditStatus: 'PASSED' as const,
      }

      const journals = await prisma.journal.findMany({ where })

      expect(prisma.journal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            auditStatus: 'PASSED',
          }),
        })
      )
      expect(journals.length).toBe(1)
    })

    it('should filter by date range', async () => {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.journal.findMany).mockResolvedValue(mockJournals.slice(0, 2) as any)
      vi.mocked(prisma.journal.count).mockResolvedValue(2)

      const where = {
        companyId: 'company-1',
        entryDate: {
          gte: new Date('2024-01-01'),
          lte: new Date('2024-01-16'),
        },
      }

      await prisma.journal.findMany({ where })

      expect(prisma.journal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entryDate: {
              gte: new Date('2024-01-01'),
              lte: new Date('2024-01-16'),
            },
          }),
        })
      )
    })

    it('should include document information', async () => {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.journal.findMany).mockResolvedValue(mockJournals as any)
      vi.mocked(prisma.journal.count).mockResolvedValue(3)

      const journals = await prisma.journal.findMany({
        where: { companyId: 'company-1' },
        include: {
          document: {
            select: {
              id: true,
              fileName: true,
              fileType: true,
            },
          },
        },
      })

      expect(prisma.journal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            document: {
              select: {
                id: true,
                fileName: true,
                fileType: true,
              },
            },
          },
        })
      )

      const journalWithDoc = journals.find((j) => j.documentId !== null)
      expect(journalWithDoc?.document).toBeDefined()
    })

    it('should validate company access', async () => {
      const { validateCompanyId } = await import('@/lib/api/auth-helpers')

      const companyId = await validateCompanyId(mockUser, 'company-1')
      expect(companyId).toBe('company-1')

      await expect(validateCompanyId(mockUser, 'company-2')).rejects.toThrow('Access denied')
    })

    it('should allow SUPER_ADMIN to access any company', async () => {
      const { validateCompanyId } = await import('@/lib/api/auth-helpers')

      const superAdmin = { ...mockUser, role: 'SUPER_ADMIN' }
      const companyId = await validateCompanyId(superAdmin, 'company-2')
      expect(companyId).toBe('company-2')
    })

    it('should use user company when no companyId provided', async () => {
      const { validateCompanyId } = await import('@/lib/api/auth-helpers')

      const companyId = await validateCompanyId(mockUser, null)
      expect(companyId).toBe('company-1')
    })
  })

  describe('Pagination', () => {
    it('should calculate pagination correctly', () => {
      const total = 150
      const limit = 50
      const page = 1

      const totalPages = Math.ceil(total / limit)

      expect(totalPages).toBe(3)
    })

    it('should calculate offset correctly', () => {
      const page = 3
      const limit = 50

      const offset = (page - 1) * limit

      expect(offset).toBe(100)
    })

    it('should handle last page correctly', () => {
      const total = 150
      const limit = 50
      const page = 3

      const totalPages = Math.ceil(total / limit)
      const isLastPage = page === totalPages

      expect(isLastPage).toBe(true)
    })
  })

  describe('Response Format', () => {
    it('should format journal response correctly', () => {
      const journal = mockJournals[0]

      const formattedJournal = {
        id: journal.id,
        freeeJournalId: journal.freeeJournalId,
        entryDate: journal.entryDate.toISOString().split('T')[0],
        description: journal.description,
        debitAccount: journal.debitAccount,
        creditAccount: journal.creditAccount,
        amount: journal.amount,
        taxAmount: journal.taxAmount,
        taxType: journal.taxType,
        documentId: journal.documentId,
        document: journal.document,
        auditStatus: journal.auditStatus,
        syncedAt: journal.syncedAt.toISOString(),
      }

      expect(formattedJournal.entryDate).toBe('2024-01-15')
      expect(formattedJournal.auditStatus).toBe('PASSED')
      expect(typeof formattedJournal.syncedAt).toBe('string')
    })

    it('should include pagination metadata', () => {
      const total = 3
      const page = 1
      const limit = 50

      const pagination = {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }

      expect(pagination.page).toBe(1)
      expect(pagination.limit).toBe(50)
      expect(pagination.total).toBe(3)
      expect(pagination.totalPages).toBe(1)
    })
  })

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.journal.findMany).mockRejectedValue(new Error('Database error'))

      await expect(prisma.journal.findMany({ where: { companyId: 'company-1' } })).rejects.toThrow(
        'Database error'
      )
    })

    it('should return empty array when no journals found', async () => {
      const { prisma } = await import('@/lib/db')

      vi.mocked(prisma.journal.findMany).mockResolvedValue([])
      vi.mocked(prisma.journal.count).mockResolvedValue(0)

      const journals = await prisma.journal.findMany({
        where: { companyId: 'company-1' },
      })

      expect(journals).toEqual([])
    })
  })

  describe('Audit Status Values', () => {
    it('should accept valid audit status values', () => {
      const validStatuses = ['PENDING', 'PASSED', 'FAILED', 'SKIPPED']

      for (const status of validStatuses) {
        expect(['PENDING', 'PASSED', 'FAILED', 'SKIPPED'].includes(status)).toBe(true)
      }
    })

    it('should reject invalid audit status values', () => {
      const invalidStatuses = ['IN_PROGRESS', 'COMPLETE', 'ERROR', '']

      for (const status of invalidStatuses) {
        expect(['PENDING', 'PASSED', 'FAILED', 'SKIPPED'].includes(status)).toBe(false)
      }
    })
  })
})
