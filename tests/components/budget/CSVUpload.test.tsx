import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import { CSVUpload } from '@/components/budget/CSVUpload'

const toastCalls = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: toastCalls.success,
    error: toastCalls.error,
  },
}))

function jsonRes(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 400, json: async () => body } as unknown as Response
}

function selectFile(file: File) {
  // Radix Dialog portals content to document.body, so query the body (not the render container).
  const input = document.body.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

function csvFile(content: string, name = 'budget.csv'): File {
  return new File([content], name, { type: 'text/csv' })
}

function props(overrides: { onSuccess?: () => void } = {}) {
  return {
    open: true,
    onOpenChange: vi.fn(),
    fiscalYear: 2024,
    onSuccess: overrides.onSuccess ?? vi.fn(),
  }
}

describe('CSVUpload — static rendering', () => {
  it('renders the dialog title, format hint, and template link', () => {
    render(<CSVUpload {...props()} />)
    expect(screen.getByText('CSVアップロード')).toBeInTheDocument()
    expect(screen.getByText(/CSVフォーマット/)).toBeInTheDocument()
    const link = document.body.querySelector('a[href="/api/reports/budget?action=template"]')
    expect(link).not.toBeNull()
  })
})

describe('CSVUpload — file selection', () => {
  beforeEach(() => {
    toastCalls.success.mockClear()
    toastCalls.error.mockClear()
  })

  it('rejects a non-CSV file with a toast and produces no preview', () => {
    render(<CSVUpload {...props()} />)
    selectFile(new File(['x'], 'data.txt', { type: 'text/plain' }))

    expect(toastCalls.error).toHaveBeenCalledWith('CSVファイルを選択してください')
    expect(screen.queryByText('プレビュー（先頭5行）')).toBeNull()
  })

  it('parses the first 6 lines, splitting cells and trimming whitespace', async () => {
    const content = '月,勘定科目コード,勘定科目名,金額\n1,400,売上,1000\n2,400,売上,2000'
    render(<CSVUpload {...props()} />)
    selectFile(csvFile(content))

    await waitFor(() => {
      expect(screen.getByText('プレビュー（先頭5行）')).toBeInTheDocument()
    })
    expect(document.body.querySelectorAll('tbody tr').length).toBe(3)
    expect(screen.getByText('勘定科目コード')).toBeInTheDocument()
    expect(screen.getByText('1000')).toBeInTheDocument()
  })

  it('strips surrounding double-quotes from cells', async () => {
    const content = '1,400,"売上 高",1000'
    render(<CSVUpload {...props()} />)
    selectFile(csvFile(content))

    await waitFor(() => {
      expect(screen.getByText('1000')).toBeInTheDocument()
    })
    expect(screen.getByText('売上 高')).toBeInTheDocument()
    expect(screen.queryByText('"売上 高"')).toBeNull()
  })

  it('caps the preview at 6 lines', async () => {
    const lines = Array.from({ length: 8 }, (_, i) => `${i},400,売上,${i * 1000}`).join('\n')
    render(<CSVUpload {...props()} />)
    selectFile(csvFile(lines))

    // slice(0, 6) keeps lines 0–5 (values 0–5000); line 6 (value 6000) is dropped.
    await waitFor(() => {
      expect(screen.getByText('5000')).toBeInTheDocument()
    })
    expect(document.body.querySelectorAll('tbody tr').length).toBe(6)
    expect(screen.queryByText('6000')).toBeNull()
  })
})

describe('CSVUpload — upload', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
    toastCalls.success.mockClear()
    toastCalls.error.mockClear()
  })

  it('imports successfully: shows the imported count, toasts, and calls onSuccess', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonRes({ success: true, imported: 3 }))
    const onSuccess = vi.fn()

    render(<CSVUpload {...props({ onSuccess })} />)
    selectFile(csvFile('月,勘定科目コード\n1,400'))

    fireEvent.click(screen.getByRole('button', { name: 'アップロード' }))

    await waitFor(() => {
      expect(screen.getByText('3件をインポートしました')).toBeInTheDocument()
    })
    expect(toastCalls.success).toHaveBeenCalledWith('3件の予算をインポートしました')
    expect(onSuccess).toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/reports/budget',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('renders server-supplied errors when the import is not successful', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonRes({ success: false, errors: ['行2の金額が不正です'] }))

    render(<CSVUpload {...props()} />)
    selectFile(csvFile('月,勘定科目コード\n1,400'))

    fireEvent.click(screen.getByRole('button', { name: 'アップロード' }))

    await waitFor(() => {
      expect(screen.getByText('エラーが発生しました')).toBeInTheDocument()
    })
    expect(screen.getByText('行2の金額が不正です')).toBeInTheDocument()
    expect(toastCalls.error).toHaveBeenCalledWith('インポートに失敗しました')
  })

  it('falls back to data.error when errors are absent', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonRes({ success: false, error: 'サーバーエラー' }))

    render(<CSVUpload {...props()} />)
    selectFile(csvFile('月,勘定科目コード\n1,400'))

    fireEvent.click(screen.getByRole('button', { name: 'アップロード' }))

    await waitFor(() => {
      expect(screen.getByText('サーバーエラー')).toBeInTheDocument()
    })
  })
})
