import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { ConversionProgress } from '@/components/conversion/conversion-progress'
import type {
  ConversionProgress as ConversionProgressType,
  ConversionError,
} from '@/types/conversion'

const NOW = new Date('2026-07-01T00:00:00.000Z')

function makeProgress(overrides: Partial<ConversionProgressType> = {}): ConversionProgressType {
  return {
    status: 'draft',
    progress: 0,
    processedJournals: 0,
    totalJournals: 0,
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

function startedSecondsAgo(seconds: number): string {
  return new Date(NOW.getTime() - seconds * 1000).toISOString()
}

function completionInSeconds(seconds: number): string {
  return new Date(NOW.getTime() + seconds * 1000).toISOString()
}

function firstSpinner(): Element | null {
  return document.querySelector('.animate-spin')
}

describe('conversion/conversion-progress', () => {
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

  describe('STATUS_CONFIG label rendering', () => {
    it.each([
      ['draft', '下書き', 'Draft'],
      ['mapping', 'マッピング中', 'Mapping'],
      ['validating', '検証中', 'Validating'],
      ['converting', '変換中', 'Converting'],
      ['reviewing', 'レビュー中', 'Reviewing'],
      ['completed', '完了', 'Completed'],
    ] as const)('renders the ja + en label for status=%s', (status, label, labelEn) => {
      render(<ConversionProgress projectId="p1" initialProgress={makeProgress({ status })} />)
      expect(screen.getByText(label)).toBeInTheDocument()
      expect(screen.getByText(labelEn)).toBeInTheDocument()
    })

    it('renders the error labels and uses the destructive badge variant on error status', () => {
      const { container } = render(
        <ConversionProgress projectId="p1" initialProgress={makeProgress({ status: 'error' })} />
      )
      expect(screen.getByText('エラー')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(container.querySelector('.bg-destructive')).not.toBeNull()
    })

    it('uses the secondary badge variant for a non-error status', () => {
      const { container } = render(
        <ConversionProgress
          projectId="p1"
          initialProgress={makeProgress({ status: 'completed' })}
        />
      )
      expect(container.querySelector('.bg-secondary')).not.toBeNull()
    })

    it('spins the status icon for an active status', () => {
      const { container } = render(
        <ConversionProgress
          projectId="p1"
          initialProgress={makeProgress({ status: 'converting' })}
        />
      )
      expect(container.querySelector('.animate-spin')).not.toBeNull()
    })

    it('does not spin the status icon for an inactive status', () => {
      render(
        <ConversionProgress projectId="p1" initialProgress={makeProgress({ status: 'draft' })} />
      )
      expect(firstSpinner()).toBeNull()
    })
  })

  describe('progress, counts, and current item', () => {
    it('formats the percentage to one decimal place', () => {
      render(
        <ConversionProgress projectId="p1" initialProgress={makeProgress({ progress: 42.56 })} />
      )
      expect(screen.getByText('42.6%')).toBeInTheDocument()
    })

    it('shows 0.0% at zero progress', () => {
      render(<ConversionProgress projectId="p1" initialProgress={makeProgress({ progress: 0 })} />)
      expect(screen.getByText('0.0%')).toBeInTheDocument()
    })

    it('passes the progress value to the Progress bar', () => {
      const { container } = render(
        <ConversionProgress projectId="p1" initialProgress={makeProgress({ progress: 50 })} />
      )
      const bar = screen.getByRole('progressbar')
      expect(bar).toHaveAttribute('aria-valuemin', '0')
      expect(bar).toHaveAttribute('aria-valuemax', '100')
      // The shadcn Progress snippet drives the indicator transform from `value`
      // (100 - value), so that is the deterministic reflection of the value.
      const indicator = container.querySelector('[style*="translateX"]') as HTMLElement
      expect(indicator).not.toBeNull()
      expect(indicator.style.transform).toBe('translateX(-50%)')
    })

    it('renders processed / total journal counts using toLocaleString', () => {
      render(
        <ConversionProgress
          projectId="p1"
          initialProgress={makeProgress({ processedJournals: 1500, totalJournals: 3000 })}
        />
      )
      const expected = `${(1500).toLocaleString()} / ${(3000).toLocaleString()} 仕訳`
      expect(screen.getByText(expected)).toBeInTheDocument()
    })

    it('renders the current item line when provided', () => {
      render(
        <ConversionProgress
          projectId="p1"
          initialProgress={makeProgress({ currentItem: '売掛金の変換' })}
        />
      )
      expect(screen.getByText('処理中: 売掛金の変換')).toBeInTheDocument()
    })

    it('omits the current item line when absent', () => {
      render(<ConversionProgress projectId="p1" initialProgress={makeProgress()} />)
      expect(screen.queryByText(/処理中:/)).not.toBeInTheDocument()
    })
  })

  describe('error list', () => {
    it('renders the error count header and every error message', () => {
      render(
        <ConversionProgress
          projectId="p1"
          initialProgress={makeProgress({
            status: 'error',
            errors: [
              { code: 'E1', message: 'マッピングエラー' },
              { code: 'E2', message: '検証エラー', affectedItem: 'item-2' },
            ],
          })}
        />
      )
      expect(screen.getByText('エラー (2件)')).toBeInTheDocument()
      expect(screen.getByText('マッピングエラー')).toBeInTheDocument()
      expect(screen.getByText('検証エラー')).toBeInTheDocument()
    })

    it('hides the error list when there are no errors', () => {
      render(
        <ConversionProgress
          projectId="p1"
          initialProgress={makeProgress({ status: 'error', errors: [] })}
        />
      )
      expect(screen.queryByText(/エラー \(\d+件\)/)).not.toBeInTheDocument()
    })
  })

  describe('formatDuration (elapsed / remaining)', () => {
    it.each([
      [0, '0秒'],
      [30, '30秒'],
      [59, '59秒'],
      [60, '1分'],
      [61, '1分1秒'],
      [90, '1分30秒'],
      [120, '2分'],
      [3540, '59分'],
      [3600, '1時間'],
      [3900, '1時間5分'],
    ])('formats %i elapsed seconds as %s', (seconds, expected) => {
      render(
        <ConversionProgress
          projectId="p1"
          initialProgress={makeProgress({ startedAt: startedSecondsAgo(seconds) })}
        />
      )
      expect(screen.getByText(`経過: ${expected}`)).toBeInTheDocument()
    })

    it('shows 0 elapsed seconds when startedAt is absent', () => {
      render(
        <ConversionProgress
          projectId="p1"
          initialProgress={makeProgress({ startedAt: undefined })}
        />
      )
      expect(screen.getByText('経過: 0秒')).toBeInTheDocument()
    })

    it('appends the remaining estimate when estimatedCompletion is in the future', () => {
      render(
        <ConversionProgress
          projectId="p1"
          initialProgress={makeProgress({
            startedAt: startedSecondsAgo(30),
            estimatedCompletion: completionInSeconds(90),
          })}
        />
      )
      expect(screen.getByText('経過: 30秒 / 残り: 1分30秒')).toBeInTheDocument()
    })

    it('omits the remaining estimate when estimatedCompletion is absent', () => {
      render(
        <ConversionProgress
          projectId="p1"
          initialProgress={makeProgress({ startedAt: startedSecondsAgo(30) })}
        />
      )
      expect(screen.getByText('経過: 30秒')).toBeInTheDocument()
    })

    it('clamps a past estimatedCompletion to a 0-second remaining estimate', () => {
      render(
        <ConversionProgress
          projectId="p1"
          initialProgress={makeProgress({
            startedAt: startedSecondsAgo(30),
            estimatedCompletion: completionInSeconds(-60),
          })}
        />
      )
      expect(screen.getByText('経過: 30秒 / 残り: 0秒')).toBeInTheDocument()
    })
  })

  describe('default state', () => {
    it('falls back to a draft progress object when initialProgress is omitted', () => {
      render(<ConversionProgress projectId="p1" />)
      expect(screen.getByText('下書き')).toBeInTheDocument()
      expect(screen.getByText('Draft')).toBeInTheDocument()
      expect(screen.getByText('0.0%')).toBeInTheDocument()
      expect(screen.getByText(`0 / 0 仕訳`)).toBeInTheDocument()
      expect(screen.getByText('経過: 0秒')).toBeInTheDocument()
    })
  })

  describe('polling', () => {
    it('shows the auto-refresh indicator for an active status', () => {
      render(
        <ConversionProgress projectId="p1" initialProgress={makeProgress({ status: 'mapping' })} />
      )
      expect(screen.getByText('自動更新中...')).toBeInTheDocument()
    })

    it('does not poll when the initial status is inactive', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      render(
        <ConversionProgress projectId="p1" initialProgress={makeProgress({ status: 'draft' })} />
      )
      expect(screen.queryByText('自動更新中...')).not.toBeInTheDocument()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5000)
      })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('polls the project progress endpoint and forwards updates while active', async () => {
      const payload = makeProgress({
        status: 'converting',
        progress: 42,
        processedJournals: 5,
        totalJournals: 10,
      })
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload))
      vi.stubGlobal('fetch', fetchMock)
      const onProgressUpdate = vi.fn()

      render(
        <ConversionProgress
          projectId="proj-1"
          initialProgress={makeProgress({ status: 'mapping' })}
          onProgressUpdate={onProgressUpdate}
          pollInterval={1000}
        />
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })

      expect(fetchMock).toHaveBeenCalledWith('/api/conversion/projects/proj-1/progress')
      expect(onProgressUpdate).toHaveBeenCalledWith(payload)
      expect(onProgressUpdate).toHaveBeenCalledTimes(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('stops polling and fires onComplete after a completed response', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(makeProgress({ status: 'completed', progress: 100 })))
      vi.stubGlobal('fetch', fetchMock)
      const onComplete = vi.fn()

      render(
        <ConversionProgress
          projectId="proj-1"
          initialProgress={makeProgress({ status: 'converting' })}
          onComplete={onComplete}
          pollInterval={1000}
        />
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })

      expect(onComplete).toHaveBeenCalledTimes(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('stops polling and forwards errors after an error response', async () => {
      const errors: ConversionError[] = [{ code: 'MAP_FAIL', message: 'マッピングに失敗しました' }]
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(makeProgress({ status: 'error', errors })))
      vi.stubGlobal('fetch', fetchMock)
      const onError = vi.fn()

      render(
        <ConversionProgress
          projectId="proj-1"
          initialProgress={makeProgress({ status: 'converting' })}
          onError={onError}
          pollInterval={1000}
        />
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })

      expect(onError).toHaveBeenCalledWith(errors)
      expect(onError).toHaveBeenCalledTimes(1)

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('degrades safely on a non-ok response without firing callbacks', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(makeProgress({ status: 'completed' }), false))
      vi.stubGlobal('fetch', fetchMock)
      const onProgressUpdate = vi.fn()
      const onComplete = vi.fn()
      const onError = vi.fn()

      render(
        <ConversionProgress
          projectId="proj-1"
          initialProgress={makeProgress({ status: 'converting' })}
          onProgressUpdate={onProgressUpdate}
          onComplete={onComplete}
          onError={onError}
          pollInterval={1000}
        />
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(onProgressUpdate).not.toHaveBeenCalled()
      expect(onComplete).not.toHaveBeenCalled()
      expect(onError).not.toHaveBeenCalled()
    })

    it('swallows a fetch rejection, logs, and keeps rendering', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
      vi.stubGlobal('fetch', fetchMock)
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const onProgressUpdate = vi.fn()

      render(
        <ConversionProgress
          projectId="proj-1"
          initialProgress={makeProgress({ status: 'mapping' })}
          onProgressUpdate={onProgressUpdate}
          pollInterval={1000}
        />
      )

      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(consoleSpy).toHaveBeenCalled()
      expect(onProgressUpdate).not.toHaveBeenCalled()
      expect(screen.getByText('マッピング中')).toBeInTheDocument()
    })
  })
})
