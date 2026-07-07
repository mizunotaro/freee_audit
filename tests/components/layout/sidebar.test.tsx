import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Sidebar } from '@/components/layout/sidebar'

const { nav } = vi.hoisted(() => ({ nav: { pathname: '/ja/dashboard' } }))

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

const adminUser = { name: 'Alice Tanaka', email: 'alice@example.com', role: 'ADMIN' }
const viewerUser = { name: 'Bob Sato', email: 'bob@example.com', role: 'VIEWER' }

describe('Sidebar', () => {
  beforeEach(() => {
    nav.pathname = '/ja/dashboard'
  })

  it('renders the brand and a single menu trigger while the sheet is closed', () => {
    render(<Sidebar user={adminUser} locale="ja" />)
    expect(screen.getAllByText('freee_audit')).toHaveLength(1)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('reveals the navigation links when the sheet is opened (admin)', async () => {
    render(<Sidebar user={adminUser} locale="ja" />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(screen.getByText('journalProposal')).toBeInTheDocument()
    })
    expect(screen.getByText('dashboard')).toBeInTheDocument()
    expect(screen.getByText('settings')).toBeInTheDocument()
    expect(screen.getByText('Alice Tanaka')).toBeInTheDocument()
  })

  it('shows the user role text in the menu trigger after opening', async () => {
    render(<Sidebar user={adminUser} locale="ja" />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(screen.getByText('ADMIN')).toBeInTheDocument()
    })
  })

  it('hides the role-gated item for a viewer when the sheet is opened', async () => {
    render(<Sidebar user={viewerUser} locale="ja" />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(screen.getByText('dashboard')).toBeInTheDocument()
    })
    expect(screen.queryByText('journalProposal')).toBeNull()
  })
})
