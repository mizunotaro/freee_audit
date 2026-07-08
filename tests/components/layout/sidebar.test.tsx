import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/sidebar'

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn(() => '/test') }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

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

// The mobile drawer is a Radix Sheet whose content mounts only when opened.
// Sidebar's own logic (role filtering, locale hrefs, initials) lives in the
// rendered children, so we stub the Sheet primitives to render children inline.
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

const user = (role: string) => ({ name: 'Taro Yamada', email: 'taro@example.com', role })

describe('Sidebar', () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue('/test')
  })

  it('renders the brand link with a locale-prefixed dashboard href', () => {
    render(<Sidebar user={user('ADMIN')} locale="ja" />)

    const brand = screen.getAllByRole('link', { name: 'freee_audit' })[0]
    expect(brand).toHaveAttribute('href', '/ja/dashboard')
  })

  it('hides accountant-only entries from a VIEWER and renders initials', () => {
    render(<Sidebar user={user('VIEWER')} locale="ja" />)

    expect(screen.getByText('dashboard')).toBeInTheDocument()
    expect(screen.queryByText('journalProposal')).toBeNull()
    expect(screen.getByText('TY')).toBeInTheDocument()
  })

  it('shows accountant-only entries for an ACCOUNTANT', () => {
    render(<Sidebar user={user('ACCOUNTANT')} locale="ja" />)

    expect(screen.getByText('journalProposal')).toBeInTheDocument()
  })
})
