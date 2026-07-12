import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'

const { pathnameMock } = vi.hoisted(() => ({
  pathnameMock: vi.fn<() => string | null>(() => '/test'),
}))

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

  it('renders the home brand link pointing at the root path', () => {
    render(<AppLayout>body</AppLayout>)

    const brand = screen.getByRole('link', { name: /freee監査システム/ })
    expect(brand).toHaveAttribute('href', '/')
  })

  it('renders every navigation entry exactly once in each bar (desktop + mobile)', () => {
    render(<AppLayout>body</AppLayout>)

    const labels = [
      '月次レポート',
      '多期間レポート',
      '予実管理',
      '経営指標',
      'KPI設定',
      '資金繰り表',
      '事業報告書',
      '税金管理',
      '取締役会',
      '記帳診断',
      '経費監査',
      '発生主義チェック',
      '設定',
    ]
    for (const label of labels) {
      expect(screen.getAllByText(label)).toHaveLength(2)
    }
  })

  it('renders the header settings gear as a /settings link distinct from the nav entry', () => {
    render(<AppLayout>body</AppLayout>)

    const settingsLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === '/settings')
    // two "設定" nav links (desktop + mobile) plus one icon-only gear link
    expect(settingsLinks).toHaveLength(3)
    expect(settingsLinks.some((link) => link.classList.contains('rounded-full'))).toBe(true)
  })

  it('does not highlight any entry when the pathname matches no nav href (fail-safe)', () => {
    pathnameMock.mockReturnValue('/nonexistent')
    render(<AppLayout>body</AppLayout>)

    const active = screen
      .getAllByRole('link')
      .filter((link) => link.classList.contains('bg-primary-100'))
    expect(active).toHaveLength(0)
  })

  it('treats active matching as exact: a deeper pathname does not activate the parent entry', () => {
    pathnameMock.mockReturnValue('/reports/monthly/2024')
    render(<AppLayout>body</AppLayout>)

    for (const link of screen.getAllByRole('link', { name: /月次レポート/ })) {
      expect(link).not.toHaveClass('bg-primary-100')
    }
  })

  it('does not crash and highlights nothing when usePathname returns null', () => {
    pathnameMock.mockReturnValue(null)
    render(<AppLayout>body</AppLayout>)

    expect(screen.getByText('freee監査システム')).toBeInTheDocument()
    const active = screen
      .getAllByRole('link')
      .filter((link) => link.classList.contains('bg-primary-100'))
    expect(active).toHaveLength(0)
  })

  it('treats an empty-string title as absent and renders no separator segment', () => {
    render(<AppLayout title="">body</AppLayout>)

    expect(screen.queryByText(/\/\s/)).toBeNull()
  })
})
