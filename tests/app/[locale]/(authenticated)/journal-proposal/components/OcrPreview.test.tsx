import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next-intl', () => {
  const labels: Record<string, string> = {
    title: 'OCR結果',
    confidence: '信頼度',
    rawText: '抽出テキスト',
    extractedInfo: '抽出情報',
    date: '日付',
    vendor: '取引先',
    amount: '金額',
    taxAmount: '消費税',
    taxRate: '税率',
    items: '明細',
    paymentMethod: '支払方法',
    warnings: '警告',
  }
  return { useTranslations: () => (key: string) => labels[key] ?? key }
})

import { OcrPreview } from '@/app/[locale]/(authenticated)/journal-proposal/components/OcrPreview'
import type { OCRAnalysisResult } from '@/types/journal-proposal'

function buildOcrResult(overrides: Partial<OCRAnalysisResult> = {}): OCRAnalysisResult {
  return {
    rawText: 'レシート',
    extractedInfo: {},
    confidence: 0.85,
    warnings: [],
    ...overrides,
  }
}

function valueNextTo(label: string): string | null {
  const labelEl = screen.getByText(label)
  return labelEl.nextElementSibling?.textContent ?? null
}

function greenSpans(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('span.text-green-600')).map(
    (el) => el.textContent ?? ''
  )
}

describe('OcrPreview — structure (happy path)', () => {
  const fullResult: OCRAnalysisResult = {
    rawText: 'テスト商店のお買上金額 ¥1,234',
    extractedInfo: {
      date: '2024-01-15',
      vendorName: 'テスト商店',
      totalAmount: 1234,
      taxAmount: 112,
      taxRate: 0.1,
      paymentMethod: 'クレジットカード',
      items: [
        { name: '商品A', amount: 1000 },
        { name: '商品B', amount: 234 },
      ],
    },
    confidence: 0.85,
    warnings: ['金額を確認してください', '日付が不明瞭です'],
  }

  it('renders the OCR result title', () => {
    render(<OcrPreview ocrResult={fullResult} />)
    expect(screen.getByText('OCR結果')).toBeInTheDocument()
  })

  it('renders a confidence progressbar reflecting the OCR confidence', () => {
    render(<OcrPreview ocrResult={fullResult} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '85')
  })

  it('renders the confidence label in the header', () => {
    render(<OcrPreview ocrResult={fullResult} />)
    expect(screen.getByText(/信頼度/)).toBeInTheDocument()
  })

  it('renders every extracted-info row when fully populated', () => {
    render(<OcrPreview ocrResult={fullResult} />)
    expect(screen.getByText('抽出情報')).toBeInTheDocument()
    expect(valueNextTo('日付')).toBe('2024-01-15')
    expect(valueNextTo('取引先')).toBe('テスト商店')
    expect(valueNextTo('支払方法')).toBe('クレジットカード')
  })

  it('renders the items section header and each line item', () => {
    render(<OcrPreview ocrResult={fullResult} />)
    expect(screen.getByText('明細')).toBeInTheDocument()
    expect(screen.getByText('商品A')).toBeInTheDocument()
    expect(screen.getByText('商品B')).toBeInTheDocument()
  })

  it('renders the raw-text section header', () => {
    render(<OcrPreview ocrResult={fullResult} />)
    expect(screen.getByText('抽出テキスト')).toBeInTheDocument()
  })

  it('renders each warning as a badge when warnings are present', () => {
    render(<OcrPreview ocrResult={fullResult} />)
    expect(screen.getByText('警告')).toBeInTheDocument()
    expect(screen.getByText('金額を確認してください')).toBeInTheDocument()
    expect(screen.getByText('日付が不明瞭です')).toBeInTheDocument()
  })
})

describe('OcrPreview — conditional rendering (edge cases)', () => {
  it('omits the amount row when totalAmount is absent', () => {
    render(<OcrPreview ocrResult={buildOcrResult({ extractedInfo: { date: '2024-01-15' } })} />)
    expect(screen.queryByText('金額')).toBeNull()
    expect(screen.getByText('日付')).toBeInTheDocument()
  })

  it('omits the items section when items is an empty array', () => {
    render(<OcrPreview ocrResult={buildOcrResult({ extractedInfo: { items: [] } })} />)
    expect(screen.queryByText('明細')).toBeNull()
  })

  it('omits the items section when items is undefined', () => {
    render(<OcrPreview ocrResult={buildOcrResult({ extractedInfo: {} })} />)
    expect(screen.queryByText('明細')).toBeNull()
  })

  it('omits the warnings section when warnings is empty', () => {
    render(<OcrPreview ocrResult={buildOcrResult({ warnings: [] })} />)
    expect(screen.queryByText('警告')).toBeNull()
  })

  it('renders only the fields present in a sparse extractedInfo', () => {
    render(
      <OcrPreview
        ocrResult={buildOcrResult({
          extractedInfo: { vendorName: '商店X', paymentMethod: '現金' },
        })}
      />
    )
    expect(screen.getByText('取引先')).toBeInTheDocument()
    expect(screen.getByText('支払方法')).toBeInTheDocument()
    expect(screen.queryByText('日付')).toBeNull()
    expect(screen.queryByText('金額')).toBeNull()
    expect(screen.queryByText('税率')).toBeNull()
  })

  it('renders without crashing for a minimal valid result (fail-safe)', () => {
    const minimal: OCRAnalysisResult = {
      rawText: '',
      extractedInfo: {},
      confidence: 0,
      warnings: [],
    }
    render(<OcrPreview ocrResult={minimal} />)
    expect(screen.getByText('OCR結果')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(screen.queryByText('日付')).toBeNull()
    expect(screen.queryByText('金額')).toBeNull()
    expect(screen.queryByText('明細')).toBeNull()
    expect(screen.queryByText('警告')).toBeNull()
  })
})

describe('OcrPreview — value formatting', () => {
  it('prefixes the total amount with a yen sign and locale grouping', () => {
    render(<OcrPreview ocrResult={buildOcrResult({ extractedInfo: { totalAmount: 1234 } })} />)
    expect(valueNextTo('金額')).toMatch(/^¥1[.,]?234$/)
  })

  it('formats a zero total amount as ¥0', () => {
    render(<OcrPreview ocrResult={buildOcrResult({ extractedInfo: { totalAmount: 0 } })} />)
    expect(valueNextTo('金額')).toBe('¥0')
  })

  it('prefixes the tax amount with a yen sign', () => {
    render(<OcrPreview ocrResult={buildOcrResult({ extractedInfo: { taxAmount: 112 } })} />)
    expect(valueNextTo('消費税')).toMatch(/^¥1[.,]?12$/)
  })

  it('formats a 0.1 tax rate as 10%', () => {
    render(<OcrPreview ocrResult={buildOcrResult({ extractedInfo: { taxRate: 0.1 } })} />)
    expect(valueNextTo('税率')).toBe('10%')
  })

  it('formats a 0.08 tax rate as 8% (float rounding)', () => {
    render(<OcrPreview ocrResult={buildOcrResult({ extractedInfo: { taxRate: 0.08 } })} />)
    expect(valueNextTo('税率')).toBe('8%')
  })

  it('formats tax rate boundaries 0 and 1 as 0% and 100%', () => {
    const { rerender } = render(
      <OcrPreview ocrResult={buildOcrResult({ extractedInfo: { taxRate: 0 } })} />
    )
    expect(valueNextTo('税率')).toBe('0%')
    rerender(<OcrPreview ocrResult={buildOcrResult({ extractedInfo: { taxRate: 1 } })} />)
    expect(valueNextTo('税率')).toBe('100%')
  })

  it('prefixes each line-item amount with a yen sign', () => {
    render(
      <OcrPreview
        ocrResult={buildOcrResult({
          extractedInfo: { items: [{ name: '商品A', amount: 1000 }] },
        })}
      />
    )
    expect(screen.getByText('商品A').nextElementSibling?.textContent ?? '').toMatch(/^¥1[.,]?000$/)
  })

  it('omits the item amount element when the item amount is undefined', () => {
    render(
      <OcrPreview
        ocrResult={buildOcrResult({
          extractedInfo: { items: [{ name: '商品A' }] },
        })}
      />
    )
    expect(screen.getByText('商品A').nextElementSibling).toBeNull()
  })
})

describe('OcrPreview — raw-text keyword highlighting', () => {
  it('highlights a yen-prefixed amount in green', () => {
    const { container } = render(
      <OcrPreview ocrResult={buildOcrResult({ rawText: '合計 ¥1,234 です' })} />
    )
    expect(greenSpans(container)).toContain('¥1,234')
  })

  it('wraps each of multiple yen amounts in its own green span', () => {
    const { container } = render(
      <OcrPreview ocrResult={buildOcrResult({ rawText: '¥1,000 と ¥2,000' })} />
    )
    expect(greenSpans(container)).toEqual(expect.arrayContaining(['¥1,000', '¥2,000']))
    expect(greenSpans(container).length).toBe(2)
  })

  it('renders rawText without green spans when no amount-like token is present', () => {
    const { container } = render(
      <OcrPreview ocrResult={buildOcrResult({ rawText: 'テキストのみです' })} />
    )
    expect(greenSpans(container)).toHaveLength(0)
  })

  it('preserves the full raw-text content for the user', () => {
    const raw = '1行目\n2行目 ¥500\n3行目'
    const { container } = render(<OcrPreview ocrResult={buildOcrResult({ rawText: raw })} />)
    const rawBlock = container.querySelector('.whitespace-pre-wrap')
    expect(rawBlock?.textContent).toContain('1行目')
    expect(rawBlock?.textContent).toContain('2行目')
    expect(rawBlock?.textContent).toContain('3行目')
    expect(rawBlock?.textContent).toContain('¥500')
  })
})

describe('OcrPreview — className prop', () => {
  it('forwards the className prop to the card root', () => {
    const { container } = render(
      <OcrPreview ocrResult={buildOcrResult()} className="ocr-preview-root-marker" />
    )
    const root = container.querySelector('.ocr-preview-root-marker')
    expect(root).not.toBeNull()
    expect(root?.className).toContain('rounded-lg')
  })
})
