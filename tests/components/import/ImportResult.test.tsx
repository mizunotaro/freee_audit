import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ImportResult } from '@/components/import/ImportResult'
import type { ImportResultData, ImportErrorUI } from '@/components/import/types'

function buildError(overrides: Partial<ImportErrorUI> = {}): ImportErrorUI {
  return {
    row: 2,
    code: 'VALIDATION_ERROR',
    message: '行が不正です',
    field: '金額',
    value: 'abc',
    severity: 'error',
    ...overrides,
  }
}

function buildResult(overrides: Partial<ImportResultData> = {}): ImportResultData {
  return {
    success: true,
    status: 'completed',
    imported: 8,
    skipped: 2,
    failed: 0,
    errors: [],
    warnings: [],
    totalRows: 10,
    validRows: 10,
    durationMs: 500,
    ...overrides,
  }
}

describe('ImportResult — progress rate computation', () => {
  it('renders success/skip/fail bars proportional to imported/skipped/failed over totalRows', () => {
    const { container } = render(
      <ImportResult result={buildResult({ imported: 8, skipped: 2, failed: 0, totalRows: 10 })} />
    )

    const successBar = container.querySelector('[title="成功: 8"]') as HTMLElement
    const skipBar = container.querySelector('[title="スキップ: 2"]') as HTMLElement

    expect(successBar).not.toBeNull()
    expect(successBar.style.width).toBe('80%')
    expect(skipBar).not.toBeNull()
    expect(skipBar.style.width).toBe('20%')
    // failed === 0 → failRate === 0 → no red bar rendered
    expect(container.querySelector('[title^="失敗:"]')).toBeNull()
  })

  it('renders a red bar only when failed > 0', () => {
    const { container } = render(
      <ImportResult result={buildResult({ imported: 5, skipped: 0, failed: 5, totalRows: 10 })} />
    )

    const failBar = container.querySelector('[title="失敗: 5"]') as HTMLElement
    expect(failBar).not.toBeNull()
    expect(failBar.style.width).toBe('50%')
  })

  it('renders no rate bars when totalRows is 0 (guards against division by zero)', () => {
    const { container } = render(
      <ImportResult
        result={buildResult({ imported: 0, skipped: 0, failed: 0, totalRows: 0, validRows: 0 })}
      />
    )

    expect(container.querySelector('[title^="成功:"]')).toBeNull()
    expect(container.querySelector('[title^="スキップ:"]')).toBeNull()
    expect(container.querySelector('[title^="失敗:"]')).toBeNull()
  })
})

describe('ImportResult — status mapping', () => {
  it('shows the completed description and badge label', () => {
    const { container, getByText } = render(
      <ImportResult result={buildResult({ status: 'completed' })} />
    )

    expect(getByText('インポートが正常に完了しました')).toBeInTheDocument()
    expect(getByText('完了')).toBeInTheDocument()
    expect(container.querySelector('.bg-destructive')).toBeNull()
  })

  it('shows partial description, badge, and a partial-success alert carrying the failed count', () => {
    const { getByText } = render(
      <ImportResult result={buildResult({ status: 'partial', imported: 7, failed: 3 })} />
    )

    expect(getByText('一部のデータをインポートしました')).toBeInTheDocument()
    expect(getByText('一部成功')).toBeInTheDocument()
    expect(getByText(/3件のエラーがありました/)).toBeInTheDocument()
  })

  it('shows a destructive import-error alert only when failed status has errors', () => {
    const { queryByText, rerender } = render(
      <ImportResult result={buildResult({ status: 'failed', errors: [] })} />
    )
    expect(queryByText('インポートエラー')).toBeNull()

    rerender(
      <ImportResult
        result={buildResult({ status: 'failed', errors: [buildError({ row: 3, message: 'mgr' })] })}
      />
    )
    expect(queryByText('インポートエラー')).toBeInTheDocument()
  })

  it('falls back to the pending badge for in-progress statuses', () => {
    const { getByText } = render(<ImportResult result={buildResult({ status: 'importing' })} />)
    expect(getByText('インポート中')).toBeInTheDocument()
  })
})

describe('ImportResult — duration formatting', () => {
  it('renders sub-second durations in milliseconds', () => {
    const { getByText } = render(<ImportResult result={buildResult({ durationMs: 500 })} />)
    expect(getByText(/500ms/)).toBeInTheDocument()
  })

  it('renders >= 1s durations in seconds with two decimals', () => {
    const { getByText } = render(<ImportResult result={buildResult({ durationMs: 1500 })} />)
    expect(getByText(/1.50秒/)).toBeInTheDocument()
  })

  it('omits the processing-time line when durationMs is undefined', () => {
    const { queryByText } = render(<ImportResult result={buildResult({ durationMs: undefined })} />)
    expect(queryByText(/処理時間/)).toBeNull()
  })
})

describe('ImportResult — error table truncation', () => {
  it('shows at most 20 errors with a remaining-count footer', () => {
    const errors = Array.from({ length: 25 }, (_, i) =>
      buildError({ row: i + 2, message: `err${i}` })
    )
    const { getByText, queryByText } = render(
      <ImportResult result={buildResult({ status: 'failed', errors })} />
    )

    expect(getByText('25件中 20件を表示')).toBeInTheDocument()
    expect(getByText('err0')).toBeInTheDocument()
    expect(getByText('err19')).toBeInTheDocument()
    expect(queryByText('err20')).toBeNull()
    expect(getByText('...他 5件のエラー')).toBeInTheDocument()
  })

  it('renders a dash for missing field and value cells', () => {
    const { getAllByText } = render(
      <ImportResult
        result={buildResult({
          status: 'failed',
          errors: [buildError({ field: undefined, value: undefined })],
        })}
      />
    )
    // row + field + value all render '-' for the single error row
    expect(getAllByText('-').length).toBeGreaterThanOrEqual(2)
  })
})

describe('ImportResult — warnings truncation', () => {
  it('lists at most 5 warnings with a remaining-count footer', () => {
    const warnings = Array.from({ length: 7 }, (_, i) => `警告${i}`)
    const { getByText, queryByText } = render(<ImportResult result={buildResult({ warnings })} />)

    expect(getByText('警告 (7件)')).toBeInTheDocument()
    expect(getByText('警告0')).toBeInTheDocument()
    expect(getByText('警告4')).toBeInTheDocument()
    expect(queryByText('警告5')).toBeNull()
    expect(getByText('...他 2件')).toBeInTheDocument()
  })
})
