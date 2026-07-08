import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import { ImportCard } from '@/components/import/ImportCard'
import type { ImportPreviewData } from '@/components/import/types'

const ACCEPTED = 'サポートされていないファイル形式です。対応形式: csv, xlsx, xls, xlsm'
const TOO_LARGE = 'ファイルサイズは10MB以下にしてください'

function jsonRes(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 400, json: async () => body } as unknown as Response
}

function csvFile(name = 'data.csv', bytes = 100): File {
  return new File([new Array(bytes + 1).join('x')], name, { type: 'text/csv' })
}

function oversizedCsv(name = 'big.csv'): File {
  const f = new File(['x'], name, { type: 'text/csv' })
  Object.defineProperty(f, 'size', { value: 11 * 1024 * 1024 })
  return f
}

function selectFile(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

describe('ImportCard — type label / description', () => {
  it('renders the localized type label and description', () => {
    const { getByText } = render(
      <ImportCard type="journal" apiEndpoint="/api/import/journals" companyId="c1" />
    )
    expect(getByText('仕訳データインポート')).toBeInTheDocument()
    expect(getByText('仕訳伝票のデータをインポートします')).toBeInTheDocument()
  })
})

describe('ImportCard — file validation', () => {
  let onError = vi.fn()

  beforeEach(() => {
    onError = vi.fn()
  })

  it('rejects an unsupported extension and reports the error', () => {
    const { container, getByText } = render(
      <ImportCard
        type="journal"
        apiEndpoint="/api/import/journals"
        companyId="c1"
        onError={onError}
      />
    )
    selectFile(container, new File(['x'], 'data.txt'))

    expect(getByText(ACCEPTED)).toBeInTheDocument()
    expect(onError).toHaveBeenCalledWith(ACCEPTED)
  })

  it('accepts a .csv extension case-insensitively', () => {
    const { container, queryByText, getByText } = render(
      <ImportCard
        type="journal"
        apiEndpoint="/api/import/journals"
        companyId="c1"
        onError={onError}
      />
    )
    selectFile(container, csvFile('DATA.CSV', 2048))

    expect(queryByText(ACCEPTED)).toBeNull()
    expect(onError).not.toHaveBeenCalled()
    expect(getByText('DATA.CSV')).toBeInTheDocument()
    expect(getByText('2.0 KB')).toBeInTheDocument()
  })

  it('rejects an oversized file (>10MB)', () => {
    const { container, getByText } = render(
      <ImportCard
        type="journal"
        apiEndpoint="/api/import/journals"
        companyId="c1"
        onError={onError}
      />
    )
    selectFile(container, oversizedCsv())

    expect(getByText(TOO_LARGE)).toBeInTheDocument()
    expect(onError).toHaveBeenCalledWith(TOO_LARGE)
  })

  it('clears the error when a valid file is chosen after an invalid one', () => {
    const { container, queryByText } = render(
      <ImportCard
        type="journal"
        apiEndpoint="/api/import/journals"
        companyId="c1"
        onError={onError}
      />
    )
    selectFile(container, new File(['x'], 'data.txt'))
    expect(queryByText(ACCEPTED)).not.toBeNull()

    selectFile(container, csvFile())
    expect(queryByText(ACCEPTED)).toBeNull()
  })
})

describe('ImportCard — preview flow', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  const preview: ImportPreviewData = {
    type: 'journal',
    headers: ['月'],
    mappedHeaders: {},
    rows: [{ 月: '1' }],
    totalRows: 5,
    detectedLanguage: 'ja',
    warnings: [],
    sampleErrors: [],
  }

  it('moves to the preview step on a successful preview request', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonRes({ preview }))

    const { container } = render(
      <ImportCard type="journal" apiEndpoint="/api/import/journals" companyId="c1" />
    )
    selectFile(container, csvFile())

    fireEvent.click(screen.getByRole('button', { name: 'プレビュー' }))

    await waitFor(() => {
      expect(screen.getByText('5行')).toBeInTheDocument()
    })
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/import/journals?companyId=c1',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('surfaces the API error message when the preview request fails', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonRes({ error: 'プレビュー取得失敗' }, false))
    const onError = vi.fn()

    const { container, getByText } = render(
      <ImportCard
        type="journal"
        apiEndpoint="/api/import/journals"
        companyId="c1"
        onError={onError}
      />
    )
    selectFile(container, csvFile())

    fireEvent.click(screen.getByRole('button', { name: 'プレビュー' }))

    await waitFor(() => {
      expect(getByText('プレビュー取得失敗')).toBeInTheDocument()
    })
    expect(onError).toHaveBeenCalledWith('プレビュー取得失敗')
  })
})
