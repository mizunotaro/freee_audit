'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'

export type PageType =
  | 'dashboard'
  | 'audit'
  | 'reports'
  | 'analysis'
  | 'kpi'
  | 'cashflow'
  | 'budget'
  | 'settings'
  | 'chat'
  | 'journal-proposal'
  | 'conversion'
  | 'tax'
  | 'social-insurance'
  | 'deferred-accrual'
  | 'board'
  | 'investor'
  | 'other'

export interface FinancialDataContext {
  companyId?: string
  period?: string
  revenue?: number
  expenses?: number
  netIncome?: number
  cashBalance?: number
  runway?: number
  customData?: Record<string, unknown>
}

export interface PageContextValue {
  pageType: PageType
  pageTitle: string
  pagePath: string
  financialData: FinancialDataContext | null
  setPageContext: (context: {
    pageType?: PageType
    pageTitle?: string
    pagePath?: string
    financialData?: FinancialDataContext | null
  }) => void
  clearPageContext: () => void
}

const defaultPageContext: PageContextValue = {
  pageType: 'other',
  pageTitle: '',
  pagePath: '',
  financialData: null,
  setPageContext: () => {},
  clearPageContext: () => {},
}

const PageContext = createContext<PageContextValue>(defaultPageContext)

export interface PageContextProviderProps {
  children: ReactNode
}

export function PageContextProvider({ children }: PageContextProviderProps) {
  const [pageType, setPageType] = useState<PageType>('other')
  const [pageTitle, setPageTitle] = useState('')
  const [pagePath, setPagePath] = useState('')
  const [financialData, setFinancialData] = useState<FinancialDataContext | null>(null)

  const setPageContext = useCallback(
    (context: {
      pageType?: PageType
      pageTitle?: string
      pagePath?: string
      financialData?: FinancialDataContext | null
    }) => {
      if (context.pageType !== undefined) setPageType(context.pageType)
      if (context.pageTitle !== undefined) setPageTitle(context.pageTitle)
      if (context.pagePath !== undefined) setPagePath(context.pagePath)
      if (context.financialData !== undefined) setFinancialData(context.financialData)
    },
    []
  )

  const clearPageContext = useCallback(() => {
    setPageType('other')
    setPageTitle('')
    setPagePath('')
    setFinancialData(null)
  }, [])

  useEffect(() => {
    setPagePath(window.location.pathname)
  }, [])

  return (
    <PageContext.Provider
      value={{
        pageType,
        pageTitle,
        pagePath,
        financialData,
        setPageContext,
        clearPageContext,
      }}
    >
      {children}
    </PageContext.Provider>
  )
}

export function usePageContext(): PageContextValue {
  const context = useContext(PageContext)
  if (context === undefined) {
    throw new Error('usePageContext must be used within a PageContextProvider')
  }
  return context
}

export function inferPageTypeFromPath(path: string): PageType {
  if (path.includes('/dashboard')) return 'dashboard'
  if (path.includes('/audit')) return 'audit'
  if (path.includes('/reports/kpi')) return 'kpi'
  if (path.includes('/reports/cashflow')) return 'cashflow'
  if (path.includes('/reports/budget')) return 'budget'
  if (path.includes('/reports')) return 'reports'
  if (path.includes('/analysis')) return 'analysis'
  if (path.includes('/settings')) return 'settings'
  if (path.includes('/chat')) return 'chat'
  if (path.includes('/journal-proposal')) return 'journal-proposal'
  if (path.includes('/conversion')) return 'conversion'
  if (path.includes('/tax')) return 'tax'
  if (path.includes('/social-insurance')) return 'social-insurance'
  if (path.includes('/deferred-accrual')) return 'deferred-accrual'
  if (path.includes('/board')) return 'board'
  if (path.includes('/investor')) return 'investor'
  return 'other'
}

export function getPageTypeLabel(pageType: PageType, language: 'ja' | 'en' = 'ja'): string {
  const labels: Record<PageType, { ja: string; en: string }> = {
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
  return labels[pageType]?.[language] ?? labels.other[language]
}
