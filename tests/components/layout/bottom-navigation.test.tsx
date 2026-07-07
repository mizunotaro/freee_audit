import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BottomNavigation } from '@/components/layout/bottom-navigation'

const { nav } = vi.hoisted(() => ({ nav: { pathname: '/ja/dashboard' } }))

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

describe('BottomNavigation', () => {
  beforeEach(() => {
    nav.pathname = '/ja/dashboard'
  })

  it('renders exactly five navigation links', () => {
    render(<BottomNavigation locale="ja" />)
    expect(screen.getAllByRole('link')).toHaveLength(5)
  })

  it('prefixes every href with the locale', () => {
    render(<BottomNavigation locale="ja" />)
    const links = screen.getAllByRole('link')
    for (const link of links) {
      expect(link.getAttribute('href')).toMatch(/^\/ja\//)
    }
  })

  it('renders one localized label per item', () => {
    render(<BottomNavigation locale="ja" />)
    expect(screen.getByText('dashboard')).toBeInTheDocument()
    expect(screen.getByText('reports')).toBeInTheDocument()
    expect(screen.getByText('audit')).toBeInTheDocument()
    expect(screen.getByText('budgets')).toBeInTheDocument()
    expect(screen.getByText('settings')).toBeInTheDocument()
  })

  it('honors a non-default locale in the hrefs', () => {
    render(<BottomNavigation locale="en" />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(5)
    for (const link of links) {
      expect(link.getAttribute('href')).toMatch(/^\/en\//)
    }
  })

  it('marks the item whose href is a prefix of the pathname as active', () => {
    nav.pathname = '/ja/reports/monthly'
    render(<BottomNavigation locale="ja" />)
    const reports = screen.getByText('reports').closest('a')
    const dashboard = screen.getByText('dashboard').closest('a')
    if (!reports || !dashboard) throw new Error('nav anchor not found')
    expect(reports).toHaveClass('text-primary')
    expect(dashboard).not.toHaveClass('text-primary')
  })
})
