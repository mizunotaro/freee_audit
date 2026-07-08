import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ImportPreview } from '@/components/import/ImportPreview'
import type { ImportPreviewData, ImportErrorUI } from '@/components/import/types'

function buildError(overrides: Partial<ImportErrorUI> = {}): ImportErrorUI {
  return {
    row: 2,
    code: 'INVALID_VALUE',
    message: '数値ではありません',
    field: '金額',
    severity: 'error',
    ...overrides,
  }
}

function buildPreview(overrides: Partial<ImportPreviewData> = {}): ImportPreviewData {
  return {
    type: 'journal',
    headers: ['月', '勘定科目コード', '金額'],
    mappedHeaders: {},
    rows: [
      { 月: '1', 勘定科目コード: '400', 金額: 1000 },
      { 月: '2', 勘定科目コード: '400', 金額: 2000 },
    ],
    totalRows: 2,
    detectedLanguage: 'ja',
    warnings: [],
    sampleErrors: [],
    ...overrides,
  }
}

describe('ImportPreview — row display capping', () => {
  it('caps displayed rows at maxPreviewRows (default 10)', () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      月: String(i + 1),
      勘定科目コード: '400',
      金額: 1000,
    }))
    const { container } = render(<ImportPreview preview={buildPreview({ rows, totalRows: 12 })} />)

    expect(container.querySelectorAll('tbody tr').length).toBe(10)
    expect(container.textContent).toContain('最初の10行を表示中（全12行）')
  })

  it('honours a custom maxPreviewRows', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      月: String(i + 1),
      勘定科目コード: '400',
      金額: 1000,
    }))
    const { container } = render(
      <ImportPreview preview={buildPreview({ rows, totalRows: 5 })} maxPreviewRows={3} />
    )

    expect(container.querySelectorAll('tbody tr').length).toBe(3)
    expect(container.textContent).toContain('最初の3行を表示中（全5行）')
  })

  it('omits the truncation notice when rows fit within the cap', () => {
    const { container } = render(
      <ImportPreview preview={buildPreview({ totalRows: 2 })} maxPreviewRows={10} />
    )
    expect(container.textContent).not.toContain('行を表示中')
  })
})

describe('ImportPreview — detected-language label', () => {
  it('maps detectedLanguage to a localized label and shows the total row count', () => {
    const { getByText, rerender } = render(
      <ImportPreview preview={buildPreview({ detectedLanguage: 'ja', totalRows: 42 })} />
    )
    expect(getByText('日本語')).toBeInTheDocument()
    expect(getByText('42行')).toBeInTheDocument()

    rerender(<ImportPreview preview={buildPreview({ detectedLanguage: 'en' })} />)
    expect(getByText('English')).toBeInTheDocument()

    rerender(<ImportPreview preview={buildPreview({ detectedLanguage: 'unknown' })} />)
    expect(getByText('不明')).toBeInTheDocument()
  })
})

describe('ImportPreview — alert state selection', () => {
  it('shows the error alert when sampleErrors contain error-severity entries', () => {
    const { getByText, queryByText } = render(
      <ImportPreview
        preview={buildPreview({ sampleErrors: [buildError({ row: 3, severity: 'error' })] })}
      />
    )
    expect(getByText('データにエラーがあります')).toBeInTheDocument()
    expect(queryByText('データは正常です')).toBeNull()
  })

  it('shows the warning alert (not error) when only warning-severity entries exist', () => {
    const { getByText, queryByText } = render(
      <ImportPreview
        preview={buildPreview({
          sampleErrors: [buildError({ row: 3, severity: 'warning' })],
        })}
      />
    )
    expect(getByText('警告があります')).toBeInTheDocument()
    expect(queryByText('データにエラーがあります')).toBeNull()
  })

  it('shows the all-clear alert when there are no errors or warnings', () => {
    const { getByText } = render(<ImportPreview preview={buildPreview()} />)
    expect(getByText('データは正常です')).toBeInTheDocument()
  })
})

describe('ImportPreview — ErrorList truncation', () => {
  it('shows at most 5 errors with a remaining count', () => {
    const sampleErrors = Array.from({ length: 7 }, (_, i) =>
      buildError({ row: i + 2, severity: 'error', message: `err${i}` })
    )
    const { getByText, queryByText } = render(
      <ImportPreview preview={buildPreview({ sampleErrors })} />
    )

    expect(getByText('エラー (7件)')).toBeInTheDocument()
    expect(getByText('err0')).toBeInTheDocument()
    expect(getByText('err4')).toBeInTheDocument()
    expect(queryByText('err5')).toBeNull()
    expect(getByText('...他 2件')).toBeInTheDocument()
  })
})

describe('ImportPreview — warnings list truncation', () => {
  it('shows at most 3 warnings with a remaining count', () => {
    const warnings = Array.from({ length: 5 }, (_, i) => `注意${i}`)
    const { getByText, queryByText } = render(
      <ImportPreview preview={buildPreview({ warnings })} />
    )

    expect(getByText('注意0')).toBeInTheDocument()
    expect(getByText('注意2')).toBeInTheDocument()
    expect(queryByText('注意3')).toBeNull()
    expect(getByText('...他 2件')).toBeInTheDocument()
  })
})

describe('ImportPreview — header mapping arrows', () => {
  it('renders a mapping arrow only when the mapped name differs from the header', () => {
    const { getByText, queryByText } = render(
      <ImportPreview
        preview={buildPreview({
          headers: ['売上', '経費'],
          mappedHeaders: { 売上: 'sales', 経費: '経費' },
          rows: [{ 売上: '100', 経費: '50' }],
        })}
      />
    )

    expect(getByText('→ sales')).toBeInTheDocument()
    expect(queryByText('→ 経費')).toBeNull()
  })
})

describe('ImportPreview — per-row error highlighting', () => {
  it('marks a row and its offending cell when a sampleError matches the row + field', () => {
    const { container } = render(
      <ImportPreview
        preview={buildPreview({
          headers: ['金額'],
          mappedHeaders: { 金額: '金額' },
          rows: [{ 金額: 'abc' }],
          sampleErrors: [
            buildError({ row: 2, field: '金額', severity: 'error', message: '数値ではありません' }),
          ],
        })}
      />
    )

    const bodyRow = container.querySelector('tbody tr') as HTMLElement
    expect(bodyRow.className).toContain('bg-destructive')

    const offendingCell = container.querySelector('[title="数値ではありません"]')
    expect(offendingCell).not.toBeNull()
  })

  it('renders an empty cell for missing values', () => {
    const { container } = render(
      <ImportPreview
        preview={buildPreview({
          headers: ['金額'],
          mappedHeaders: { 金額: '金額' },
          rows: [{}],
        })}
      />
    )
    const cell = container.querySelector('tbody td:nth-child(2)') as HTMLElement
    expect(cell.textContent).toBe('')
  })
})
