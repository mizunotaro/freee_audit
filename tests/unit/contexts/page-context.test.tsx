import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, renderHook, act, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import {
  PageContextProvider,
  usePageContext,
  inferPageTypeFromPath,
  getPageTypeLabel,
  type PageType,
  type FinancialDataContext,
} from '@/contexts/page-context'

function Wrapper({ children }: { children: ReactNode }) {
  return <PageContextProvider>{children}</PageContextProvider>
}

const ALL_PAGE_TYPES: PageType[] = [
  'dashboard',
  'audit',
  'reports',
  'analysis',
  'kpi',
  'cashflow',
  'budget',
  'settings',
  'chat',
  'journal-proposal',
  'conversion',
  'tax',
  'social-insurance',
  'deferred-accrual',
  'board',
  'investor',
  'other',
]

const EXPECTED_LABELS: Record<PageType, { ja: string; en: string }> = {
  dashboard: { ja: 'ダッシュボード', en: 'Dashboard' },
  audit: { ja: '監査', en: 'Audit' },
  reports: { ja: 'レポート', en: 'Reports' },
  analysis: { ja: '分析', en: 'Analysis' },
  kpi: { ja: 'KPI', en: 'KPI' },
  cashflow: { ja: 'キャッシュフロー', en: 'Cash Flow' },
  budget: { ja: '予算', en: 'Budget' },
  settings: { ja: '設定', en: 'Settings' },
  chat: { ja: 'チャット', en: 'Chat' },
  'journal-proposal': { ja: '仕訳提案', en: 'Journal Proposal' },
  conversion: { ja: '変換', en: 'Conversion' },
  tax: { ja: '税務', en: 'Tax' },
  'social-insurance': { ja: '社会保険', en: 'Social Insurance' },
  'deferred-accrual': { ja: '前受・未払', en: 'Deferred/Accrual' },
  board: { ja: '取締役会', en: 'Board' },
  investor: { ja: '投資家', en: 'Investor' },
  other: { ja: 'その他', en: 'Other' },
}

describe('inferPageTypeFromPath', () => {
  const cases: Array<{ path: string; expected: PageType }> = [
    { path: '/dashboard', expected: 'dashboard' },
    { path: '/ja/dashboard', expected: 'dashboard' },
    { path: '/audit', expected: 'audit' },
    { path: '/en/audit/journals', expected: 'audit' },
    { path: '/reports', expected: 'reports' },
    { path: '/ja/reports/monthly', expected: 'reports' },
    { path: '/reports/kpi', expected: 'kpi' },
    { path: '/reports/cashflow', expected: 'cashflow' },
    { path: '/reports/budget', expected: 'budget' },
    { path: '/analysis', expected: 'analysis' },
    { path: '/settings', expected: 'settings' },
    { path: '/chat', expected: 'chat' },
    { path: '/journal-proposal', expected: 'journal-proposal' },
    { path: '/conversion', expected: 'conversion' },
    { path: '/tax', expected: 'tax' },
    { path: '/social-insurance', expected: 'social-insurance' },
    { path: '/deferred-accrual', expected: 'deferred-accrual' },
    { path: '/board', expected: 'board' },
    { path: '/investor', expected: 'investor' },
  ]

  it.each(cases)('maps $path -> $expected', ({ path, expected }) => {
    expect(inferPageTypeFromPath(path)).toBe(expected)
  })

  it('returns "other" for an empty string', () => {
    expect(inferPageTypeFromPath('')).toBe('other')
  })

  it('returns "other" for the root path', () => {
    expect(inferPageTypeFromPath('/')).toBe('other')
  })

  it('returns "other" for an unknown path', () => {
    expect(inferPageTypeFromPath('/unknown/xyz')).toBe('other')
  })

  it('returns "other" for an arbitrary non-path string', () => {
    expect(inferPageTypeFromPath('not-a-path')).toBe('other')
  })

  it('prefers the specific /reports/kpi branch over generic /reports', () => {
    expect(inferPageTypeFromPath('/reports/kpi')).toBe('kpi')
  })

  it('prefers the specific /reports/cashflow branch over generic /reports', () => {
    expect(inferPageTypeFromPath('/reports/cashflow')).toBe('cashflow')
  })

  it('prefers the specific /reports/budget branch over generic /reports', () => {
    expect(inferPageTypeFromPath('/reports/budget')).toBe('budget')
  })

  it('uses substring matching: a path containing "/board" resolves to board', () => {
    expect(inferPageTypeFromPath('/ja/board-reports/123')).toBe('board')
  })

  it('honors the if-chain order: /tax/settings resolves to settings (checked before tax)', () => {
    expect(inferPageTypeFromPath('/tax/settings')).toBe('settings')
  })
})

describe('getPageTypeLabel', () => {
  it.each(ALL_PAGE_TYPES)('returns the correct ja label for %s', (pageType) => {
    expect(getPageTypeLabel(pageType, 'ja')).toBe(EXPECTED_LABELS[pageType].ja)
  })

  it.each(ALL_PAGE_TYPES)('returns the correct en label for %s', (pageType) => {
    expect(getPageTypeLabel(pageType, 'en')).toBe(EXPECTED_LABELS[pageType].en)
  })

  it.each(ALL_PAGE_TYPES)('defaults to ja when language is omitted for %s', (pageType) => {
    expect(getPageTypeLabel(pageType)).toBe(EXPECTED_LABELS[pageType].ja)
  })

  it('returns a non-empty string for every page type in ja', () => {
    for (const pageType of ALL_PAGE_TYPES) {
      const label = getPageTypeLabel(pageType, 'ja')
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('falls back to the "other" ja label for an unknown pageType', () => {
    expect(getPageTypeLabel('does-not-exist' as PageType, 'ja')).toBe('その他')
  })

  it('falls back to the "Other" en label for an unknown pageType', () => {
    expect(getPageTypeLabel('does-not-exist' as PageType, 'en')).toBe('Other')
  })
})

describe('usePageContext', () => {
  it('is a function', () => {
    expect(typeof usePageContext).toBe('function')
  })

  it('returns safe default values (no throw) when used without a provider', () => {
    // createContext was given a non-undefined default, so the `context === undefined`
    // guard inside the hook is unreachable and the hook degrades to the default value.
    const { result } = renderHook(() => usePageContext())
    expect(result.current.pageType).toBe('other')
    expect(result.current.pageTitle).toBe('')
    expect(result.current.pagePath).toBe('')
    expect(result.current.financialData).toBeNull()
    expect(typeof result.current.setPageContext).toBe('function')
    expect(typeof result.current.clearPageContext).toBe('function')
  })

  it('the no-provider default setters are harmless no-ops', () => {
    const { result } = renderHook(() => usePageContext())
    expect(() => {
      act(() => {
        result.current.setPageContext({ pageType: 'audit' })
      })
      act(() => {
        result.current.clearPageContext()
      })
    }).not.toThrow()
    expect(result.current.pageType).toBe('other')
  })
})

describe('PageContextProvider', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/')
  })

  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('provides the default values on mount', () => {
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper })
    expect(result.current.pageType).toBe('other')
    expect(result.current.pageTitle).toBe('')
    expect(result.current.financialData).toBeNull()
    expect(typeof result.current.setPageContext).toBe('function')
    expect(typeof result.current.clearPageContext).toBe('function')
  })

  it('initializes pagePath from window.location.pathname on mount (default "/")', () => {
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper })
    expect(result.current.pagePath).toBe('/')
  })

  it('initializes pagePath from window.location.pathname on mount (custom path)', () => {
    window.history.pushState({}, '', '/ja/audit')
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper })
    expect(result.current.pagePath).toBe('/ja/audit')
  })

  it('renders its children', () => {
    render(
      <PageContextProvider>
        <div>child-content</div>
      </PageContextProvider>
    )
    expect(screen.getByText('child-content')).toBeInTheDocument()
  })

  it('updates pageType via setPageContext', () => {
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper })
    act(() => {
      result.current.setPageContext({ pageType: 'audit' })
    })
    expect(result.current.pageType).toBe('audit')
  })

  it('updates pageTitle via setPageContext', () => {
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper })
    act(() => {
      result.current.setPageContext({ pageTitle: '月次監査' })
    })
    expect(result.current.pageTitle).toBe('月次監査')
  })

  it('updates pagePath via setPageContext', () => {
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper })
    act(() => {
      result.current.setPageContext({ pagePath: '/custom/path' })
    })
    expect(result.current.pagePath).toBe('/custom/path')
  })

  it('updates financialData via setPageContext', () => {
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper })
    act(() => {
      result.current.setPageContext({ financialData: { revenue: 1000 } })
    })
    expect(result.current.financialData).toEqual({ revenue: 1000 })
  })

  it('stores a complete financialData object with every field', () => {
    const fd: FinancialDataContext = {
      companyId: 'comp-1',
      period: '2024-03',
      revenue: 1_000_000,
      expenses: 800_000,
      netIncome: 200_000,
      cashBalance: 500_000,
      runway: 12,
      customData: { note: 'x', nested: { a: 1 } },
    }
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper })
    act(() => {
      result.current.setPageContext({ financialData: fd })
    })
    expect(result.current.financialData).toEqual(fd)
  })

  it('accepts an empty financialData object', () => {
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper })
    act(() => {
      result.current.setPageContext({ financialData: {} })
    })
    expect(result.current.financialData).toEqual({})
  })

  it('clears financialData when null is passed to setPageContext', () => {
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper })
    act(() => {
      result.current.setPageContext({ financialData: { revenue: 5 } })
    })
    expect(result.current.financialData).not.toBeNull()
    act(() => {
      result.current.setPageContext({ financialData: null })
    })
    expect(result.current.financialData).toBeNull()
  })

  it('performs a partial update, preserving untouched fields', () => {
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper })
    act(() => {
      result.current.setPageContext({
        pageType: 'reports',
        pageTitle: '月次',
        pagePath: '/reports',
        financialData: { companyId: 'c1', revenue: 100 },
      })
    })
    act(() => {
      result.current.setPageContext({ pageTitle: '年次' })
    })
    expect(result.current.pageTitle).toBe('年次')
    expect(result.current.pageType).toBe('reports')
    expect(result.current.pagePath).toBe('/reports')
    expect(result.current.financialData).toEqual({ companyId: 'c1', revenue: 100 })
  })

  it('is a no-op when setPageContext receives an empty object', () => {
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper })
    act(() => {
      result.current.setPageContext({ pageType: 'kpi', pageTitle: 'K' })
    })
    act(() => {
      result.current.setPageContext({})
    })
    expect(result.current.pageType).toBe('kpi')
    expect(result.current.pageTitle).toBe('K')
  })

  it('accumulates successive setPageContext calls', () => {
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper })
    act(() => {
      result.current.setPageContext({ pageType: 'audit' })
    })
    act(() => {
      result.current.setPageContext({ pageTitle: 'T' })
    })
    act(() => {
      result.current.setPageContext({ pagePath: '/p' })
    })
    act(() => {
      result.current.setPageContext({ financialData: { revenue: 1 } })
    })
    expect(result.current.pageType).toBe('audit')
    expect(result.current.pageTitle).toBe('T')
    expect(result.current.pagePath).toBe('/p')
    expect(result.current.financialData).toEqual({ revenue: 1 })
  })

  it('resets every field to its default via clearPageContext', () => {
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper })
    act(() => {
      result.current.setPageContext({
        pageType: 'audit',
        pageTitle: 'A',
        pagePath: '/x',
        financialData: { revenue: 1 },
      })
    })
    act(() => {
      result.current.clearPageContext()
    })
    expect(result.current.pageType).toBe('other')
    expect(result.current.pageTitle).toBe('')
    expect(result.current.pagePath).toBe('')
    expect(result.current.financialData).toBeNull()
  })

  it('is idempotent when clearPageContext is called on the default state', () => {
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper })
    act(() => {
      result.current.clearPageContext()
    })
    act(() => {
      result.current.clearPageContext()
    })
    expect(result.current.pageType).toBe('other')
    expect(result.current.pageTitle).toBe('')
    expect(result.current.financialData).toBeNull()
  })

  it('keeps setPageContext and clearPageContext referentially stable across renders', () => {
    const { result } = renderHook(() => usePageContext(), { wrapper: Wrapper })
    const setRef = result.current.setPageContext
    const clearRef = result.current.clearPageContext
    act(() => {
      result.current.setPageContext({ pageType: 'chat' })
    })
    expect(result.current.setPageContext).toBe(setRef)
    expect(result.current.clearPageContext).toBe(clearRef)
  })
})
