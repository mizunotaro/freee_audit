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
