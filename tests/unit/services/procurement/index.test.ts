import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  prisma: {
    procurementCase: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    procurementDocument: { create: vi.fn() },
    procurementAlert: { create: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  },
}))

import { prisma } from '@/lib/db'
import {
  createProcurementCase,
  addProcurementDocument,
  checkProcurementConsistency,
} from '@/services/procurement'

describe('Procurement Service', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('createProcurementCase', () => {
    it('should create a case and set competition flag for >=100万円', async () => {
      vi.mocked(prisma.procurementCase.create).mockResolvedValue({
        id: 'case-1',
        competitionRequired: true,
      } as never)

      const result = await createProcurementCase({
        companyId: 'comp-1',
        title: 'CRO委託',
        costCategory: 'consignment',
        totalAmount: 2000000,
      })

      expect(result.success).toBe(true)
      expect(vi.mocked(prisma.procurementCase.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ competitionRequired: true }),
        })
      )
    })

    it('should not require competition for <100万円', async () => {
      vi.mocked(prisma.procurementCase.create).mockResolvedValue({ id: 'case-2' } as never)

      await createProcurementCase({
        companyId: 'comp-1',
        title: '試薬購入',
        costCategory: 'goods',
        totalAmount: 500000,
      })

      expect(vi.mocked(prisma.procurementCase.create)).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ competitionRequired: false }),
        })
      )
    })

    it('should reject invalid cost category', async () => {
      const result = await createProcurementCase({
        companyId: 'comp-1',
        title: 'Test',
        costCategory: 'invalid',
        totalAmount: 100,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('addProcurementDocument', () => {
    it('should add a document', async () => {
      vi.mocked(prisma.procurementDocument.create).mockResolvedValue({ id: 'doc-1' } as never)

      const result = await addProcurementDocument({
        caseId: 'case-1',
        documentType: 'quotation',
        amount: 2000000,
        vendorName: 'CRO Corp',
      })

      expect(result.success).toBe(true)
    })

    it('should reject invalid document type', async () => {
      const result = await addProcurementDocument({
        caseId: 'case-1',
        documentType: 'unknown_type',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('checkProcurementConsistency', () => {
    it('should detect missing quotations for >=100万円 cases', async () => {
      vi.mocked(prisma.procurementCase.findUnique).mockResolvedValue({
        id: 'case-1',
        competitionRequired: true,
        totalAmount: 2000000,
        documents: [
          { id: 'd1', documentType: 'quotation', amount: 2000000, vendorName: 'A', date: null },
        ],
      } as never)

      const result = await checkProcurementConsistency('case-1')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isConsistent).toBe(false)
        expect(result.data.alerts.some((a) => a.alertType === 'missing_quotations')).toBe(true)
      }
    })

    it('should detect amount mismatch between PO and invoice', async () => {
      vi.mocked(prisma.procurementCase.findUnique).mockResolvedValue({
        id: 'case-2',
        competitionRequired: false,
        totalAmount: 100000,
        documents: [
          {
            id: 'd1',
            documentType: 'purchase_order',
            amount: 100000,
            vendorName: 'A',
            date: new Date('2026-04-01'),
          },
          {
            id: 'd2',
            documentType: 'invoice',
            amount: 120000,
            vendorName: 'A',
            date: new Date('2026-04-15'),
          },
          {
            id: 'd3',
            documentType: 'delivery_note',
            amount: null,
            vendorName: null,
            date: new Date('2026-04-10'),
          },
        ],
      } as never)

      const result = await checkProcurementConsistency('case-2')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.alerts.some((a) => a.alertType === 'amount_mismatch')).toBe(true)
      }
    })

    it('should pass consistent case', async () => {
      vi.mocked(prisma.procurementCase.findUnique).mockResolvedValue({
        id: 'case-3',
        competitionRequired: false,
        totalAmount: 50000,
        documents: [
          {
            id: 'd1',
            documentType: 'quotation',
            amount: 50000,
            vendorName: 'B',
            date: new Date('2026-03-01'),
          },
          {
            id: 'd2',
            documentType: 'purchase_order',
            amount: 50000,
            vendorName: 'B',
            date: new Date('2026-03-05'),
          },
          {
            id: 'd3',
            documentType: 'delivery_note',
            amount: null,
            vendorName: null,
            date: new Date('2026-03-20'),
          },
          {
            id: 'd4',
            documentType: 'invoice',
            amount: 50000,
            vendorName: 'B',
            date: new Date('2026-03-25'),
          },
        ],
      } as never)

      const result = await checkProcurementConsistency('case-3')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isConsistent).toBe(true)
        expect(result.data.alerts).toHaveLength(0)
      }
    })
  })
})
