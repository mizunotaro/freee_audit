import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FreeeSettings } from '@/components/settings/FreeeSettings'

const okResponse = <T,>(body: T) => ({ ok: true, json: async () => body })

describe('FreeeSettings', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    window.history.replaceState({}, '', '/')
  })

  it('reports a connected status when companies are returned', async () => {
    fetchMock.mockResolvedValue(
      okResponse({ companies: [{ id: 7, display_name: 'テスト事業所' }] })
    )

    render(<FreeeSettings />)

    await waitFor(() => expect(screen.getByText('テスト事業所')).toBeInTheDocument())
    expect(screen.getByText('接続済み')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '接続テスト' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '連携解除' })).toBeInTheDocument()
  })

  it('reports a disconnected status when no companies are returned', async () => {
    fetchMock.mockResolvedValue(okResponse({ companies: [] }))

    render(<FreeeSettings />)

    await waitFor(() => expect(screen.getByText('未接続')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'freeeと連携する' })).toBeInTheDocument()
    // NODE_ENV is not "development" in the test runner
    expect(screen.getByText('本番環境')).toBeInTheDocument()
  })

  it('reports the company count on a successful connection test', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ companies: [{ id: 1, name: 'A' }] }))
      .mockResolvedValueOnce(okResponse({ companies: [{ id: 1 }, { id: 2 }, { id: 3 }] }))

    render(<FreeeSettings />)
    await waitFor(() => expect(screen.getByText('接続済み')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '接続テスト' }))

    await waitFor(() =>
      expect(screen.getByText('接続テスト成功: 3件の事業所を取得')).toBeInTheDocument()
    )
  })

  it('disconnects and shows success when the user confirms', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fetchMock
      .mockResolvedValueOnce(okResponse({ companies: [{ id: 1, name: 'A' }] }))
      .mockResolvedValueOnce(okResponse({}))

    render(<FreeeSettings />)
    await waitFor(() => expect(screen.getByText('接続済み')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '連携解除' }))

    await waitFor(() => expect(screen.getByText('連携を解除しました')).toBeInTheDocument())
    expect(screen.getByText('未接続')).toBeInTheDocument()
    expect(window.confirm).toHaveBeenCalled()
  })

  it('aborts disconnect and stays connected when the user cancels', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    fetchMock.mockResolvedValue(okResponse({ companies: [{ id: 1, name: 'A' }] }))

    render(<FreeeSettings />)
    await waitFor(() => expect(screen.getByText('接続済み')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '連携解除' }))

    expect(screen.getByText('接続済み')).toBeInTheDocument()
    // only the initial status check ran — no disconnect POST
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('announces disconnect success inside a role=status region', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fetchMock
      .mockResolvedValueOnce(okResponse({ companies: [{ id: 1, name: 'A' }] }))
      .mockResolvedValueOnce(okResponse({}))

    render(<FreeeSettings />)
    await waitFor(() => expect(screen.getByText('接続済み')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '連携解除' }))

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent('連携を解除しました')
  })

  it('announces a disconnect failure inside a role=alert region and labels its dismiss control', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fetchMock
      .mockResolvedValueOnce(okResponse({ companies: [{ id: 1, name: 'A' }] }))
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })

    render(<FreeeSettings />)
    await waitFor(() => expect(screen.getByText('接続済み')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '連携解除' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('連携解除に失敗しました')
    expect(screen.getByRole('button', { name: 'エラーを閉じる' })).toBeInTheDocument()
  })

  it('renders the loading skeleton and no controls while the status check is in flight', async () => {
    let resolveFetch!: (value: unknown) => void
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      })
    )

    const { container } = render(<FreeeSettings />)

    expect(screen.queryByText('freee連携設定')).toBeNull()
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()

    const region = screen.getByRole('status')
    expect(region).toHaveAttribute('aria-busy', 'true')
    expect(region).toHaveAttribute('aria-label', 'freee連携設定を読み込み中')

    resolveFetch(okResponse({ companies: [] }))
  })

  it('degrades to disconnected and logs when the status request rejects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValue(new Error('network down'))

    render(<FreeeSettings />)

    await waitFor(() => expect(screen.getByText('未接続')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'freeeと連携する' })).toBeInTheDocument()
    expect(errorSpy).toHaveBeenCalled()
  })

  it('degrades to disconnected when the status response is not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) })

    render(<FreeeSettings />)

    await waitFor(() => expect(screen.getByText('未接続')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to the company name when display_name is absent', async () => {
    fetchMock.mockResolvedValue(okResponse({ companies: [{ id: 9, name: '名前のみ事業所' }] }))

    render(<FreeeSettings />)

    await waitFor(() => expect(screen.getByText('名前のみ事業所')).toBeInTheDocument())
    expect(screen.getByText('9')).toBeInTheDocument()
  })

  it('shows the post-connection success banner and clears the query string', async () => {
    fetchMock.mockResolvedValue(okResponse({ companies: [] }))
    window.history.replaceState({}, '', '/?connected=true')

    render(<FreeeSettings />)

    await waitFor(() => expect(screen.getByText('freeeとの連携が完了しました')).toBeInTheDocument())
    expect(window.location.search).toBe('')
  })

  it('shows an error banner from the error query string and clears the query string', async () => {
    fetchMock.mockResolvedValue(okResponse({ companies: [] }))
    window.history.replaceState({}, '', '/?error=auth_failed')

    render(<FreeeSettings />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('auth_failed')
    expect(window.location.search).toBe('')
  })

  it('redirects to the freee auth endpoint and enters the connecting state', async () => {
    fetchMock.mockResolvedValue(okResponse({ companies: [] }))
    const locationStub = { href: '', pathname: '/', search: '' }
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'location')
    Object.defineProperty(window, 'location', { configurable: true, value: locationStub })

    try {
      render(<FreeeSettings />)
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'freeeと連携する' })).toBeInTheDocument()
      )

      fireEvent.click(screen.getByRole('button', { name: 'freeeと連携する' }))

      await waitFor(() =>
        expect(screen.getByRole('button', { name: '接続中...' })).toBeInTheDocument()
      )
      expect(locationStub.href).toBe('/api/freee/auth')
    } finally {
      if (originalDescriptor) Object.defineProperty(window, 'location', originalDescriptor)
    }
  })

  it('reports zero companies when the test response omits the companies array', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ companies: [{ id: 1, name: 'A' }] }))
      .mockResolvedValueOnce(okResponse({}))

    render(<FreeeSettings />)
    await waitFor(() => expect(screen.getByText('接続済み')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '接続テスト' }))

    await waitFor(() =>
      expect(screen.getByText('接続テスト成功: 0件の事業所を取得')).toBeInTheDocument()
    )
  })

  it('announces a connection-test failure when the test response is not ok', async () => {
    fetchMock
      .mockResolvedValueOnce(okResponse({ companies: [{ id: 1, name: 'A' }] }))
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })

    render(<FreeeSettings />)
    await waitFor(() => expect(screen.getByText('接続済み')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '接続テスト' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('接続テストに失敗しました')
  })

  it('announces a connection-test failure when the test request rejects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock
      .mockResolvedValueOnce(okResponse({ companies: [{ id: 1, name: 'A' }] }))
      .mockRejectedValueOnce(new Error('network down'))

    render(<FreeeSettings />)
    await waitFor(() => expect(screen.getByText('接続済み')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '接続テスト' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('接続テストに失敗しました')
    expect(errorSpy).toHaveBeenCalled()
  })

  it('announces a disconnect failure when the disconnect request rejects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fetchMock
      .mockResolvedValueOnce(okResponse({ companies: [{ id: 1, name: 'A' }] }))
      .mockRejectedValueOnce(new Error('network down'))

    render(<FreeeSettings />)
    await waitFor(() => expect(screen.getByText('接続済み')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '連携解除' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('連携解除に失敗しました')
    expect(errorSpy).toHaveBeenCalled()
  })

  it('clears the error banner when its dismiss control is clicked', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fetchMock
      .mockResolvedValueOnce(okResponse({ companies: [{ id: 1, name: 'A' }] }))
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })

    render(<FreeeSettings />)
    await waitFor(() => expect(screen.getByText('接続済み')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: '連携解除' }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'エラーを閉じる' }))

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('clears the success banner when its dismiss control is clicked', async () => {
    fetchMock.mockResolvedValue(okResponse({ companies: [] }))
    window.history.replaceState({}, '', '/?connected=true')

    render(<FreeeSettings />)
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'メッセージを閉じる' }))

    await waitFor(() => expect(screen.queryByRole('status')).toBeNull())
  })

  it('labels the mock-mode section as a development environment when NODE_ENV is development', async () => {
    const env = process.env as Record<string, string | undefined>
    const previous = env.NODE_ENV
    env.NODE_ENV = 'development'
    fetchMock.mockResolvedValue(okResponse({ companies: [] }))

    try {
      render(<FreeeSettings />)
      await waitFor(() => expect(screen.getByText('開発環境（モック有効）')).toBeInTheDocument())
      expect(screen.queryByText('本番環境')).toBeNull()
    } finally {
      env.NODE_ENV = previous
    }
  })
})
