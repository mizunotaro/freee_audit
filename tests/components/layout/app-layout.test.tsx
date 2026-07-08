import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn(() => '/test') }))

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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

describe('AppLayout', () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue('/test')
  })

  it('renders the brand link and the provided children', () => {
    render(
      <AppLayout>
        <main>page-content</main>
      </AppLayout>
    )

    expect(screen.getByText('freee監査システム')).toBeInTheDocument()
    expect(screen.getByText('page-content')).toBeInTheDocument()
  })

  it('renders the title segment only when a title is provided', () => {
    const { rerender } = render(<AppLayout title="月次">body</AppLayout>)
    expect(screen.getByText('/ 月次')).toBeInTheDocument()

    rerender(<AppLayout>body</AppLayout>)
    expect(screen.queryByText('/ 月次')).toBeNull()
  })

  it('renders the navigation entries in both the desktop and mobile bars', () => {
    render(<AppLayout>body</AppLayout>)

    expect(screen.getAllByText('月次レポート')).toHaveLength(2)
    expect(screen.getAllByText('設定')).toHaveLength(2)
    expect(screen.getAllByText('記帳診断')).toHaveLength(2)
  })

  it('marks the entry whose href exactly matches the pathname as active', () => {
    pathnameMock.mockReturnValue('/reports/monthly')
    render(<AppLayout>body</AppLayout>)

    const active = screen.getAllByRole('link', { name: /月次レポート/ })
    const inactive = screen.getAllByRole('link', { name: /^設定$/ })

    expect(active).toHaveLength(2)
    for (const link of active) {
      expect(link).toHaveClass('bg-primary-100')
    }
    for (const link of inactive) {
      expect(link).not.toHaveClass('bg-primary-100')
    }
  })
})
