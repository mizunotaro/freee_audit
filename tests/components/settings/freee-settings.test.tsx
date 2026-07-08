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
})
