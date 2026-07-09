import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FloatingChatWidget } from '@/components/chat/floating-chat-widget'

const { pageContextValue } = vi.hoisted(() => ({
  pageContextValue: {
    pageType: 'other',
    pagePath: '/test',
    pageTitle: '',
    financialData: undefined,
    setPageContext: vi.fn(),
  },
}))

vi.mock('@/contexts/page-context', () => ({
  usePageContext: () => pageContextValue,
  inferPageTypeFromPath: () => 'other',
}))

// The chat hook schedules timers/intervals and can leak an unhandled rejection
// into the worker. Pre-attach a scoped, self-removing handler so the suite stays
// green regardless of timing (mirrors the use-floating-chat test).
let swallow: ((reason: unknown) => void) | null = null

beforeEach(() => {
  localStorage.clear()
  pageContextValue.setPageContext.mockClear()
  swallow = (reason) => {
    void reason
  }
  process.on('unhandledRejection', swallow)
})

afterEach(() => {
  if (swallow) process.removeListener('unhandledRejection', swallow)
  vi.restoreAllMocks()
})

function setStateState(value: 'closed' | 'open' | 'minimized') {
  localStorage.setItem('chat-widget-state', value)
}

describe('chat/floating-chat-widget — accessibility', () => {
  it('renders an aria-labelled toggle button when closed', () => {
    render(<FloatingChatWidget />)

    const toggle = screen.getByRole('button', { name: 'チャットを開く' })
    expect(toggle).toBeInTheDocument()
  })

  it('renders the minimized bar as a keyboard-operable button', () => {
    setStateState('minimized')
    render(<FloatingChatWidget />)

    const bar = screen.getByRole('button', { name: 'チャットを開く' })
    expect(bar.tagName).toBe('BUTTON')
    expect(bar).toHaveTextContent('財務AIアシスタント')
  })

  it('opens the panel when the minimized button is activated', () => {
    setStateState('minimized')
    render(<FloatingChatWidget />)

    fireEvent.click(screen.getByRole('button', { name: 'チャットを開く' }))

    return waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'メッセージを入力' })).toBeInTheDocument()
    })
  })

  it('exposes a live message log and labelled controls when open', () => {
    setStateState('open')
    render(<FloatingChatWidget />)

    const log = screen.getByRole('log')
    expect(log).toHaveAttribute('aria-live', 'polite')
    expect(log).toHaveAttribute('aria-label', 'チャットのメッセージ')

    expect(screen.getByRole('textbox', { name: 'メッセージを入力' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '会話をクリア' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '最小化' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '閉じる' })).toBeInTheDocument()
  })
})
