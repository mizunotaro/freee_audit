import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AiSettings } from '@/components/settings/AiSettings'

type FetchInit = { method?: string; body?: string }

const okResponse = <T,>(body: T) => ({ ok: true, json: async () => body })
const errResponse = <T,>(body: T) => ({ ok: false, json: async () => body })

describe('AiSettings', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the saved provider and model on mount', async () => {
    fetchMock.mockResolvedValue(okResponse({ config: { provider: 'gemini', model: 'gemini-pro' } }))

    render(<AiSettings />)

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'AI API設定' })).toBeInTheDocument()
    )

    expect(screen.getByRole('combobox')).toHaveValue('gemini-pro')
    // the loaded provider button carries the active styling
    expect(screen.getByText('gemini').closest('button')).toHaveClass('border-primary-500')
  })

  it('resets the api key and switches the model list when the provider changes', async () => {
    fetchMock.mockResolvedValue(okResponse({ config: { provider: 'openai', model: 'gpt-4' } }))

    render(<AiSettings />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    const apiKeyInput = screen.getByPlaceholderText('sk-...')
    fireEvent.change(apiKeyInput, { target: { value: 'sk-secret' } })
    expect(apiKeyInput).toHaveValue('sk-secret')

    fireEvent.click(screen.getByText('claude'))

    expect(apiKeyInput).toHaveValue('')
    expect(screen.getByRole('combobox')).toHaveValue('claude-3-opus-20240229')
  })

  it('posts the config on save and clears the api key on success', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ config: { provider: 'openai', model: 'gpt-4' } }))
      .mockResolvedValueOnce(okResponse({}))

    render(<AiSettings />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('sk-...'), {
      target: { value: 'sk-save' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(screen.getByText('設定を保存しました')).toBeInTheDocument())
    expect(screen.getByPlaceholderText('sk-...')).toHaveValue('')

    const saveCall = fetchMock.mock.calls.find((c) => {
      const init = c[1] as FetchInit | undefined
      return init?.method === 'POST'
    })
    expect(saveCall).toBeDefined()
    if (!saveCall) return
    const body = JSON.parse((saveCall[1] as FetchInit).body as string)
    expect(body).toMatchObject({ provider: 'openai', apiKey: 'sk-save', model: 'gpt-4' })
  })

  it('shows an error message when the save request fails', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ config: { provider: 'openai', model: 'gpt-4' } }))
      .mockResolvedValueOnce(errResponse({ error: '無効なAPIキーです' }))

    render(<AiSettings />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('sk-...'), {
      target: { value: 'sk-bad' },
    })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(screen.getByText('無効なAPIキーです')).toBeInTheDocument())
  })

  it('renders the form even when the initial load rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))

    render(<AiSettings />)

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'AI API設定' })).toBeInTheDocument()
    )
    expect(screen.queryByText('設定を保存しました')).toBeNull()
  })

  it('associates the API key and model labels with their controls', async () => {
    fetchMock.mockResolvedValue(okResponse({ config: { provider: 'openai', model: 'gpt-4' } }))

    render(<AiSettings />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    expect(screen.getByLabelText('APIキー')).toHaveAttribute('id', 'ai-api-key')
    expect(screen.getByLabelText('モデル')).toHaveValue('gpt-4')
  })

  it('marks only the active provider button as pressed', async () => {
    fetchMock.mockResolvedValue(okResponse({ config: { provider: 'gemini', model: 'gemini-pro' } }))

    render(<AiSettings />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    expect(screen.getByText('gemini').closest('button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('openai').closest('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('labels the show/hide API key toggle and wires it to the input', async () => {
    fetchMock.mockResolvedValue(okResponse({ config: { provider: 'openai', model: 'gpt-4' } }))

    render(<AiSettings />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    const toggle = screen.getByRole('button', { name: 'APIキーを表示する' })
    expect(toggle).toHaveAttribute('aria-controls', 'ai-api-key')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(toggle)

    const hideToggle = screen.getByRole('button', { name: 'APIキーを非表示にする' })
    expect(hideToggle).toHaveAttribute('aria-pressed', 'true')
  })

  it('announces save errors inside a role=alert region', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ config: { provider: 'openai', model: 'gpt-4' } }))
      .mockResolvedValueOnce(errResponse({ error: '無効なAPIキーです' }))

    render(<AiSettings />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('sk-...'), { target: { value: 'sk-bad' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('無効なAPIキーです')
  })

  it('shows the loading skeleton until the config finishes loading', async () => {
    let resolveLoad!: (v: unknown) => void
    fetchMock.mockReturnValueOnce(
      new Promise((r) => {
        resolveLoad = r
      })
    )

    const { container } = render(<AiSettings />)

    await waitFor(() => expect(container.querySelector('.animate-pulse')).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'AI API設定' })).toBeNull()

    const loadingRegion = screen.getByRole('status')
    expect(loadingRegion).toHaveAttribute('aria-busy', 'true')
    expect(loadingRegion).toHaveAttribute('aria-label', 'AI API設定を読み込み中')

    resolveLoad(okResponse({ config: { provider: 'openai', model: 'gpt-4' } }))

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'AI API設定' })).toBeInTheDocument()
    )
  })

  it('keeps the default provider when the load response is not ok', async () => {
    fetchMock.mockResolvedValue(errResponse({}))

    render(<AiSettings />)

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'AI API設定' })).toBeInTheDocument()
    )
    expect(screen.getByText('openai').closest('button')).toHaveClass('border-primary-500')
  })

  it('keeps the defaults when the load payload has no config object', async () => {
    fetchMock.mockResolvedValue(okResponse({}))

    render(<AiSettings />)

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    expect(screen.getByText('openai').closest('button')).toHaveClass('border-primary-500')
  })

  it('falls back to the openai provider when the stored provider is empty', async () => {
    fetchMock.mockResolvedValue(okResponse({ config: { provider: '', model: '' } }))

    render(<AiSettings />)

    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())
    expect(screen.getByText('openai').closest('button')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('gemini').closest('button')).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the generic error message when the save request throws', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ config: { provider: 'openai', model: 'gpt-4' } }))
      .mockRejectedValueOnce(new Error('network down'))

    render(<AiSettings />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('sk-...'), { target: { value: 'sk-x' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(screen.getByText('保存に失敗しました')).toBeInTheDocument())
  })

  it('falls back to the generic message when the error response has no error field', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ config: { provider: 'openai', model: 'gpt-4' } }))
      .mockResolvedValueOnce(errResponse({}))

    render(<AiSettings />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('sk-...'), { target: { value: 'sk-x' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(screen.getByText('保存に失敗しました')).toBeInTheDocument())
  })

  it('clears the error when its dismiss button is clicked', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ config: { provider: 'openai', model: 'gpt-4' } }))
      .mockResolvedValueOnce(errResponse({ error: '無効なAPIキーです' }))

    render(<AiSettings />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    fireEvent.change(screen.getByPlaceholderText('sk-...'), { target: { value: 'sk-x' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'エラーを閉じる' }))

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('clears the success message when its dismiss button is clicked', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ config: { provider: 'openai', model: 'gpt-4' } }))
      .mockResolvedValueOnce(okResponse({}))

    render(<AiSettings />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'メッセージを閉じる' }))

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('disables the save button and shows the saving label while the request is in flight', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ config: { provider: 'openai', model: 'gpt-4' } }))
    let resolveSave!: (v: unknown) => void
    fetchMock.mockReturnValueOnce(
      new Promise((r) => {
        resolveSave = r
      })
    )

    render(<AiSettings />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '保存' }))

    await waitFor(() => expect(screen.getByRole('button', { name: '保存中...' })).toBeDisabled())

    resolveSave(okResponse({}))
    await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled())
  })

  it('switches the API key input between password and text', async () => {
    fetchMock.mockResolvedValue(okResponse({ config: { provider: 'openai', model: 'gpt-4' } }))

    render(<AiSettings />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    const input = screen.getByPlaceholderText('sk-...')
    expect(input).toHaveAttribute('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: 'APIキーを表示する' }))
    expect(input).toHaveAttribute('type', 'text')

    fireEvent.click(screen.getByRole('button', { name: 'APIキーを非表示にする' }))
    expect(input).toHaveAttribute('type', 'password')
  })

  it('updates the selected model when a different option is chosen', async () => {
    fetchMock.mockResolvedValue(okResponse({ config: { provider: 'openai', model: 'gpt-4' } }))

    render(<AiSettings />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'gpt-3.5-turbo' } })
    expect(screen.getByRole('combobox')).toHaveValue('gpt-3.5-turbo')
  })

  it('switches to gemini and lists only the gemini models', async () => {
    fetchMock.mockResolvedValue(okResponse({ config: { provider: 'openai', model: 'gpt-4' } }))

    render(<AiSettings />)
    await waitFor(() => expect(screen.getByRole('combobox')).toBeInTheDocument())

    fireEvent.click(screen.getByText('gemini'))

    const combobox = screen.getByRole('combobox') as HTMLSelectElement
    expect(combobox).toHaveValue('gemini-pro')
    const optionValues = Array.from(combobox.options).map((o) => o.value)
    expect(optionValues).toEqual(['gemini-pro', 'gemini-pro-vision'])
  })
})
