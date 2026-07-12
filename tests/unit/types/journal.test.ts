import { describe, it, expect } from 'vitest'
import type {
  Journal,
  JournalEntry,
  JournalWithDocument,
  Document,
  CreateJournalInput,
  JournalQueryParams,
} from '@/types/journal'
import type { AuditResult } from '@/types/audit'

const FIXED_DATE = new Date('2026-01-15T00:00:00.000Z')

const AUDIT_STATUSES: Journal['auditStatus'][] = ['PENDING', 'PASSED', 'FAILED', 'SKIPPED']

const AUDIT_RESULT_STATUSES: AuditResult['status'][] = ['PASSED', 'FAILED', 'ERROR']

describe('src/types/journal', () => {
  describe('module resolution', () => {
    it('should be importable as an ESM module', async () => {
      const mod = await import('@/types/journal')
      expect(mod).toBeDefined()
      expect(typeof mod).toBe('object')
    })
  })

  describe('auditStatus union', () => {
    it('should expose exactly the 4 status members', () => {
      expect(AUDIT_STATUSES).toHaveLength(4)
      expect(new Set(AUDIT_STATUSES).size).toBe(4)
      expect(AUDIT_STATUSES).toEqual(['PENDING', 'PASSED', 'FAILED', 'SKIPPED'])
    })

    it('should type the union as exactly those four literals', () => {
      expectTypeOf<Journal['auditStatus']>().toEqualTypeOf<
        'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED'
      >()
      expectTypeOf<JournalQueryParams['auditStatus']>().toEqualTypeOf<
        'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED' | undefined
      >()
    })
  })

  describe('Journal', () => {
    it('should construct a fully-populated journal at runtime', () => {
      const journal: Journal = {
        id: 'j1',
        companyId: 'c1',
        freeeJournalId: 'fj1',
        entryDate: FIXED_DATE,
        description: 'Office supplies',
        debitAccount: '110',
        creditAccount: '200',
        amount: 1000,
        taxAmount: 100,
        taxType: 'TAX_8',
        documentId: 'doc1',
        auditStatus: 'PENDING',
        syncedAt: FIXED_DATE,
        createdAt: FIXED_DATE,
      }

      expect(journal.id).toBe('j1')
      expect(journal.companyId).toBe('c1')
      expect(journal.freeeJournalId).toBe('fj1')
      expect(journal.entryDate).toBeInstanceOf(Date)
      expect(journal.description).toBe('Office supplies')
      expect(journal.debitAccount).toBe('110')
      expect(journal.creditAccount).toBe('200')
      expect(journal.amount).toBe(1000)
      expect(journal.taxAmount).toBe(100)
      expect(journal.taxType).toBe('TAX_8')
      expect(journal.documentId).toBe('doc1')
      expect(journal.auditStatus).toBe('PENDING')
      expect(journal.syncedAt).toBeInstanceOf(Date)
      expect(journal.createdAt).toBeInstanceOf(Date)
    })

    it('should serialize to exactly the expected key set when fully populated', () => {
      const journal: Journal = {
        id: 'j1',
        companyId: 'c1',
        freeeJournalId: 'fj1',
        entryDate: FIXED_DATE,
        description: 'Office supplies',
        debitAccount: '110',
        creditAccount: '200',
        amount: 1000,
        taxAmount: 100,
        taxType: 'TAX_8',
        documentId: 'doc1',
        auditStatus: 'PENDING',
        syncedAt: FIXED_DATE,
        createdAt: FIXED_DATE,
      }

      expect(Object.keys(journal).sort()).toEqual([
        'amount',
        'auditStatus',
        'companyId',
        'createdAt',
        'creditAccount',
        'debitAccount',
        'description',
        'documentId',
        'entryDate',
        'freeeJournalId',
        'id',
        'syncedAt',
        'taxAmount',
        'taxType',
      ])
    })

    it('should be minimal-constructible (optional fields omitted)', () => {
      const journal: Journal = {
        id: 'j2',
        companyId: 'c1',
        freeeJournalId: 'fj2',
        entryDate: FIXED_DATE,
        description: '',
        debitAccount: '110',
        creditAccount: '200',
        amount: 0,
        taxAmount: 0,
        auditStatus: 'PASSED',
        syncedAt: FIXED_DATE,
        createdAt: FIXED_DATE,
      }

      expect(journal.taxType).toBeUndefined()
      expect(journal.documentId).toBeUndefined()
      expect(journal.amount).toBe(0)
      expect(journal.taxAmount).toBe(0)
      expect(journal.description).toBe('')
    })

    it('should accept boundary numeric values', () => {
      const journal: Journal = {
        id: 'j3',
        companyId: 'c1',
        freeeJournalId: 'fj3',
        entryDate: FIXED_DATE,
        description: 'boundary',
        debitAccount: '110',
        creditAccount: '200',
        amount: Number.MAX_SAFE_INTEGER,
        taxAmount: -1,
        auditStatus: 'SKIPPED',
        syncedAt: FIXED_DATE,
        createdAt: FIXED_DATE,
      }

      expect(journal.amount).toBe(Number.MAX_SAFE_INTEGER)
      expect(journal.taxAmount).toBe(-1)
    })

    it('should type every required field as non-optional', () => {
      expectTypeOf<Journal['id']>().toEqualTypeOf<string>()
      expectTypeOf<Journal['companyId']>().toEqualTypeOf<string>()
      expectTypeOf<Journal['freeeJournalId']>().toEqualTypeOf<string>()
      expectTypeOf<Journal['entryDate']>().toEqualTypeOf<Date>()
      expectTypeOf<Journal['description']>().toEqualTypeOf<string>()
      expectTypeOf<Journal['debitAccount']>().toEqualTypeOf<string>()
      expectTypeOf<Journal['creditAccount']>().toEqualTypeOf<string>()
      expectTypeOf<Journal['amount']>().toEqualTypeOf<number>()
      expectTypeOf<Journal['taxAmount']>().toEqualTypeOf<number>()
      expectTypeOf<Journal['auditStatus']>().toEqualTypeOf<
        'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED'
      >()
      expectTypeOf<Journal['syncedAt']>().toEqualTypeOf<Date>()
      expectTypeOf<Journal['createdAt']>().toEqualTypeOf<Date>()
    })

    it('should type taxType and documentId as optional', () => {
      expectTypeOf<Journal['taxType']>().toEqualTypeOf<string | undefined>()
      expectTypeOf<Journal['documentId']>().toEqualTypeOf<string | undefined>()
      expectTypeOf<Journal>().toMatchTypeOf<{ taxType?: string }>()
      expectTypeOf<Journal>().toMatchTypeOf<{ documentId?: string }>()
    })
  })

  describe('JournalEntry', () => {
    it('should construct a fully-populated entry at runtime', () => {
      const entry: JournalEntry = {
        id: 'e1',
        entryDate: FIXED_DATE,
        description: 'Consulting fee',
        debitAccount: '500',
        creditAccount: '100',
        amount: 50000,
        taxAmount: 5000,
        taxType: 'TAX_10',
      }

      expect(entry.id).toBe('e1')
      expect(entry.entryDate).toBeInstanceOf(Date)
      expect(entry.description).toBe('Consulting fee')
      expect(entry.debitAccount).toBe('500')
      expect(entry.creditAccount).toBe('100')
      expect(entry.amount).toBe(50000)
      expect(entry.taxAmount).toBe(5000)
      expect(entry.taxType).toBe('TAX_10')
    })

    it('should be minimal-constructible without the optional taxType', () => {
      const entry: JournalEntry = {
        id: 'e2',
        entryDate: FIXED_DATE,
        description: 'no tax',
        debitAccount: '500',
        creditAccount: '100',
        amount: 1,
        taxAmount: 0,
      }

      expect(entry.taxType).toBeUndefined()
      expect(Object.keys(entry)).toHaveLength(7)
    })

    it('should type taxType as optional and the rest required', () => {
      expectTypeOf<JournalEntry['taxType']>().toEqualTypeOf<string | undefined>()
      expectTypeOf<JournalEntry['id']>().toEqualTypeOf<string>()
      expectTypeOf<JournalEntry['entryDate']>().toEqualTypeOf<Date>()
      expectTypeOf<JournalEntry['description']>().toEqualTypeOf<string>()
      expectTypeOf<JournalEntry['debitAccount']>().toEqualTypeOf<string>()
      expectTypeOf<JournalEntry['creditAccount']>().toEqualTypeOf<string>()
      expectTypeOf<JournalEntry['amount']>().toEqualTypeOf<number>()
      expectTypeOf<JournalEntry['taxAmount']>().toEqualTypeOf<number>()
    })

    it('should be a structural subset of Journal (minus persistence fields)', () => {
      expectTypeOf<JournalEntry>().toMatchTypeOf<{
        id: string
        entryDate: Date
        description: string
        debitAccount: string
        creditAccount: string
        amount: number
        taxAmount: number
        taxType?: string
      }>()
      expectTypeOf<JournalEntry>().not.toMatchTypeOf<{
        auditStatus: 'PENDING'
      }>()
    })
  })

  describe('Document', () => {
    it('should construct a fully-populated document at runtime', () => {
      const doc: Document = {
        id: 'd1',
        companyId: 'c1',
        freeeDocumentId: 'fd1',
        journalId: 'j1',
        filePath: '/tmp/receipt.pdf',
        fileType: 'application/pdf',
        fileName: 'receipt.pdf',
        fileSize: 2048,
        uploadDate: FIXED_DATE,
        createdAt: FIXED_DATE,
      }

      expect(doc.id).toBe('d1')
      expect(doc.companyId).toBe('c1')
      expect(doc.freeeDocumentId).toBe('fd1')
      expect(doc.journalId).toBe('j1')
      expect(doc.filePath).toBe('/tmp/receipt.pdf')
      expect(doc.fileType).toBe('application/pdf')
      expect(doc.fileName).toBe('receipt.pdf')
      expect(doc.fileSize).toBe(2048)
      expect(doc.uploadDate).toBeInstanceOf(Date)
      expect(doc.createdAt).toBeInstanceOf(Date)
    })

    it('should serialize to exactly the expected key set when fully populated', () => {
      const doc: Document = {
        id: 'd1',
        companyId: 'c1',
        freeeDocumentId: 'fd1',
        journalId: 'j1',
        filePath: '/tmp/receipt.pdf',
        fileType: 'application/pdf',
        fileName: 'receipt.pdf',
        fileSize: 2048,
        uploadDate: FIXED_DATE,
        createdAt: FIXED_DATE,
      }

      expect(Object.keys(doc).sort()).toEqual([
        'companyId',
        'createdAt',
        'fileName',
        'filePath',
        'fileSize',
        'fileType',
        'freeeDocumentId',
        'id',
        'journalId',
        'uploadDate',
      ])
    })

    it('should be minimal-constructible (optional ids omitted)', () => {
      const doc: Document = {
        id: 'd2',
        companyId: 'c1',
        filePath: '/tmp/blank.png',
        fileType: 'image/png',
        fileName: 'blank.png',
        fileSize: 0,
        uploadDate: FIXED_DATE,
        createdAt: FIXED_DATE,
      }

      expect(doc.freeeDocumentId).toBeUndefined()
      expect(doc.journalId).toBeUndefined()
      expect(doc.fileSize).toBe(0)
    })

    it('should type freeeDocumentId and journalId as optional', () => {
      expectTypeOf<Document['freeeDocumentId']>().toEqualTypeOf<string | undefined>()
      expectTypeOf<Document['journalId']>().toEqualTypeOf<string | undefined>()
      expectTypeOf<Document>().toMatchTypeOf<{ freeeDocumentId?: string }>()
      expectTypeOf<Document>().toMatchTypeOf<{ journalId?: string }>()
    })

    it('should type the required fields as non-optional', () => {
      expectTypeOf<Document['id']>().toEqualTypeOf<string>()
      expectTypeOf<Document['companyId']>().toEqualTypeOf<string>()
      expectTypeOf<Document['filePath']>().toEqualTypeOf<string>()
      expectTypeOf<Document['fileType']>().toEqualTypeOf<string>()
      expectTypeOf<Document['fileName']>().toEqualTypeOf<string>()
      expectTypeOf<Document['fileSize']>().toEqualTypeOf<number>()
      expectTypeOf<Document['uploadDate']>().toEqualTypeOf<Date>()
      expectTypeOf<Document['createdAt']>().toEqualTypeOf<Date>()
    })
  })

  describe('JournalWithDocument', () => {
    const baseJournal: Journal = {
      id: 'j1',
      companyId: 'c1',
      freeeJournalId: 'fj1',
      entryDate: FIXED_DATE,
      description: 'Office supplies',
      debitAccount: '110',
      creditAccount: '200',
      amount: 1000,
      taxAmount: 100,
      auditStatus: 'PENDING',
      syncedAt: FIXED_DATE,
      createdAt: FIXED_DATE,
    }

    const doc: Document = {
      id: 'd1',
      companyId: 'c1',
      filePath: '/tmp/receipt.pdf',
      fileType: 'application/pdf',
      fileName: 'receipt.pdf',
      fileSize: 2048,
      uploadDate: FIXED_DATE,
      createdAt: FIXED_DATE,
    }

    const auditResult: AuditResult = {
      id: 'ar1',
      journalId: 'j1',
      status: 'PASSED',
      issues: [],
      analyzedAt: FIXED_DATE,
      createdAt: FIXED_DATE,
    }

    it('should extend Journal (assignable in both directions for the base shape)', () => {
      expectTypeOf<JournalWithDocument>().toMatchTypeOf<Journal>()
      expectTypeOf<JournalWithDocument>().toHaveProperty('document')
      expectTypeOf<JournalWithDocument>().toHaveProperty('auditResult')
    })

    it('should accept a journal plus a nested document and auditResult at runtime', () => {
      const withDoc: JournalWithDocument = {
        ...baseJournal,
        document: doc,
        auditResult,
      }

      expect(withDoc.document).toEqual(doc)
      expect(withDoc.auditResult).toEqual(auditResult)
      expect(withDoc.auditResult?.status).toBe('PASSED')
      expect(withDoc.auditResult?.issues).toEqual([])
      expect(AUDIT_RESULT_STATUSES).toContain(withDoc.auditResult?.status)
    })

    it('should type document and auditResult as optional', () => {
      expectTypeOf<JournalWithDocument['document']>().toEqualTypeOf<Document | undefined>()
      expectTypeOf<JournalWithDocument['auditResult']>().toEqualTypeOf<AuditResult | undefined>()
    })

    it('should be constructible from a bare Journal (extensions optional)', () => {
      const fromBare: JournalWithDocument = { ...baseJournal }
      expect(fromBare.document).toBeUndefined()
      expect(fromBare.auditResult).toBeUndefined()
    })
  })

  describe('CreateJournalInput', () => {
    it('should construct a fully-populated input at runtime', () => {
      const input: CreateJournalInput = {
        companyId: 'c1',
        freeeJournalId: 'fj1',
        entryDate: FIXED_DATE,
        description: 'Office supplies',
        debitAccount: '110',
        creditAccount: '200',
        amount: 1000,
        taxAmount: 100,
        taxType: 'TAX_8',
        documentId: 'doc1',
      }

      expect(input.companyId).toBe('c1')
      expect(input.freeeJournalId).toBe('fj1')
      expect(input.entryDate).toBeInstanceOf(Date)
      expect(input.description).toBe('Office supplies')
      expect(input.debitAccount).toBe('110')
      expect(input.creditAccount).toBe('200')
      expect(input.amount).toBe(1000)
      expect(input.taxAmount).toBe(100)
      expect(input.taxType).toBe('TAX_8')
      expect(input.documentId).toBe('doc1')
    })

    it('should serialize to exactly the expected key set when fully populated', () => {
      const input: CreateJournalInput = {
        companyId: 'c1',
        freeeJournalId: 'fj1',
        entryDate: FIXED_DATE,
        description: 'Office supplies',
        debitAccount: '110',
        creditAccount: '200',
        amount: 1000,
        taxAmount: 100,
        taxType: 'TAX_8',
        documentId: 'doc1',
      }

      expect(Object.keys(input).sort()).toEqual([
        'amount',
        'companyId',
        'creditAccount',
        'debitAccount',
        'description',
        'documentId',
        'entryDate',
        'freeeJournalId',
        'taxAmount',
        'taxType',
      ])
    })

    it('should be minimal-constructible (optionals omitted)', () => {
      const input: CreateJournalInput = {
        companyId: 'c1',
        freeeJournalId: 'fj2',
        entryDate: FIXED_DATE,
        description: 'no tax, no doc',
        debitAccount: '110',
        creditAccount: '200',
        amount: 0,
        taxAmount: 0,
      }

      expect(input.taxType).toBeUndefined()
      expect(input.documentId).toBeUndefined()
      expect(Object.keys(input)).toHaveLength(8)
    })

    it('should type taxType and documentId as optional', () => {
      expectTypeOf<CreateJournalInput['taxType']>().toEqualTypeOf<string | undefined>()
      expectTypeOf<CreateJournalInput['documentId']>().toEqualTypeOf<string | undefined>()
    })

    it('should not carry persistence/lifecycle fields present on Journal', () => {
      expectTypeOf<CreateJournalInput>().not.toMatchTypeOf<{ id: string }>()
      expectTypeOf<CreateJournalInput>().not.toMatchTypeOf<{
        auditStatus: 'PENDING'
      }>()
      expectTypeOf<CreateJournalInput>().not.toMatchTypeOf<{
        syncedAt: Date
      }>()
      expectTypeOf<CreateJournalInput>().not.toMatchTypeOf<{
        createdAt: Date
      }>()
    })
  })

  describe('JournalQueryParams', () => {
    it('should be minimal-constructible with only companyId', () => {
      const params: JournalQueryParams = { companyId: 'c1' }

      expect(params.companyId).toBe('c1')
      expect(params.startDate).toBeUndefined()
      expect(params.endDate).toBeUndefined()
      expect(params.auditStatus).toBeUndefined()
      expect(params.page).toBeUndefined()
      expect(params.limit).toBeUndefined()
      expect(Object.keys(params)).toEqual(['companyId'])
    })

    it('should accept a fully-populated filter set at runtime', () => {
      const start = new Date('2026-01-01T00:00:00.000Z')
      const end = new Date('2026-01-31T00:00:00.000Z')
      const params: JournalQueryParams = {
        companyId: 'c1',
        startDate: start,
        endDate: end,
        auditStatus: 'FAILED',
        page: 2,
        limit: 50,
      }

      expect(params.startDate).toBe(start)
      expect(params.endDate).toBe(end)
      expect(params.auditStatus).toBe('FAILED')
      expect(params.page).toBe(2)
      expect(params.limit).toBe(50)
    })

    it('should type every filter field as optional except companyId', () => {
      expectTypeOf<JournalQueryParams['companyId']>().toEqualTypeOf<string>()
      expectTypeOf<JournalQueryParams['startDate']>().toEqualTypeOf<Date | undefined>()
      expectTypeOf<JournalQueryParams['endDate']>().toEqualTypeOf<Date | undefined>()
      expectTypeOf<JournalQueryParams['auditStatus']>().toEqualTypeOf<
        'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED' | undefined
      >()
      expectTypeOf<JournalQueryParams['page']>().toEqualTypeOf<number | undefined>()
      expectTypeOf<JournalQueryParams['limit']>().toEqualTypeOf<number | undefined>()
    })

    it('should accept boundary pagination values', () => {
      const first: JournalQueryParams = { companyId: 'c1', page: 1, limit: 1 }
      const big: JournalQueryParams = {
        companyId: 'c1',
        page: Number.MAX_SAFE_INTEGER,
        limit: Number.MAX_SAFE_INTEGER,
      }

      expect(first.page).toBe(1)
      expect(first.limit).toBe(1)
      expect(big.page).toBe(Number.MAX_SAFE_INTEGER)
      expect(big.limit).toBe(Number.MAX_SAFE_INTEGER)
    })
  })
})
