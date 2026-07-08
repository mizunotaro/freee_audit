import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { BottomNavigation } from '@/components/layout/bottom-navigation'

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

describe('BottomNavigation', () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue('/test')
  })

  it('renders one link per entry with locale-prefixed hrefs', () => {
    render(<BottomNavigation locale="ja" />)

    const expected: ReadonlyArray<readonly [string, string]> = [
      ['dashboard', '/ja/dashboard'],
      ['reports', '/ja/reports'],
      ['audit', '/ja/audit/journals'],
      ['budgets', '/ja/budgets'],
      ['settings', '/ja/settings'],
    ]

    for (const [key, href] of expected) {
      expect(screen.getByRole('link', { name: key })).toHaveAttribute('href', href)
    }
  })

  it('prefixes hrefs with the provided locale', () => {
    render(<BottomNavigation locale="en" />)
    expect(screen.getByRole('link', { name: 'dashboard' })).toHaveAttribute('href', '/en/dashboard')
  })

  it('highlights the entry whose href is a pathname prefix', () => {
    pathnameMock.mockReturnValue('/ja/reports')
    render(<BottomNavigation locale="ja" />)

    expect(screen.getByRole('link', { name: 'reports' })).toHaveClass('text-primary')
    expect(screen.getByRole('link', { name: 'dashboard' })).not.toHaveClass('text-primary')
  })
})
