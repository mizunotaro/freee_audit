import { test, expect, type Cookie, type Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { applyE2eEnvDefaults } from './lib/env'

// E2E-FLOW-05: journal list→detail + data-quality flags surface (dq-01) in mock mode.
//
// dq-01 shipped a read-only validator (analyzeJournalQuality in
// src/services/validation/journal-quality-validator.ts) with NO API route or UI.
// This spec drives the new read-only surface that wraps it:
//   - GET /api/journal-quality runs the validator over the company's journals and
//     returns per-journal flags (duplicate / unbalanced) with reasons.
//   - /ja/audit/journal-quality renders the list, a client-side filter, and a
//     detail panel that shows a flagged entry's reason.
//
// The verdict logic (audit pass/fail) is Class-A and untouched; the dq-01
// validator only emits info/warning quality flags (no verdict), so the surface
// is genuinely read-only. Mock mode (FREEE_MOCK_MODE/AI_MOCK_MODE) is forced via
// playwright.config.ts; the seeded admin is provisioned by tests/e2e/global-setup.ts.
// No sleeps: Playwright auto-waits on waitForResponse + locators.
//
// Determinism: the spec seeds its own journals (distinctive accounts/amounts and
// fixed 2024-01 dates) so they never collide with journal-audit.spec's
// current-month rows. Assertions anchor on these journals by freeeJournalId /
// description, never on totals that depend on other specs' DB rows. upsert makes
// re-runs idempotent.
//
// Auth happens once in beforeAll and the session cookie is injected into each
// test's context (not a per-test login): the auth rate limiter is 5 login POSTs
// / 15 min / IP, hardcoded in src/lib/security and shared in-memory across the
// whole e2e run, so this spec contributes exactly 1 login POST.

applyE2eEnvDefaults()
const prisma = new PrismaClient()

const COMPANY_ID = 'company_1'

const DUP_A_ID = 'e2e-flow-05-dup-a'
const DUP_B_ID = 'e2e-flow-05-dup-b'
const UNBALANCED_ID = 'e2e-flow-05-unbalanced'
const CLEAN_ID = 'e2e-flow-05-clean'

const DUP_A_DESC = 'DQ重複仕訳A'
const DUP_B_DESC = 'DQ重複仕訳B'
const UNBALANCED_DESC = 'DQ不整合仕訳'
const CLEAN_DESC = 'DQ正常仕訳'

const UNBALANCED_REASON = '金額が0以下です'
const DUPLICATE_REASON = '重複する仕訳が検出されました'

interface SeedJournal {
  freeeJournalId: string
  entryDate: Date
  description: string
  debitAccount: string
  creditAccount: string
  amount: number
  taxAmount: number
  taxType: string | null
  auditStatus: string
}

// Two identical (date/accounts/amount) journals => one dq-01 duplicate group;
// one non-positive-amount journal => an unbalanced flag (non_positive_amount);
// one clean journal => no flags. Accounts are chosen off the counterparty list
// (or with a valid description) so missing_counterparty (sample-capped, not
// surfaced per-row) never interferes with the asserted flags.
const SEED_JOURNALS: ReadonlyArray<SeedJournal> = [
  {
    freeeJournalId: DUP_A_ID,
    entryDate: new Date('2024-01-15'),
    description: DUP_A_DESC,
    debitAccount: '仕入',
    creditAccount: '買掛金',
    amount: 55500,
    taxAmount: 0,
    taxType: '課売8%',
    auditStatus: 'PENDING',
  },
  {
    freeeJournalId: DUP_B_ID,
    entryDate: new Date('2024-01-15'),
    description: DUP_B_DESC,
    debitAccount: '仕入',
    creditAccount: '買掛金',
    amount: 55500,
    taxAmount: 0,
    taxType: '課売8%',
    auditStatus: 'PENDING',
  },
  {
    freeeJournalId: UNBALANCED_ID,
    entryDate: new Date('2024-01-16'),
    description: UNBALANCED_DESC,
    debitAccount: '広告宣伝費',
    creditAccount: '現金預金',
    amount: -777,
    taxAmount: 0,
    taxType: '課売8%',
    auditStatus: 'PENDING',
  },
  {
    freeeJournalId: CLEAN_ID,
    entryDate: new Date('2024-01-17'),
    description: CLEAN_DESC,
    debitAccount: '売上',
    creditAccount: '現金預金',
    amount: 9800,
    taxAmount: 0,
    taxType: '課売8%',
    auditStatus: 'PASSED',
  },
]

async function seedJournals(): Promise<void> {
  const syncedAt = new Date()
  for (const j of SEED_JOURNALS) {
    const data = {
      companyId: COMPANY_ID,
      entryDate: j.entryDate,
      syncedAt,
      description: j.description,
      debitAccount: j.debitAccount,
      creditAccount: j.creditAccount,
      amount: j.amount,
      taxAmount: j.taxAmount,
      taxType: j.taxType,
      auditStatus: j.auditStatus,
    }
    await prisma.journal.upsert({
      where: { freeeJournalId: j.freeeJournalId },
      update: data,
      create: { freeeJournalId: j.freeeJournalId, ...data },
    })
  }
}

interface QualityResponseJournal {
  id: string
  freeeJournalId: string
  flags: Array<{ kind: string; severity: string; reason: string }>
}

interface QualityResponse {
  data: QualityResponseJournal[]
}

function requireJournal(data: QualityResponseJournal[], freeeId: string): QualityResponseJournal {
  const j = data.find((x) => x.freeeJournalId === freeeId)
  if (!j) throw new Error(`expected journal ${freeeId} in /api/journal-quality response`)
  return j
}

function qualityResponse(page: Page) {
  return page.waitForResponse(
    (response) => {
      try {
        if (response.request().method() !== 'GET') return false
        return new URL(response.url()).pathname === '/api/journal-quality'
      } catch {
        return false
      }
    },
    { timeout: 30_000 }
  )
}

let authCookies: Cookie[] | undefined

test.describe('E2E journal data-quality flow (mock mode)', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(150_000)
    await seedJournals()
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto('/ja/login')
    await page.getByLabel('Email', { exact: true }).fill('admin@example.com')
    await page.getByLabel('Password', { exact: true }).fill('admin123')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })
    authCookies = await context.cookies()
    await context.close()
  })

  test.beforeEach(async ({ context }) => {
    if (authCookies) await context.addCookies(authCookies)
    test.setTimeout(150_000)
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('list renders with dq-01 data-quality flags for seeded journals', async ({ page }) => {
    const responsePromise = qualityResponse(page)
    await page.goto('/ja/audit/journal-quality')
    const response = await responsePromise
    expect(response.status()).toBe(200)

    const body = (await response.json()) as QualityResponse

    // Network-level proof that the dq-01 validator flags the seeded rows:
    // the duplicate pair each carry a duplicate flag, the negative-amount row
    // carries an unbalanced flag with the non_positive_amount reason, and the
    // clean row carries none.
    const dupA = requireJournal(body.data, DUP_A_ID)
    expect(dupA.flags.some((f) => f.kind === 'duplicate')).toBe(true)
    expect(dupA.flags.find((f) => f.kind === 'duplicate')?.reason).toBe(DUPLICATE_REASON)

    const dupB = requireJournal(body.data, DUP_B_ID)
    expect(dupB.flags.some((f) => f.kind === 'duplicate')).toBe(true)

    const unbalanced = requireJournal(body.data, UNBALANCED_ID)
    expect(unbalanced.flags.some((f) => f.kind === 'unbalanced')).toBe(true)
    expect(unbalanced.flags.find((f) => f.kind === 'unbalanced')?.reason).toBe(UNBALANCED_REASON)

    const clean = requireJournal(body.data, CLEAN_ID)
    expect(clean.flags.length).toBe(0)

    // The page shell + the seeded journals rendered.
    await expect(page.getByRole('heading', { name: 'データ品質フラグ', exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText(DUP_A_DESC)).toBeVisible()
    await expect(page.getByText(UNBALANCED_DESC)).toBeVisible()
    await expect(page.getByText(CLEAN_DESC)).toBeVisible()

    // Flag badges render in the list rows (scoped to the row so the filter
    // <option> texts 重複 / 不整合 don't collide).
    const dupRow = page.getByRole('row').filter({ hasText: DUP_A_DESC })
    await expect(dupRow.getByText('重複', { exact: true })).toBeVisible()
    const unbalancedRow = page.getByRole('row').filter({ hasText: UNBALANCED_DESC })
    await expect(unbalancedRow.getByText('不整合', { exact: true })).toBeVisible()
  })

  test('filter applies and a flagged entry shows its reason in the detail view', async ({
    page,
  }) => {
    const responsePromise = qualityResponse(page)
    await page.goto('/ja/audit/journal-quality')
    await responsePromise
    await expect(page.getByRole('heading', { name: 'データ品質フラグ', exact: true })).toBeVisible({
      timeout: 30_000,
    })

    const cleanRow = () => page.getByRole('row').filter({ hasText: CLEAN_DESC })
    const unbalancedRow = () => page.getByRole('row').filter({ hasText: UNBALANCED_DESC })

    // Baseline: the clean journal is listed.
    await expect(cleanRow()).toHaveCount(1)

    // Filter to "フラグあり" (flagged): the clean journal's row is removed from
    // the DOM, while a flagged journal remains. The filter is client-side over
    // the already-loaded data (no re-fetch), so assert on row presence.
    await page.getByLabel('フィルター').selectOption('flagged')
    await expect(cleanRow()).toHaveCount(0)
    await expect(unbalancedRow()).toHaveCount(1)

    // Reset to "すべて": the clean journal reappears (filter is reversible).
    await page.getByLabel('フィルター').selectOption('all')
    await expect(cleanRow()).toHaveCount(1)

    // List -> detail: open the flagged journal's detail panel. The trigger's
    // accessible name embeds the description (aria-label), so it is unique.
    await page.getByRole('button', { name: `${UNBALANCED_DESC} の詳細` }).click()

    // The detail panel surfaces the flagged entry's reason. This text lives only
    // in the detail panel (the row shows the short 不整合 badge, not the reason).
    await expect(page.getByText(UNBALANCED_REASON)).toBeVisible({ timeout: 10_000 })
  })
})
