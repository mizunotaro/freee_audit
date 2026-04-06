import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { InputArea } from '@/app/(dashboard)/chat/components/input-area'

describe('InputArea', () => {
  it('should render textarea with default placeholder', () => {
    render(<InputArea onSend={vi.fn()} />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeInTheDocument()
    expect(textarea).toHaveAttribute('placeholder', '財務に関する質問を入力してください...')
  })

  it('should render textarea with custom placeholder', () => {
    render(<InputArea onSend={vi.fn()} placeholder="カスタムプレースホルダー" />)

    expect(screen.getByPlaceholderText('カスタムプレースホルダー')).toBeInTheDocument()
  })

  it('should render send button', () => {
    render(<InputArea onSend={vi.fn()} />)

    expect(screen.getByRole('button', { name: '送信' })).toBeInTheDocument()
  })

  it('should call onSend with trimmed input on button click', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<InputArea onSend={onSend} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, '  テストメッセージ  ')

    const sendButton = screen.getByRole('button', { name: '送信' })
    await user.click(sendButton)

    expect(onSend).toHaveBeenCalledWith('テストメッセージ')
  })

  it('should call onSend on Enter key press', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<InputArea onSend={onSend} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'テスト{Enter}')

    await waitFor(() => {
      expect(onSend).toHaveBeenCalledWith('テスト')
    })
  })

  it('should not send on Shift+Enter', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<InputArea onSend={onSend} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'テスト{Shift>}{Enter}{/Shift}')

    expect(onSend).not.toHaveBeenCalled()
  })

  it('should not send empty message', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<InputArea onSend={onSend} />)

    const sendButton = screen.getByRole('button', { name: '送信' })
    await user.click(sendButton)

    expect(onSend).not.toHaveBeenCalled()
  })

  it('should not send whitespace-only message', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<InputArea onSend={onSend} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, '   ')

    const sendButton = screen.getByRole('button', { name: '送信' })
    await user.click(sendButton)

    expect(onSend).not.toHaveBeenCalled()
  })

  it('should clear input after sending', async () => {
    const user = userEvent.setup()
    const onSend = vi.fn()
    render(<InputArea onSend={onSend} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'テスト')

    const sendButton = screen.getByRole('button', { name: '送信' })
    await user.click(sendButton)

    await waitFor(() => {
      expect(textarea).toHaveValue('')
    })
  })

  it('should disable textarea when disabled prop is true', () => {
    render(<InputArea onSend={vi.fn()} disabled={true} />)

    const textarea = screen.getByRole('textbox')
    expect(textarea).toBeDisabled()
  })

  it('should disable send button when disabled prop is true', () => {
    render(<InputArea onSend={vi.fn()} disabled={true} />)

    const sendButton = screen.getByRole('button', { name: '送信' })
    expect(sendButton).toBeDisabled()
  })

  it('should disable send button when input is empty', () => {
    render(<InputArea onSend={vi.fn()} />)

    const sendButton = screen.getByRole('button', { name: '送信' })
    expect(sendButton).toBeDisabled()
  })

  it('should show character count when near limit', async () => {
    const user = userEvent.setup()
    const maxLength = 100
    render(<InputArea onSend={vi.fn()} maxLength={maxLength} />)

    const textarea = screen.getByRole('textbox')
    const longText = 'a'.repeat(81)
    await user.type(textarea, longText)

    expect(screen.getByText(`${longText.length} / ${maxLength}`)).toBeInTheDocument()
  })

  it('should disable send button when input exceeds maxLength', async () => {
    const user = userEvent.setup()
    const maxLength = 10
    render(<InputArea onSend={vi.fn()} maxLength={maxLength} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'a'.repeat(11))

    const sendButton = screen.getByRole('button', { name: '送信' })
    expect(sendButton).toBeDisabled()
  })
})
