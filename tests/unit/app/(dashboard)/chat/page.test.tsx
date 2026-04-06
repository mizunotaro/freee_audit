import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChatPage from '@/app/(dashboard)/chat/page'

describe('ChatPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const mockSuccessResponse = {
    success: true,
    sessionId: 'chat-session-1',
    response: {
      summary: 'AIからの回答',
      personaAnalyses: [],
      consensusPoints: [],
      recommendedAction: 'test',
      confidence: 0.9,
    },
  }

  it('should render page header', () => {
    render(<ChatPage />)
    expect(screen.getByText('財務AIアシスタント')).toBeInTheDocument()
    expect(screen.getByText(/公認会計士、税理士、CFO、財務アナリストの視点から分析します/)).toBeInTheDocument()
  })

  it('should render suggestion chips in empty state', () => {
    render(<ChatPage />)
    expect(screen.getByText('財務分析AIアシスタント')).toBeInTheDocument()
    expect(screen.getByText('今期の決算書を分析して')).toBeInTheDocument()
  })

  it('should send message and display response', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockSuccessResponse,
    } as Response)

    render(<ChatPage />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, '分析して{Enter}')

    await waitFor(() => {
      expect(screen.getByText('分析して')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText('AIからの回答')).toBeInTheDocument()
    })
  })

  it('should display error message on API failure', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        error: { message: 'サーバーエラー' },
      }),
    } as Response)

    render(<ChatPage />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'テスト{Enter}')

    await waitFor(() => {
      expect(screen.getByText(/サーバーエラー/)).toBeInTheDocument()
    })
  })

  it('should display timeout error on abort', async () => {
    const user = userEvent.setup()
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError)

    render(<ChatPage />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'テスト{Enter}')

    await waitFor(() => {
      expect(screen.getByText(/タイムアウト/)).toBeInTheDocument()
    })
  })

  it('should display network error on fetch failure', async () => {
    const user = userEvent.setup()
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    render(<ChatPage />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'テスト{Enter}')

    await waitFor(() => {
      expect(screen.getByText(/通信エラー/)).toBeInTheDocument()
    })
  })
})
