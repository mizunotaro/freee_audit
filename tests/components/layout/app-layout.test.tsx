import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppLayout } from '@/components/layout/AppLayout'

// Per-file pathname override (takes precedence over the global tests/setup.ts mock)
const { nav } = vi.hoisted(() => ({ nav: { pathname: '/ja/dashboard' } }))

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
}))

describe('AppLayout', () => {
  beforeEach(() => {
    nav.pathname = '/ja/dashboard'
  })

  it('renders the brand title', () => {
    render(<AppLayout>body</AppLayout>)
    expect(screen.getByText('freee監査システム')).toBeInTheDocument()
  })

  it('renders children inside the main region', () => {
    render(
      <AppLayout>
        <div>child-content-xyz</div>
      </AppLayout>
    )
    expect(screen.getByText('child-content-xyz')).toBeInTheDocument()
  })

  it('omits the title segment when no title is provided', () => {
    render(<AppLayout>body</AppLayout>)
    const titleSegment = screen.queryByText(
      (content) => content.trim().startsWith('/') && content.trim().length > 1
    )
    expect(titleSegment).toBeNull()
  })

  it('renders the title segment when a title is provided', () => {
    render(<AppLayout title="セグメントXYZ">body</AppLayout>)
    expect(screen.getByText((content) => content.includes('セグメントXYZ'))).toBeInTheDocument()
  })

  it('renders every nav item in both the desktop and mobile menus', () => {
    render(<AppLayout>body</AppLayout>)
    // 13 navItems, each rendered twice (desktop md:flex + mobile md:hidden)
    expect(screen.getAllByText('月次レポート')).toHaveLength(2)
    expect(screen.getAllByText('設定')).toHaveLength(2)
  })

  it('renders the expected total number of links', () => {
    render(<AppLayout>body</AppLayout>)
    // home brand(1) + desktop nav(13) + mobile nav(13) + settings gear(1) = 28
    expect(screen.getAllByRole('link')).toHaveLength(28)
  })

  it('marks the nav item whose href exactly matches the pathname as active', () => {
    nav.pathname = '/budgets'
    render(<AppLayout>body</AppLayout>)
    const active = screen.getAllByText('予実管理')
    expect(active).toHaveLength(2)
    for (const node of active) {
      const link = node.closest('a')
      if (!link) throw new Error('active nav anchor not found')
      expect(link).toHaveClass('bg-primary-100')
    }
    const inactive = screen.getAllByText('月次レポート')
    for (const node of inactive) {
      const link = node.closest('a')
      if (!link) throw new Error('inactive nav anchor not found')
      expect(link).not.toHaveClass('bg-primary-100')
    }
  })
})
