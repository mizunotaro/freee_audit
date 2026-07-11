import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/auth', () => ({
  validateSession: vi.fn(),
}))

vi.mock('@/lib/route-audit', () => ({
  logRouteAudit: vi.fn().mockResolvedValue({ success: true }),
}))

const importerMocks = vi.hoisted(() => ({
  journal: { import: vi.fn(), preview: vi.fn(), generateTemplate: vi.fn() },
  accountItem: { import: vi.fn(), preview: vi.fn(), generateTemplate: vi.fn() },
  monthlyBalance: { import: vi.fn(), preview: vi.fn(), generateTemplate: vi.fn() },
}))

vi.mock('@/services/import/journal-importer', () => ({
  journalImporter: importerMocks.journal,
}))
vi.mock('@/services/import/account-item-importer', () => ({
  accountItemImporter: importerMocks.accountItem,
}))
vi.mock('@/services/import/monthly-balance-importer', () => ({
  monthlyBalanceImporter: importerMocks.monthlyBalance,
}))

import { POST as journalPOST, GET as journalGET } from '@/app/api/import/journals/route'
import { POST as accountPOST, GET as accountGET } from '@/app/api/import/account-items/route'
import { POST as balancePOST, GET as balanceGET } from '@/app/api/import/monthly-balances/route'
import { validateSession } from '@/lib/auth'
import { logRouteAudit } from '@/lib/route-audit'
import type { AuthUser } from '@/lib/auth'

// undici's multipart parser builds file parts through the global File and then
// brand-checks them; jsdom's File fails that check (every file body throws → 500).
// Pin the global File to node:buffer's File for this file (vitest isolates jsdom
// globals per file, so this does not leak).
beforeAll(async () => {
  const { File: nodeFile } = await import('node:buffer')
  ;(globalThis as unknown as { File: typeof nodeFile }).File = nodeFile
})

const authenticatedUser: AuthUser = {
  id: 'user-1',
  email: 'acct@example.com',
  name: 'Accountant',
  role: 'ACCOUNTANT',
  companyId: 'company-1',
}

const csvContent = Buffer.from(
  'date,account,amount\n2024-01-01,101,1000\n2024-01-02,201,2000\n',
  'utf8'
)

const importResultData = {
  success: true,
  status: 'completed' as const,
  imported: 2,
  skipped: 0,
  failed: 0,
  errors: [],
  warnings: [],
  totalRows: 2,
  validRows: 2,
  timestamp: new Date(),
  durationMs: 9,
}

const previewData = {
  rows: [{ date: '2024-01-01', account: '101', amount: 1000 }],
  totalRows: 1,
  detectedLanguage: 'ja' as const,
  warnings: [],
  sampleErrors: [],
}

function buildMultipart(
  parts: Array<{
    name: string
    filename?: string
    contentType?: string
    body: Buffer | string
  }>,
  boundary: string
): Buffer {
  const enc = (s: string) => Buffer.from(s, 'utf8')
  const chunks: Buffer[] = []
  for (const p of parts) {
    chunks.push(enc(`--${boundary}\r\n`))
    chunks.push(
      enc(
        p.filename
          ? `Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\n`
          : `Content-Disposition: form-data; name="${p.name}"\r\n`
      )
    )
    if (p.contentType) chunks.push(enc(`Content-Type: ${p.contentType}\r\n`))
    chunks.push(enc('\r\n'))
    chunks.push(typeof p.body === 'string' ? enc(p.body) : p.body)
    chunks.push(enc('\r\n'))
  }
  chunks.push(enc(`--${boundary}--\r\n`))
  return Buffer.concat(chunks)
}

interface ImportPostOptions {
  cookie?: string
  fileName?: string
  content?: Buffer
  fields?: Record<string, string>
}

function buildImportPost(url: string, query: string, opts: ImportPostOptions = {}): NextRequest {
  const boundary = '----vitest-import-boundary'
  const parts: Array<{
    name: string
    filename?: string
    contentType?: string
    body: Buffer | string
  }> = []
  for (const [name, value] of Object.entries(opts.fields ?? {})) {
    parts.push({ name, body: value })
  }
  if (opts.content !== undefined) {
    parts.push({
      name: 'file',
      filename: opts.fileName ?? 'upload.csv',
      contentType: 'text/csv',
      body: opts.content,
    })
  }
  const body = buildMultipart(parts, boundary)
  const headers: Record<string, string> = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
  }
  if (opts.cookie) headers.cookie = opts.cookie
  const init: { method: string; headers: Record<string, string>; body: BodyInit } = {
    method: 'POST',
    headers,
    body: body as BodyInit,
  }
  return new NextRequest(`${url}?${query}`, init)
}

beforeEach(() => {
  vi.clearAllMocks()
  importerMocks.journal.generateTemplate.mockReturnValue('journal-template,csv')
  importerMocks.accountItem.generateTemplate.mockReturnValue('account-template,csv')
  importerMocks.monthlyBalance.generateTemplate.mockReturnValue('balance-template,csv')
})

describe('GET /api/import/journals (template download)', () => {
  it('returns a CSV template with the correct disposition headers', async () => {
    const response = await journalGET(
      new NextRequest('http://localhost/api/import/journals?action=template')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('content-disposition')).toContain('journal_import_template_ja.csv')
    expect(await response.text()).toBe('journal-template,csv')
    expect(importerMocks.journal.generateTemplate).toHaveBeenCalledWith('ja')
  })

  it('honours the language query parameter', async () => {
    const response = await journalGET(
      new NextRequest('http://localhost/api/import/journals?action=template&language=en')
    )

    expect(response.headers.get('content-disposition')).toContain('journal_import_template_en.csv')
    expect(importerMocks.journal.generateTemplate).toHaveBeenCalledWith('en')
  })

  it('returns 400 when action is not "template"', async () => {
    const response = await journalGET(new NextRequest('http://localhost/api/import/journals'))

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({
      error: 'Invalid action. Use action=template to download template.',
    })
  })
})

describe('POST /api/import/journals', () => {
  it('returns 401 when no session cookie is present', async () => {
    const response = await journalPOST(
      buildImportPost('http://localhost/api/import/journals', '', { content: csvContent })
    )

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body).toEqual({ success: false, error: 'No session token provided' })
    expect(importerMocks.journal.import).not.toHaveBeenCalled()
  })

  it('returns 403 when the user has no company associated', async () => {
    vi.mocked(validateSession).mockResolvedValue({ ...authenticatedUser, companyId: null })

    const response = await journalPOST(
      buildImportPost('http://localhost/api/import/journals', '', {
        cookie: 'session=valid-token',
        content: csvContent,
      })
    )

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toEqual({ success: false, error: 'Company association required' })
    expect(importerMocks.journal.import).not.toHaveBeenCalled()
  })

  it('returns 400 when no file is uploaded', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const response = await journalPOST(
      buildImportPost('http://localhost/api/import/journals', '', {
        cookie: 'session=valid-token',
        fields: { mode: 'import' },
      })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({
      success: false,
      error: 'ファイルがアップロードされていません',
    })
    expect(importerMocks.journal.import).not.toHaveBeenCalled()
  })

  it('returns 400 for an unsupported file extension', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const response = await journalPOST(
      buildImportPost('http://localhost/api/import/journals', '', {
        cookie: 'session=valid-token',
        fileName: 'data.txt',
        content: csvContent,
      })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({
      success: false,
      error: 'CSVまたはExcelファイル(.xlsx, .xls)のみ対応しています',
    })
    expect(importerMocks.journal.import).not.toHaveBeenCalled()
  })

  it('returns 400 when the file exceeds the size limit', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const oversized = Buffer.alloc(11 * 1024 * 1024, 0x61)
    const response = await journalPOST(
      buildImportPost('http://localhost/api/import/journals', '', {
        cookie: 'session=valid-token',
        fileName: 'big.csv',
        content: oversized,
      })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.success).toBe(false)
    expect(body.error).toContain('MB以下にしてください')
    expect(importerMocks.journal.import).not.toHaveBeenCalled()
  })

  it('imports rows and audits the result', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    importerMocks.journal.import.mockResolvedValue({ success: true, data: importResultData })

    const response = await journalPOST(
      buildImportPost('http://localhost/api/import/journals', '', {
        cookie: 'session=valid-token',
        fileName: 'journals.csv',
        content: csvContent,
        fields: { dryRun: 'true' },
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      success: true,
      status: 'completed',
      imported: 2,
      skipped: 0,
      failed: 0,
      errors: [],
      warnings: [],
      totalRows: 2,
      validRows: 2,
      durationMs: 9,
    })
    expect(importerMocks.journal.import).toHaveBeenCalledWith(
      expect.anything(),
      { companyId: 'company-1' },
      { skipDuplicates: true, updateExisting: false, dryRun: true }
    )
    const journalFile = importerMocks.journal.import.mock.calls[0][0] as File
    expect(journalFile.name).toBe('journals.csv')
    expect(journalFile.size).toBe(csvContent.length)
    expect(logRouteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        action: 'IMPORT_JOURNALS',
        resource: 'import',
        details: { imported: 2, failed: 0, dryRun: true },
      })
    )
  })

  it('returns 400 when the importer reports a failure', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    importerMocks.journal.import.mockResolvedValue({
      success: false,
      error: { message: 'Duplicate header detected' },
    })

    const response = await journalPOST(
      buildImportPost('http://localhost/api/import/journals', '', {
        cookie: 'session=valid-token',
        fileName: 'journals.csv',
        content: csvContent,
      })
    )

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body).toEqual({ success: false, error: 'Duplicate header detected' })
  })

  it('returns a preview without writing or auditing', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    importerMocks.journal.preview.mockResolvedValue({ success: true, data: previewData })

    const response = await journalPOST(
      buildImportPost('http://localhost/api/import/journals', '', {
        cookie: 'session=valid-token',
        fileName: 'journals.csv',
        content: csvContent,
        fields: { mode: 'preview' },
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ success: true, preview: previewData })
    expect(importerMocks.journal.preview).toHaveBeenCalledWith(expect.anything(), 'ja')
    expect((importerMocks.journal.preview.mock.calls[0][0] as File).name).toBe('journals.csv')
    expect(importerMocks.journal.import).not.toHaveBeenCalled()
    expect(logRouteAudit).not.toHaveBeenCalled()
  })
})

describe('POST /api/import/account-items', () => {
  it('returns a CSV template via GET', async () => {
    const response = await accountGET(
      new NextRequest('http://localhost/api/import/account-items?action=template')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toContain('account_item_template_ja.csv')
    expect(importerMocks.accountItem.generateTemplate).toHaveBeenCalledWith('ja')
  })

  it('returns 401 when no session cookie is present', async () => {
    const response = await accountPOST(
      buildImportPost('http://localhost/api/import/account-items', '', { content: csvContent })
    )

    expect(response.status).toBe(401)
    expect(importerMocks.accountItem.import).not.toHaveBeenCalled()
  })

  it('returns 400 when no file is uploaded', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const response = await accountPOST(
      buildImportPost('http://localhost/api/import/account-items', '', {
        cookie: 'session=valid-token',
      })
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      success: false,
      error: 'ファイルがアップロードされていません',
    })
  })

  it('imports rows and audits under IMPORT_ACCOUNT_ITEMS', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    importerMocks.accountItem.import.mockResolvedValue({ success: true, data: importResultData })

    const response = await accountPOST(
      buildImportPost('http://localhost/api/import/account-items', '', {
        cookie: 'session=valid-token',
        fileName: 'accounts.csv',
        content: csvContent,
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.imported).toBe(2)
    expect(body.status).toBe('completed')
    expect(importerMocks.accountItem.import).toHaveBeenCalledWith(
      expect.anything(),
      { companyId: 'company-1' },
      { skipDuplicates: true, updateExisting: false, dryRun: false }
    )
    expect((importerMocks.accountItem.import.mock.calls[0][0] as File).name).toBe('accounts.csv')
    expect(logRouteAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'IMPORT_ACCOUNT_ITEMS',
        resource: 'import',
      })
    )
  })

  it('returns a preview for a valid file', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    importerMocks.accountItem.preview.mockResolvedValue({ success: true, data: previewData })

    const response = await accountPOST(
      buildImportPost('http://localhost/api/import/account-items', '', {
        cookie: 'session=valid-token',
        fileName: 'accounts.csv',
        content: csvContent,
        fields: { mode: 'preview' },
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.preview).toEqual(previewData)
    expect(importerMocks.accountItem.preview).toHaveBeenCalledWith(expect.anything(), 'ja')
    expect((importerMocks.accountItem.preview.mock.calls[0][0] as File).name).toBe('accounts.csv')
  })
})

describe('POST /api/import/monthly-balances', () => {
  it('returns a CSV template via GET', async () => {
    const response = await balanceGET(
      new NextRequest('http://localhost/api/import/monthly-balances?action=template')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toContain('monthly_balance_template_ja.csv')
    expect(importerMocks.monthlyBalance.generateTemplate).toHaveBeenCalledWith('ja')
  })

  it('returns 400 for an unsupported file extension', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)

    const response = await balancePOST(
      buildImportPost('http://localhost/api/import/monthly-balances', '', {
        cookie: 'session=valid-token',
        fileName: 'balances.pdf',
        content: csvContent,
      })
    )

    expect(response.status).toBe(400)
    expect(importerMocks.monthlyBalance.import).not.toHaveBeenCalled()
  })

  it('imports rows and audits under IMPORT_MONTHLY_BALANCES', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    importerMocks.monthlyBalance.import.mockResolvedValue({ success: true, data: importResultData })

    const response = await balancePOST(
      buildImportPost('http://localhost/api/import/monthly-balances', '', {
        cookie: 'session=valid-token',
        fileName: 'balances.csv',
        content: csvContent,
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.imported).toBe(2)
    expect(body.warnings).toEqual([])
    expect(importerMocks.monthlyBalance.import).toHaveBeenCalledWith(
      expect.anything(),
      { companyId: 'company-1' },
      { skipDuplicates: true, updateExisting: false, dryRun: false }
    )
    expect((importerMocks.monthlyBalance.import.mock.calls[0][0] as File).name).toBe('balances.csv')
    expect(logRouteAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'IMPORT_MONTHLY_BALANCES' })
    )
  })

  it('returns a preview (preview takes only the file)', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    importerMocks.monthlyBalance.preview.mockResolvedValue({ success: true, data: previewData })

    const response = await balancePOST(
      buildImportPost('http://localhost/api/import/monthly-balances', '', {
        cookie: 'session=valid-token',
        fileName: 'balances.csv',
        content: csvContent,
        fields: { mode: 'preview' },
      })
    )

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.preview).toEqual(previewData)
    expect(importerMocks.monthlyBalance.preview).toHaveBeenCalledWith(expect.anything())
    expect((importerMocks.monthlyBalance.preview.mock.calls[0][0] as File).name).toBe(
      'balances.csv'
    )
  })

  it('response is a NextResponse instance', async () => {
    vi.mocked(validateSession).mockResolvedValue(authenticatedUser)
    importerMocks.monthlyBalance.import.mockResolvedValue({ success: true, data: importResultData })

    const response = await balancePOST(
      buildImportPost('http://localhost/api/import/monthly-balances', '', {
        cookie: 'session=valid-token',
        fileName: 'balances.csv',
        content: csvContent,
      })
    )

    expect(response).toBeInstanceOf(NextResponse)
  })
})
