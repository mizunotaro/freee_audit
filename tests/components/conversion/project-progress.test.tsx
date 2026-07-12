import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ProjectProgress } from '@/components/conversion/project-progress'
import type {
  ConversionProgress as ConversionProgressType,
  ConversionError,
} from '@/types/conversion'

const NOW = new Date('2026-07-01T00:00:00.000Z')

function makeProgress(overrides: Partial<ConversionProgressType> = {}): ConversionProgressType {
  return {
    status: 'converting',
    progress: 50,
    processedJournals: 5,
    totalJournals: 10,
    errors: [],
    startedAt: NOW.toISOString(),
    ...overrides,
  }
}

function jsonResponse(data: ConversionProgressType, ok = true) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 500,
    json: async () => ({ data }),
  })
}

function jsonOk(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: async () => body })
}

describe('conversion/project-progress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('loading state', () => {
    it('shows the spinner while the first fetch is in flight and no error card', () => {
      const never = new Promise<{ ok: boolean; json: () => Promise<unknown> }>(() => {})
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(never))

      const { container } = render(<ProjectProgress projectId="p1" />)

      expect(container.querySelector('.animate-spin')).not.toBeNull()
      expect(screen.queryByText(/進捗の取得に失敗しました/)).not.toBeInTheDocument()
    })
  })

  describe('fetch error handling', () => {
    it('degrades to the error card with the thrown message on a non-ok response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(makeProgress(), false)))

      await act(async () => {
        render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(
        screen.getByText('進捗の取得に失敗しました: Failed to fetch progress')
      ).toBeInTheDocument()
    })

    it('degrades to the error card when fetch rejects with an Error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

      await act(async () => {
        render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByText('進捗の取得に失敗しました: network down')).toBeInTheDocument()
    })

    it('reports "Unknown error" when fetch rejects with a non-Error value', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue('boom-string'))

      await act(async () => {
        render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByText('進捗の取得に失敗しました: Unknown error')).toBeInTheDocument()
    })

    it('renders the error card with the destructive styling', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')))

      const { container } = await act(async () => {
        const view = render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
        return view
      })

      expect(container.querySelector('.border-destructive')).not.toBeNull()
      expect(container.querySelector('.text-destructive')).not.toBeNull()
    })
  })

  describe('status icon and text', () => {
    it('renders the converting status with a spinning primary icon', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonOk({ data: makeProgress({ status: 'converting' }) }))
      )

      const { container } = await act(async () => {
        const view = render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
        return view
      })

      expect(screen.getByText('変換中...')).toBeInTheDocument()
      expect(container.querySelector('svg.animate-spin.text-primary')).not.toBeNull()
    })

    it('renders the completed status with a green check icon', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonOk({ data: makeProgress({ status: 'completed' }) }))
      )

      const { container } = await act(async () => {
        const view = render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
        return view
      })

      expect(screen.getByText('完了')).toBeInTheDocument()
      expect(container.querySelector('.text-green-500')).not.toBeNull()
    })

    it('renders the validating status with a muted clock icon', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonOk({ data: makeProgress({ status: 'validating' }) }))
      )

      const { container } = await act(async () => {
        const view = render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
        return view
      })

      expect(screen.getByText('検証中...')).toBeInTheDocument()
      expect(container.querySelector('svg.text-muted-foreground')).not.toBeNull()
    })

    it('renders the error status with a destructive alert icon (distinct from a fetch failure)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonOk({ data: makeProgress({ status: 'error', errors: [] }) }))
      )

      const { container } = await act(async () => {
        const view = render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
        return view
      })

      // No fetch-failure error card is shown.
      expect(screen.queryByText(/進捗の取得に失敗しました/)).not.toBeInTheDocument()
      // Status title text.
      expect(screen.getAllByText('エラー').length).toBeGreaterThan(0)
      // Destructive alert icon on the status title.
      expect(container.querySelector('svg.text-destructive')).not.toBeNull()
    })

    it('falls back to the raw status string and the clock icon for an unmapped status', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonOk({ data: makeProgress({ status: 'mapping' }) }))
      )

      const { container } = await act(async () => {
        const view = render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
        return view
      })

      expect(screen.getByText('mapping')).toBeInTheDocument()
      expect(container.querySelector('svg.text-muted-foreground')).not.toBeNull()
      expect(container.querySelector('.animate-spin')).toBeNull()
    })
  })

  describe('progress value and bar', () => {
    it('rounds the percentage for display', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonOk({ data: makeProgress({ progress: 42.6 }) }))
      )

      await act(async () => {
        render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByText('43%')).toBeInTheDocument()
    })

    it('shows 0% at the zero boundary', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonOk({ data: makeProgress({ progress: 0 }) }))
      )

      await act(async () => {
        render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('shows 100% at the max boundary', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonOk({ data: makeProgress({ progress: 100 }) }))
      )

      await act(async () => {
        render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('passes the raw progress value to the Progress indicator transform', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonOk({ data: makeProgress({ progress: 50 }) }))
      )

      const { container } = await act(async () => {
        const view = render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
        return view
      })

      // The shadcn Progress snippet drives the indicator transform from `value`
      // (translateX(-(100 - value)%)); aria-valuenow is not forwarded, so the
      // transform is the deterministic reflection of the value.
      const indicator = container.querySelector('[style*="translateX"]') as HTMLElement
      expect(indicator).not.toBeNull()
      expect(indicator.style.transform).toBe('translateX(-50%)')
    })
  })

  describe('journal counts', () => {
    it('renders the processed / total journal counts', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            jsonOk({ data: makeProgress({ processedJournals: 7, totalJournals: 42 }) })
          )
      )

      await act(async () => {
        render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByText('7 / 42')).toBeInTheDocument()
    })

    it('renders a zero / zero boundary', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            jsonOk({ data: makeProgress({ processedJournals: 0, totalJournals: 0 }) })
          )
      )

      await act(async () => {
        render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByText('0 / 0')).toBeInTheDocument()
    })
  })

  describe('estimated completion', () => {
    it('renders the localized completion time when estimatedCompletion is present', async () => {
      const iso = '2026-07-01T09:30:00.000Z'
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonOk({ data: makeProgress({ estimatedCompletion: iso }) }))
      )

      await act(async () => {
        render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
      })

      const expected = new Date(iso).toLocaleTimeString('ja-JP')
      expect(screen.getByText('完了予定')).toBeInTheDocument()
      expect(screen.getByText(expected)).toBeInTheDocument()
    })

    it('omits the completion block when estimatedCompletion is absent', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(jsonOk({ data: makeProgress({ estimatedCompletion: undefined }) }))
      )

      await act(async () => {
        render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.queryByText('完了予定')).not.toBeInTheDocument()
    })
  })

  describe('current item', () => {
    it('renders the current item line when provided', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonOk({ data: makeProgress({ currentItem: '売掛金の変換' }) }))
      )

      const { container } = await act(async () => {
        const view = render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
        return view
      })

      // The label and value are split across a <span> + text node, so read the
      // container's full textContent rather than using a single text query.
      const currentItemBox = container.querySelector('.bg-muted.p-2')
      expect(currentItemBox).not.toBeNull()
      expect(currentItemBox?.textContent).toBe('処理中: 売掛金の変換')
    })

    it('omits the current item line when absent', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonOk({ data: makeProgress({ currentItem: undefined }) }))
      )

      const { container } = await act(async () => {
        const view = render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
        return view
      })

      expect(container.querySelector('.bg-muted.p-2')).toBeNull()
      expect(screen.queryByText(/処理中:/)).not.toBeInTheDocument()
    })
  })

  describe('error list', () => {
    it('renders up to three error messages with the header', async () => {
      const errors: ConversionError[] = [
        { code: 'E1', message: 'マッピングエラー' },
        { code: 'E2', message: '検証エラー', affectedItem: 'item-2' },
      ]
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonOk({ data: makeProgress({ status: 'converting', errors }) }))
      )

      await act(async () => {
        render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
      })

      // Each row renders as "• <message>" inside an <li>, so match by substring.
      expect(screen.getByText(/マッピングエラー/)).toBeInTheDocument()
      expect(screen.getByText(/検証エラー/)).toBeInTheDocument()
      expect(screen.queryByText(/他 \d+件/)).not.toBeInTheDocument()
    })

    it('caps the list at three entries and reports the overflow count', async () => {
      const errors: ConversionError[] = [
        { code: 'E1', message: 'エラー1' },
        { code: 'E2', message: 'エラー2' },
        { code: 'E3', message: 'エラー3' },
        { code: 'E4', message: 'エラー4' },
        { code: 'E5', message: 'エラー5' },
      ]
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonOk({ data: makeProgress({ status: 'converting', errors }) }))
      )

      await act(async () => {
        render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByText(/エラー1$/)).toBeInTheDocument()
      expect(screen.getByText(/エラー2$/)).toBeInTheDocument()
      expect(screen.getByText(/エラー3$/)).toBeInTheDocument()
      expect(screen.queryByText(/エラー4$/)).not.toBeInTheDocument()
      expect(screen.queryByText(/エラー5$/)).not.toBeInTheDocument()
      expect(screen.getByText(/他\s+2件/)).toBeInTheDocument()
    })

    it('hides the error list when there are no errors', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(jsonOk({ data: makeProgress({ status: 'converting', errors: [] }) }))
      )

      const { container } = await act(async () => {
        const view = render(<ProjectProgress projectId="p1" />)
        await vi.advanceTimersByTimeAsync(0)
        return view
      })

      // The list renders a <ul> of error rows; with zero errors it is absent.
      expect(container.querySelector('ul')).toBeNull()
      expect(screen.queryByText(/他 \d+件/)).not.toBeInTheDocument()
    })
  })

  describe('polling', () => {
    it('fetches the project progress endpoint on mount', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonOk({ data: makeProgress({ status: 'converting' }) }))
      vi.stubGlobal('fetch', fetchMock)

      await act(async () => {
        render(<ProjectProgress projectId="proj-1" />)
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith('/api/conversion/projects/proj-1/progress')
    })

    it('continues polling at the default interval', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonOk({ data: makeProgress({ status: 'converting' }) }))
      vi.stubGlobal('fetch', fetchMock)

      await act(async () => {
        render(<ProjectProgress projectId="proj-1" />)
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000)
      })
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('respects a custom pollInterval', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonOk({ data: makeProgress({ status: 'converting' }) }))
      vi.stubGlobal('fetch', fetchMock)

      await act(async () => {
        render(<ProjectProgress projectId="proj-1" pollInterval={500} />)
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)

      // Just under the next tick → no extra call yet.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(499)
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('replaces the error card once a subsequent poll succeeds', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(makeProgress(), false))
        .mockResolvedValueOnce(jsonOk({ data: makeProgress({ status: 'converting' }) }))
      vi.stubGlobal('fetch', fetchMock)

      await act(async () => {
        render(<ProjectProgress projectId="proj-1" pollInterval={1000} />)
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(
        screen.getByText('進捗の取得に失敗しました: Failed to fetch progress')
      ).toBeInTheDocument()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })
      expect(screen.queryByText(/進捗の取得に失敗しました/)).not.toBeInTheDocument()
      expect(screen.getByText('変換中...')).toBeInTheDocument()
    })
  })

  describe('onComplete callback', () => {
    it('fires onComplete when the polled status is completed', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonOk({ data: makeProgress({ status: 'completed', progress: 100 }) }))
      vi.stubGlobal('fetch', fetchMock)
      const onComplete = vi.fn()

      await act(async () => {
        render(<ProjectProgress projectId="p1" onComplete={onComplete} pollInterval={1000} />)
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(onComplete).toHaveBeenCalledTimes(1)
    })

    it('does not fire onComplete when the status is error', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          jsonOk({ data: makeProgress({ status: 'error', errors: [{ code: 'X', message: 'm' }] }) })
        )
      vi.stubGlobal('fetch', fetchMock)
      const onComplete = vi.fn()

      await act(async () => {
        render(<ProjectProgress projectId="p1" onComplete={onComplete} pollInterval={1000} />)
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(onComplete).not.toHaveBeenCalled()
    })

    it('does not fire onComplete while still converting', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonOk({ data: makeProgress({ status: 'converting' }) }))
      vi.stubGlobal('fetch', fetchMock)
      const onComplete = vi.fn()

      await act(async () => {
        render(<ProjectProgress projectId="p1" onComplete={onComplete} pollInterval={1000} />)
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(onComplete).not.toHaveBeenCalled()
    })
  })

  describe('cleanup / fail-safe', () => {
    it('clears the polling interval after unmount', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonOk({ data: makeProgress({ status: 'converting' }) }))
      vi.stubGlobal('fetch', fetchMock)

      let view: ReturnType<typeof render> | undefined
      await act(async () => {
        view = render(<ProjectProgress projectId="p1" pollInterval={1000} />)
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)

      view?.unmount()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })
      // No further polls after unmount.
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('does not throw when an in-flight fetch resolves after unmount', async () => {
      let resolveFetch!: (v: unknown) => void
      const pending = new Promise<unknown>((r) => {
        resolveFetch = r
      })
      vi.stubGlobal('fetch', vi.fn().mockReturnValue(pending))
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      let view: ReturnType<typeof render> | undefined
      await act(async () => {
        view = render(<ProjectProgress projectId="p1" pollInterval={1000} />)
      })
      // Unmount while the mount-time fetch is still pending.
      view?.unmount()

      // Now resolve the in-flight fetch; the mounted guard must make this a no-op.
      await act(async () => {
        resolveFetch({ ok: true, status: 200, json: async () => ({ data: makeProgress() }) })
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(consoleError).not.toHaveBeenCalled()
      consoleError.mockRestore()
    })
  })
})
