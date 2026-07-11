export type BalanceCategory =
  | 'current_asset'
  | 'fixed_asset'
  | 'current_liability'
  | 'fixed_liability'
  | 'equity'
  | 'revenue'
  | 'cost_of_sales'
  | 'sga_expense'

export type PlSide = 'revenue' | 'costOfSales' | 'sgaExpenses' | null

export interface CatalogAccount {
  code: string
  name: string
  category: BalanceCategory
  plSide: PlSide
}

interface CategorySpec {
  category: BalanceCategory
  plSide: PlSide
  prefix: number
  count: number
  nameTemplate: (code: string) => string
}

const NAME_TEMPLATES: Record<BalanceCategory, (code: string) => string> = {
  current_asset: (c) => `流動資産_${c}`,
  fixed_asset: (c) => `固定資産_${c}`,
  current_liability: (c) => `流動負債_${c}`,
  fixed_liability: (c) => `固定負債_${c}`,
  equity: (c) => `純資産_${c}`,
  revenue: (c) => `売上_${c}`,
  cost_of_sales: (c) => `売上原価_${c}`,
  sga_expense: (c) => `販管費_${c}`,
}

const CATEGORY_SPECS: CategorySpec[] = [
  {
    category: 'current_asset',
    plSide: null,
    prefix: 1000,
    count: 40,
    nameTemplate: NAME_TEMPLATES.current_asset,
  },
  {
    category: 'fixed_asset',
    plSide: null,
    prefix: 2000,
    count: 30,
    nameTemplate: NAME_TEMPLATES.fixed_asset,
  },
  {
    category: 'current_liability',
    plSide: null,
    prefix: 3000,
    count: 40,
    nameTemplate: NAME_TEMPLATES.current_liability,
  },
  {
    category: 'fixed_liability',
    plSide: null,
    prefix: 4000,
    count: 0,
    nameTemplate: NAME_TEMPLATES.fixed_liability,
  },
  {
    category: 'equity',
    plSide: null,
    prefix: 9000,
    count: 10,
    nameTemplate: NAME_TEMPLATES.equity,
  },
  {
    category: 'revenue',
    plSide: 'revenue',
    prefix: 4000,
    count: 0,
    nameTemplate: NAME_TEMPLATES.revenue,
  },
  {
    category: 'cost_of_sales',
    plSide: 'costOfSales',
    prefix: 5000,
    count: 50,
    nameTemplate: NAME_TEMPLATES.cost_of_sales,
  },
  {
    category: 'sga_expense',
    plSide: 'sgaExpenses',
    prefix: 6000,
    count: 120,
    nameTemplate: NAME_TEMPLATES.sga_expense,
  },
]

function buildRevenueAccounts(): CatalogAccount[] {
  const accounts: CatalogAccount[] = []
  for (let i = 0; i < 50; i++) {
    const code = `410${i.toString().padStart(2, '0')}`
    accounts.push({
      code,
      name: NAME_TEMPLATES.revenue(code),
      category: 'revenue',
      plSide: 'revenue',
    })
  }
  return accounts
}

function buildCatalog(): readonly CatalogAccount[] {
  const accounts: CatalogAccount[] = []
  for (const spec of CATEGORY_SPECS) {
    if (spec.count === 0) continue
    for (let i = 0; i < spec.count; i++) {
      const code = `${spec.prefix + i}`
      accounts.push({
        code,
        name: spec.nameTemplate(code),
        category: spec.category,
        plSide: spec.plSide,
      })
    }
  }
  accounts.push(...buildRevenueAccounts())
  return accounts
}

export const ACCOUNT_CATALOG: readonly CatalogAccount[] = buildCatalog()

export const REVENUE_ACCOUNTS: readonly CatalogAccount[] = ACCOUNT_CATALOG.filter(
  (a) => a.category === 'revenue'
)
export const COST_OF_SALES_ACCOUNTS: readonly CatalogAccount[] = ACCOUNT_CATALOG.filter(
  (a) => a.category === 'cost_of_sales'
)
export const SGA_ACCOUNTS: readonly CatalogAccount[] = ACCOUNT_CATALOG.filter(
  (a) => a.category === 'sga_expense'
)
export const ASSET_LIABILITY_ACCOUNTS: readonly CatalogAccount[] = ACCOUNT_CATALOG.filter(
  (a) => a.category === 'current_asset' || a.category === 'fixed_asset'
)

const BY_CODE = new Map(ACCOUNT_CATALOG.map((a) => [a.code, a]))

export function accountByCode(code: string): CatalogAccount | undefined {
  return BY_CODE.get(code)
}
