import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { DockSidebar } from '@/components/layout/dock-sidebar'

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

const user = (role: string) => ({ name: 'Taro Yamada', email: 'taro@example.com', role })

describe('DockSidebar', () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue('/test')
  })

  it('renders locale-prefixed links and avatar initials', () => {
    render(<DockSidebar user={user('ADMIN')} locale="ja" />)

    expect(screen.getByRole('link', { name: 'dashboard' })).toHaveAttribute('href', '/ja/dashboard')
    expect(screen.getByRole('link', { name: 'settings' })).toHaveAttribute('href', '/ja/settings')
    expect(screen.getByText('TY')).toBeInTheDocument()
  })

  it('hides accountant-only entries from a VIEWER', () => {
    render(<DockSidebar user={user('VIEWER')} locale="ja" />)

    expect(screen.getByText('dashboard')).toBeInTheDocument()
    expect(screen.queryByText('journalProposal')).toBeNull()
  })

  it('shows accountant-only entries for an ACCOUNTANT', () => {
    render(<DockSidebar user={user('ACCOUNTANT')} locale="ja" />)

    expect(screen.getByText('journalProposal')).toBeInTheDocument()
  })

  it('highlights the entry whose href is a pathname prefix', () => {
    pathnameMock.mockReturnValue('/ja/dashboard')
    render(<DockSidebar user={user('ADMIN')} locale="ja" />)

    expect(screen.getByRole('link', { name: 'dashboard' })).toHaveClass('bg-accent/50')
    expect(screen.getByRole('link', { name: 'settings' })).not.toHaveClass('bg-accent/50')
  })
})

describe('DockSidebar expansion', () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue('/test')
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('expands on hover and collapses after the leave delay', () => {
    render(<DockSidebar user={user('ADMIN')} locale="ja" />)

    const aside = document.querySelector('aside') as HTMLElement

    // collapsed initially: the compact "F" badge is shown
    expect(screen.getByText('F')).toBeInTheDocument()

    fireEvent.mouseEnter(aside)
    // expanded: the "F" badge is hidden
    expect(screen.queryByText('F')).toBeNull()

    fireEvent.mouseLeave(aside)
    // still expanded until the 1000ms collapse timer fires
    expect(screen.queryByText('F')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('F')).toBeInTheDocument()
  })

  it('cancels the pending collapse timer when re-entered before it fires', () => {
    render(<DockSidebar user={user('ADMIN')} locale="ja" />)

    const aside = document.querySelector('aside') as HTMLElement

    fireEvent.mouseEnter(aside) // expand
    fireEvent.mouseLeave(aside) // schedule collapse in 1000ms
    fireEvent.mouseEnter(aside) // re-enter before the timer fires → cancel it

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // timer was cancelled, so the sidebar stays expanded (compact "F" hidden)
    expect(screen.queryByText('F')).toBeNull()
  })
})
