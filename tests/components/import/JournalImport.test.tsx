import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import { JournalImport } from '@/components/import/JournalImport'

function jsonRes(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 400, json: async () => body } as unknown as Response
}

function csvFile(name = 'data.csv', bytes = 2048): File {
  return new File([new Array(bytes + 1).join('x')], name, { type: 'text/csv' })
}

function oversizedCsv(): File {
  const f = csvFile('big.csv', 1)
  Object.defineProperty(f, 'size', { value: 11 * 1024 * 1024 })
  return f
}

function selectFile(container: HTMLElement, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

describe('JournalImport — static rendering', () => {
  it('renders the heading and the CSV format reference table', () => {
    const { getByText } = render(<JournalImport />)
    expect(getByText('仕訳データインポート')).toBeInTheDocument()
    expect(getByText('ヘッダー名')).toBeInTheDocument()
  })
})

describe('JournalImport — file selection validation', () => {
  it('rejects a non-CSV file', () => {
    const { container, getByText } = render(<JournalImport />)
    selectFile(container, new File(['x'], 'data.txt', { type: 'text/plain' }))

    expect(getByText('CSVファイルを選択してください')).toBeInTheDocument()
  })

  it('accepts a valid CSV and shows the size in KB', () => {
    const { container, getByText, queryByText } = render(<JournalImport />)
    selectFile(container, csvFile('journals.csv'))

    expect(queryByText('CSVファイルを選択してください')).toBeNull()
    expect(getByText('journals.csv')).toBeInTheDocument()
    expect(getByText('2.0 KB')).toBeInTheDocument()
  })

  it('rejects a file larger than 10MB', () => {
    const { container, getByText } = render(<JournalImport />)
    selectFile(container, oversizedCsv())

    expect(getByText('ファイルサイズは10MB以下にしてください')).toBeInTheDocument()
  })
})

describe('JournalImport — upload flow', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })

  it('renders the import result and clears the file on a successful import (imported > 0)', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonRes({ success: true, imported: 5, skipped: 1, errors: [], totalRows: 6 })
      )

    const { container, getByText, queryByText } = render(<JournalImport />)
    selectFile(container, csvFile('journals.csv'))

    fireEvent.click(screen.getByRole('button', { name: 'インポート実行' }))

    await waitFor(() => {
      expect(getByText('6件')).toBeInTheDocument()
    })
    expect(getByText('5件')).toBeInTheDocument()
    expect(getByText('1件')).toBeInTheDocument()
    // imported > 0 → file is cleared
    expect(queryByText('journals.csv')).toBeNull()
  })

  it('truncates the error list to 10 entries with a remaining count', async () => {
    const errors = Array.from({ length: 12 }, (_, i) => ({ row: i + 2, message: `err${i}` }))
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonRes({ success: false, imported: 0, skipped: 0, errors, totalRows: 12 })
      )

    const { container, getByText, queryByText } = render(<JournalImport />)
    selectFile(container, csvFile('journals.csv'))

    fireEvent.click(screen.getByRole('button', { name: 'インポート実行' }))

    await waitFor(() => {
      expect(getByText('エラー (12件):')).toBeInTheDocument()
    })
    expect(getByText(/行2: err0/)).toBeInTheDocument()
    expect(getByText(/行11: err9/)).toBeInTheDocument()
    expect(queryByText(/err10/)).toBeNull()
    expect(getByText('...他 2件')).toBeInTheDocument()
  })

  it('surfaces the API error message on a failed response', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonRes({ error: 'インポート失敗テスト' }, false))

    const { container, getByText } = render(<JournalImport />)
    selectFile(container, csvFile('journals.csv'))

    fireEvent.click(screen.getByRole('button', { name: 'インポート実行' }))

    await waitFor(() => {
      expect(getByText('インポート失敗テスト')).toBeInTheDocument()
    })
  })
})

describe('JournalImport — accessibility', () => {
  it('announces validation errors inside a role=alert region and labels the dismiss control', () => {
    const { container } = render(<JournalImport />)
    selectFile(container, new File(['x'], 'data.txt', { type: 'text/plain' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/CSVファイルを選択してください/)
    expect(screen.getByRole('button', { name: 'エラーを閉じる' })).toBeInTheDocument()
  })

  it('announces a completed import inside a role=status region', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonRes({ success: true, imported: 5, skipped: 1, errors: [], totalRows: 6 })
      )

    const { container } = render(<JournalImport />)
    selectFile(container, csvFile('journals.csv'))

    fireEvent.click(screen.getByRole('button', { name: 'インポート実行' }))

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    expect(screen.getByRole('status')).toHaveTextContent(/インポート結果/)
  })
})
