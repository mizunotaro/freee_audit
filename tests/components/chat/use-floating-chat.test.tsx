import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useFloatingChat } from '@/components/chat/hooks'
import { DEFAULT_WIDGET_SIZE, MIN_WIDGET_SIZE, MAX_WIDGET_SIZE } from '@/components/chat/types'

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

const STORAGE = {
  state: 'chat-widget-state',
  position: 'chat-widget-position',
  size: 'chat-widget-size',
  session: 'chat-session',
}

function successJson(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      sessionId: 'sess-1',
      response: {
        summary: 'はい、確認しました。',
        personaAnalyses: [],
        consensusPoints: [],
        recommendedAction: '',
        confidence: 0.9,
      },
      ...overrides,
    }),
  } as unknown as Response
}

// Known vitest worker-crash pattern: a hook that schedules timers/intervals and
// performs async IO can leak an unhandled rejection into the worker. Pre-attach a
// scoped, self-removing handler so the suite stays green regardless of timing.
let swallow: ((reason: unknown) => void) | null = null
beforeEach(() => {
  localStorage.clear()
  pageContextValue.setPageContext.mockClear()
  swallow = (reason) => {
    // Intentionally swallowed — see comment above.
    void reason
  }
  process.on('unhandledRejection', swallow)
})
afterEach(() => {
  if (swallow) process.removeListener('unhandledRejection', swallow)
  vi.restoreAllMocks()
})

describe('chat/use-floating-chat — initial state & persistence', () => {
  it('defaults to closed with default size when nothing is persisted', () => {
    const { result } = renderHook(() => useFloatingChat())
    expect(result.current.state).toBe('closed')
    expect(result.current.size).toEqual(DEFAULT_WIDGET_SIZE)
    expect(result.current.messages).toEqual([])
    expect(result.current.unreadCount).toBe(0)
  })

  it('honours defaultOpen=true when persistence is disabled', () => {
    const { result } = renderHook(() => useFloatingChat({ persistState: false, defaultOpen: true }))
    expect(result.current.state).toBe('open')
  })

  it('hydrates state, size, and session from localStorage', () => {
    localStorage.setItem(STORAGE.state, 'minimized')
    localStorage.setItem(STORAGE.size, JSON.stringify({ width: 420, height: 460 }))
    localStorage.setItem(
      STORAGE.session,
      JSON.stringify({
        id: 'old-session',
        messages: [
          { id: 'm1', role: 'user', content: '前回の質問', timestamp: '2024-01-01T00:00:00.000Z' },
        ],
        updatedAt: '2024-01-01T00:00:00.000Z',
      })
    )

    const { result } = renderHook(() => useFloatingChat())

    expect(result.current.state).toBe('minimized')
    expect(result.current.size).toEqual({ width: 420, height: 460 })
    expect(result.current.sessionId).toBe('old-session')
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].content).toBe('前回の質問')
    expect(result.current.messages[0].timestamp).toBeInstanceOf(Date)
  })

  it('falls back to defaults when persisted size JSON is corrupt', () => {
    localStorage.setItem(STORAGE.size, '{not json')
    const { result } = renderHook(() => useFloatingChat())
    expect(result.current.size).toEqual(DEFAULT_WIDGET_SIZE)
  })

  it('persists state transitions to localStorage', () => {
    const { result } = renderHook(() => useFloatingChat())
    expect(localStorage.getItem(STORAGE.state)).toBe('closed')

    act(() => result.current.open())
    expect(result.current.state).toBe('open')
    expect(localStorage.getItem(STORAGE.state)).toBe('open')

    act(() => result.current.minimize())
    expect(result.current.state).toBe('minimized')
    expect(localStorage.getItem(STORAGE.state)).toBe('minimized')

    act(() => result.current.close())
    expect(result.current.state).toBe('closed')
  })

  it('toggle flips closed<->open and collapses open/minimized back to closed', () => {
    const { result } = renderHook(() => useFloatingChat())

    act(() => result.current.toggle())
    expect(result.current.state).toBe('open')

    act(() => result.current.toggle())
    expect(result.current.state).toBe('closed')

    act(() => result.current.minimize())
    act(() => result.current.toggle())
    expect(result.current.state).toBe('closed')
  })
})

describe('chat/use-floating-chat — position & size setters', () => {
  it('stores the raw position and persists it', () => {
    const { result } = renderHook(() => useFloatingChat())
    act(() => result.current.setPosition({ x: 7, y: 9 }))
    expect(result.current.position).toEqual({ x: 7, y: 9 })
    expect(localStorage.getItem(STORAGE.position)).toBe(JSON.stringify({ x: 7, y: 9 }))
  })

  it('clamps oversized size to MAX and persists the clamped value', () => {
    const { result } = renderHook(() => useFloatingChat())
    act(() => result.current.setSize({ width: 9999, height: 9999 }))
    expect(result.current.size).toEqual(MAX_WIDGET_SIZE)
    expect(localStorage.getItem(STORAGE.size)).toBe(JSON.stringify(MAX_WIDGET_SIZE))
  })

  it('clamps undersized size to MIN', () => {
    const { result } = renderHook(() => useFloatingChat())
    act(() => result.current.setSize({ width: 1, height: 1 }))
    expect(result.current.size).toEqual(MIN_WIDGET_SIZE)
  })
})

describe('chat/use-floating-chat — message housekeeping', () => {
  it('clearMessages empties the list and resets the session id', () => {
    const { result } = renderHook(() => useFloatingChat())
    act(() => result.current.clearMessages())
    expect(result.current.messages).toEqual([])
    expect(result.current.sessionId).toBe('')
  })

  it('markAsRead resets the unread counter', async () => {
    const { result } = renderHook(() => useFloatingChat())
    // Closed widget + a successful reply increments unread.
    global.fetch = vi.fn().mockResolvedValue(successJson())
    await act(async () => {
      await result.current.sendMessage('質問')
    })
    await waitFor(() => expect(result.current.unreadCount).toBe(1))

    act(() => result.current.markAsRead())
    expect(result.current.unreadCount).toBe(0)
  })
})

describe('chat/use-floating-chat — sendMessage', () => {
  it('ignores blank content without calling the API', async () => {
    const { result } = renderHook(() => useFloatingChat())
    global.fetch = vi.fn()
    await act(async () => {
      await result.current.sendMessage('   ')
    })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('appends user + assistant messages on success and clears loading', async () => {
    const { result } = renderHook(() => useFloatingChat())
    act(() => result.current.open())
    global.fetch = vi.fn().mockResolvedValue(successJson())

    await act(async () => {
      await result.current.sendMessage(' 分析して ')
    })

    await waitFor(() => expect(result.current.isLoading).toBe(false))

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const messages = result.current.messages
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toBe('分析して')
    expect(messages[1].role).toBe('assistant')
    expect(messages[1].content).toBe('はい、確認しました。')
    expect(messages.some((m) => m.isLoading)).toBe(false)
    expect(result.current.sessionId).toBe('sess-1')
    // Open widget does not increment unread.
    expect(result.current.unreadCount).toBe(0)
  })

  it('posts the trimmed message, sessionId, and page context in the body', async () => {
    const { result } = renderHook(() => useFloatingChat())
    global.fetch = vi.fn().mockResolvedValue(successJson())

    await act(async () => {
      await result.current.sendMessage(' 質問 ')
    })

    const init = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit
    const body = JSON.parse(init.body as string)
    expect(body.message).toBe('質問')
    expect(body.context.language).toBe('ja')
    expect(body.context.pagePath).toBe('/test')
  })

  it('surfaces the server error message when success=false', async () => {
    const { result } = renderHook(() => useFloatingChat())
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        sessionId: '',
        error: { code: 'BUSY', message: 'サーバー混雑中' },
      }),
    } as unknown as Response)

    await act(async () => {
      await result.current.sendMessage('質問')
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const last = result.current.messages[result.current.messages.length - 1]
    expect(last.role).toBe('assistant')
    expect(last.content).toContain('サーバー混雑中')
  })

  it('shows the network-error message when fetch rejects', async () => {
    const { result } = renderHook(() => useFloatingChat())
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'))

    await act(async () => {
      await result.current.sendMessage('質問')
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const last = result.current.messages[result.current.messages.length - 1]
    expect(last.role).toBe('assistant')
    expect(last.content).toBe('通信エラーが発生しました。もう一度お試しください。')
  })

  it('shows the timeout message when fetch rejects with an AbortError', async () => {
    const { result } = renderHook(() => useFloatingChat())
    const abortErr = new Error('aborted')
    abortErr.name = 'AbortError'
    global.fetch = vi.fn().mockRejectedValue(abortErr)

    await act(async () => {
      await result.current.sendMessage('質問')
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    const last = result.current.messages[result.current.messages.length - 1]
    expect(last.content).toBe('リクエストがタイムアウトしました。もう一度お試しください。')
  })
})
