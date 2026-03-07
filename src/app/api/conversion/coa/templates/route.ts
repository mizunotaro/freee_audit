import { NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/api'
import { z } from 'zod'

const querySchema = z.object({
  standard: z.enum(['JGAAP', 'USGAAP', 'IFRS']).optional(),
})

const COA_TEMPLATES = [
  {
    id: 'usgaap-standard',
    standard: 'USGAAP',
    name: 'US GAAP Standard Chart of Accounts',
    nameJa: 'US GAAP 標準勘定科目表',
    description: '一般的な企業向けの標準的な勘定科目表',
    itemCount: 250,
    categories: ['Assets', 'Liabilities', 'Equity', 'Revenue', 'Expenses'],
  },
  {
    id: 'usgaap-tech-startup',
    standard: 'USGAAP',
    name: 'US GAAP Tech Startup',
    nameJa: 'US GAAP テックスタートアップ向け',
    description: 'テクノロジースタートアップ向けに最適化された勘定科目表',
    itemCount: 180,
    categories: ['Assets', 'Liabilities', 'Equity', 'Revenue', 'Expenses'],
  },
  {
    id: 'ifrs-standard',
    standard: 'IFRS',
    name: 'IFRS Standard Chart of Accounts',
    nameJa: 'IFRS 標準勘定科目表',
    description: 'IFRS準拠の標準的な勘定科目表',
    itemCount: 280,
    categories: ['Assets', 'Liabilities', 'Equity', 'Income', 'Expenses'],
  },
  {
    id: 'jgaap-standard',
    standard: 'JGAAP',
    name: '日本基準 標準勘定科目表',
    nameJa: '日本基準 標準勘定科目表',
    description: '日本基準準拠の標準的な勘定科目表',
    itemCount: 150,
    categories: ['資産', '負債', '純資産', '収益', '費用'],
  },
]

async function getHandler(req: AuthenticatedRequest) {
  const { searchParams } = new URL(req.url)
  const parseResult = querySchema.safeParse(Object.fromEntries(searchParams))

  const query = parseResult.success ? parseResult.data : {}

  const templates = query.standard
    ? COA_TEMPLATES.filter((t) => t.standard === query.standard)
    : COA_TEMPLATES

  return NextResponse.json({ data: templates })
}

export const GET = withAuth(getHandler)
