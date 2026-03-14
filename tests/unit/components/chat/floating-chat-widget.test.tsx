import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FloatingChatWidget } from '@/components/chat/floating-chat-widget'

const mockFetch = vi.fn()

global.fetch = mockFetch

describe('FloatingChatWidget', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
  })

  describe('初期状態', () => {
    it('閉じた状態でレンダリングされる', () => {
      render(<FloatingChatWidget />)

      expect(screen.getByRole('button', { name: /message-circle/i })).toBeInTheDocument()
    })

    it('クリックで開く', () => {
      render(<FloatingChatWidget />)

      const button = screen.getByRole('button', { name: /message-circle/i })
      fireEvent.click(button)

      expect(screen.getByText('財務AIアシスタント')).toBeInTheDocument()
    })
  })

  describe('チャット機能', () => {
    it('メッセージを送信できる', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          sessionId: 'test-session',
          response: {
            summary: 'テスト回答',
            personaAnalyses: [],
            consensusPoints: [],
            confidence: 0.9,
          },
        }),
      })

      render(<FloatingChatWidget />)

      const button = screen.getByRole('button', { name: /message-circle/i })
      fireEvent.click(button)

      const input = screen.getByPlaceholderText('財務に関する質問を入力...')
      fireEvent.change(input, { target: { value: 'テスト質問' } })
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/chat',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('テスト質問'),
          })
        )
      })
    })

    it('エラー時にエラーメッセージを表示', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          sessionId: '',
          error: { code: 'test_error', message: 'テストエラー' },
        }),
      })

      render(<FloatingChatWidget />)

      const button = screen.getByRole('button', { name: /message-circle/i })
      fireEvent.click(button)

      const input = screen.getByPlaceholderText('財務に関する質問を入力...')
      fireEvent.change(input, { target: { value: 'エラーテスト' } })
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

      await waitFor(() => {
        expect(screen.getByText(/エラーが発生しました/)).toBeInTheDocument()
      })
    })
  })

  describe('ウィジェット操作', () => {
    it('最小化ボタンで最小化できる', () => {
      render(<FloatingChatWidget />)

      const button = screen.getByRole('button', { name: /message-circle/i })
      fireEvent.click(button)

      const minimizeButton = screen.getByRole('button', { name: /minus/i })
      fireEvent.click(minimizeButton)

      expect(screen.getByText('財務AIアシスタント')).toBeInTheDocument()
    })

    it('閉じるボタンで閉じられる', () => {
      render(<FloatingChatWidget />)

      const button = screen.getByRole('button', { name: /message-circle/i })
      fireEvent.click(button)

      const closeButton = screen.getByRole('button', { name: /x/i })
      fireEvent.click(closeButton)

      expect(screen.queryByText('財務AIアシスタント')).not.toBeInTheDocument()
    })
  })
})
