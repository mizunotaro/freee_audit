import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { DockSidebar } from '@/components/layout/dock-sidebar'

const { nav } = vi.hoisted(() => ({ nav: { pathname: '/ja/dashboard' } }))

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const adminUser = { name: 'Alice Tanaka', email: 'alice@example.com', role: 'ADMIN' }
const viewerUser = { name: 'Bob Sato', email: 'bob@example.com', role: 'VIEWER' }

describe('DockSidebar', () => {
  beforeEach(() => {
    nav.pathname = '/ja/dashboard'
  })

  it('renders the collapsed brand marker when collapsed', () => {
    render(<DockSidebar user={adminUser} locale="ja" />)
    expect(screen.getByText('F')).toBeInTheDocument()
  })

  it('renders all nav items for an admin including the role-gated one', () => {
    render(<DockSidebar user={adminUser} locale="ja" />)
    // brand link(1) + 17 nav items (journalProposal requires ACCOUNTANT; admin passes)
    expect(screen.getAllByRole('link')).toHaveLength(18)
    expect(screen.getByText('journalProposal')).toBeInTheDocument()
  })

  it('hides the role-gated item for a viewer', () => {
    render(<DockSidebar user={viewerUser} locale="ja" />)
    // brand link(1) + 16 nav items (journalProposal filtered out)
    expect(screen.getAllByRole('link')).toHaveLength(17)
    expect(screen.queryByText('journalProposal')).toBeNull()
  })

  it('renders the user initials in the avatar fallback', () => {
    render(<DockSidebar user={adminUser} locale="ja" />)
    expect(screen.getByText('AT')).toBeInTheDocument()
  })

  it('expands on mouse enter and reveals the full width brand', () => {
    render(<DockSidebar user={adminUser} locale="ja" />)
    const aside = screen.getByRole('complementary')
    expect(screen.getByText('F')).toBeInTheDocument()
    fireEvent.mouseEnter(aside)
    expect(screen.queryByText('F')).toBeNull()
    expect(aside).toHaveClass('w-[200px]')
  })

  it('collapses again after the mouse-leave delay elapses', () => {
    vi.useFakeTimers()
    try {
      render(<DockSidebar user={adminUser} locale="ja" />)
      const aside = screen.getByRole('complementary')
      fireEvent.mouseEnter(aside)
      expect(screen.queryByText('F')).toBeNull()
      fireEvent.mouseLeave(aside)
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(screen.getByText('F')).toBeInTheDocument()
      expect(aside).toHaveClass('w-16')
    } finally {
      vi.useRealTimers()
    }
  })
})
