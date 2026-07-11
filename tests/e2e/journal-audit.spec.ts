import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import { applyE2eEnvDefaults } from './lib/env'

// E2E-CORE-03: journal audit flow in mock mode.
//
// Seeds real Journal rows for the current fiscal month, drives the 記帳診断 UI
// (login -> /audit/journal -> "AI分析実行"), waits for the analyze POST to settle,
// and asserts the result list renders issue statuses + stat cards.
//
// Verdict logic is Class-A and untouched; in AI_MOCK_MODE the route's
// analyzeJournalEntry returns deterministic issues (amount<0 => error,
// description<3 => warning, no taxType => warning, future entryDate => error),
// so the seeded rows map to a known outcome without any external AI call.

applyE2eEnvDefaults()
const prisma = new PrismaClient()

const COMPANY_ID = 'company_1'

// Day 1 of the current month: always <= today, so the mock never flags it as a
// future date, and it always falls inside the page's default fiscalYear/month
// window (startDate = first day, endDate = last day of the month).
function currentMonthStart(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

interface SeedJournal {
  freeeJournalId: string
  description: string
  debitAccount: string
  creditAccount: string
  amount: number
  taxAmount: number
  taxType: string | null
  auditStatus: string
}

const SEED_JOURNALS: ReadonlyArray<SeedJournal> = [
  {
    // No issues => counts toward 問題なし (passed).
    freeeJournalId: 'e2e-core-03-passed',
    description: '正常な売上仕訳',
    debitAccount: '現金',
    creditAccount: '売上',
    amount: 100000,
    taxAmount: 10000,
    taxType: '課売8%',
    auditStatus: 'PASSED',
  },
  {
    // amount < 0 => mock flags an error severity issue.
    freeeJournalId: 'e2e-core-03-error',
    description: '返金処理の記録',
    debitAccount: '売上',
    creditAccount: '現金',
    amount: -5000,
    taxAmount: 0,
    taxType: '課売8%',
    auditStatus: 'PENDING',
  },
  {
    // short description + missing taxType => two warning severity issues.
    freeeJournalId: 'e2e-core-03-warn',
    description: 'X',
    debitAccount: '接待交際費',
    creditAccount: '現金',
    amount: 3000,
    taxAmount: 0,
    taxType: null,
    auditStatus: 'PENDING',
  },
]

async function seedJournals(): Promise<void> {
  const entryDate = currentMonthStart()
  const syncedAt = new Date()
  for (const j of SEED_JOURNALS) {
    const data = {
      companyId: COMPANY_ID,
      entryDate,
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

test.describe('E2E journal audit (mock mode)', () => {
  test.beforeAll(async () => {
    await seedJournals()
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('run AI audit -> completion -> result list renders with statuses', async ({ page }) => {
    // next dev compiles each route on first hit (in CI too); allow a cold start.
    test.setTimeout(120_000)

    // Login as the seeded admin (provisioned by tests/e2e/global-setup.ts).
    await page.goto('/ja/login')
    await page.getByLabel('Email', { exact: true }).fill('admin@example.com')
    await page.getByLabel('Password', { exact: true }).fill('admin123')
    await page.getByRole('button', { name: 'Sign In', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })

    // Open the 記帳診断 page and wait for its audit-run trigger to mount.
    await page.goto('/ja/audit/journal')
    const analyzeButton = page.getByRole('button', { name: 'AI分析実行' })
    await expect(analyzeButton).toBeVisible({ timeout: 30_000 })

    // Trigger the audit run. Capture the POST /api/audit/journal response so the
    // assertion exercises the verdict path itself, not just the pre-analyze GET.
    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/audit/journal') && r.request().method() === 'POST'
      ),
      analyzeButton.click(),
    ])
    expect(response.ok()).toBeTruthy()
    const body = await response.json()
    expect(Array.isArray(body.entries)).toBeTruthy()
    expect(body.entries.length).toBe(3)
    expect(body.stats.total).toBe(3)

    // Stat cards: all 3 seeded journals were audited (総仕訳数 = 3), with a
    // passed/issues split rendered.
    const totalValue = page
      .getByText('総仕訳数', { exact: true })
      .locator('xpath=following-sibling::div[1]')
    await expect(totalValue).toHaveText('3')
    await expect(page.getByText('要確認', { exact: true })).toBeVisible()
    await expect(page.getByText('問題なし', { exact: true }).first()).toBeVisible()

    // Result list: the Class-A mock verdicts rendered as issue rows + status
    // badges (error journal => エラー, warning journal => warning messages).
    await expect(page.getByText('金額が負の値です')).toBeVisible()
    await expect(page.getByText('税区分が設定されていません')).toBeVisible()
    await expect(page.getByText('エラー', { exact: true })).toBeVisible()
  })
})
