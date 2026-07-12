import React from 'react'
import type { ReactNode } from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { KPIPageHeader } from '@/components/reports/kpi/kpi-page-header'

vi.mock('next/link', () => ({
  default: ({
    href,
    className,
    children,
  }: {
    href: string
    className?: string
    children: ReactNode
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

const NAV_LINKS = [
  { label: '月次レポート', href: '/reports/monthly', active: false },
  { label: '資金繰り表', href: '/reports/cashflow', active: false },
  { label: '予実管理', href: '/reports/budget', active: false },
  { label: '経営指標', href: '/reports/kpi', active: true },
] as const

describe('KPIPageHeader', () => {
  it('renders without throwing and exposes a header (banner) landmark', () => {
    const { container } = render(<KPIPageHeader />)
    expect(container.firstChild).not.toBeNull()
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('renders the dashboard title as a level-1 heading', () => {
    render(<KPIPageHeader />)
    expect(
      screen.getByRole('heading', { level: 1, name: '経営指標ダッシュボード' })
    ).toBeInTheDocument()
  })

  it('renders a navigation landmark', () => {
    render(<KPIPageHeader />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })

  it('renders exactly four navigation links', () => {
    render(<KPIPageHeader />)
    expect(screen.getAllByRole('link')).toHaveLength(4)
  })

  it.each(NAV_LINKS)('renders the "$label" link pointing at $href', ({ label, href }) => {
    render(<KPIPageHeader />)
    const link = screen.getByRole('link', { name: label })
    expect(link).toHaveAttribute('href', href)
    cleanup()
  })

  it('renders the nav links in the documented order', () => {
    render(<KPIPageHeader />)
    const labels = screen.getAllByRole('link').map((link) => link.textContent)
    expect(labels).toEqual(['月次レポート', '資金繰り表', '予実管理', '経営指標'])
  })

  it('marks only the current (KPI) link as active and the rest as inactive', () => {
    render(<KPIPageHeader />)

    const active = screen.getByRole('link', { name: '経営指標' })
    expect(active).toHaveClass('text-primary-600', 'font-medium')
    expect(active).not.toHaveClass('text-gray-500')

    for (const label of ['月次レポート', '資金繰り表', '予実管理']) {
      const link = screen.getByRole('link', { name: label })
      expect(link).toHaveClass('text-gray-500', 'hover:text-gray-700')
      expect(link).not.toHaveClass('text-primary-600')
    }
  })

  it('renders an identical, prop-free structure on every render (deterministic, fail-safe default chrome)', () => {
    const first = render(<KPIPageHeader />)
    const firstHtml = first.container.innerHTML
    first.unmount()

    const second = render(<KPIPageHeader />)
    expect(second.container.innerHTML).toBe(firstHtml)

    // Fail-safe contract: with no inputs whatsoever, the header still surfaces
    // the title and all four navigation targets.
    expect(screen.getByText('経営指標ダッシュボード')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(4)
  })

  it('exports KPIPageHeader as a named React function component that returns a single element', () => {
    expect(typeof KPIPageHeader).toBe('function')
    expect(KPIPageHeader.name).toBe('KPIPageHeader')
    expect(React.isValidElement(KPIPageHeader())).toBe(true)
  })
})
