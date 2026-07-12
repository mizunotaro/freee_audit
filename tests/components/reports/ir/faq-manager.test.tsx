import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FAQManager } from '@/components/reports/ir/faq-manager'
import type { FAQItem } from '@/types/reports/ir-report'

function makeFAQ(overrides: Partial<FAQItem> = {}): FAQItem {
  return {
    id: overrides.id ?? 'faq-1',
    question: overrides.question ?? { ja: '質問1', en: 'Question 1' },
    answer: overrides.answer ?? { ja: '回答1', en: 'Answer 1' },
    order: overrides.order ?? 0,
    category: overrides.category,
  }
}

function getRow(text: string): HTMLElement {
  const el = screen.getByText(text)
  const row = el.closest('[draggable]') ?? el.closest('[class~="rounded-md"]')
  if (!row) {
    throw new Error(`No FAQ row found containing text "${text}"`)
  }
  return row as HTMLElement
}

function getRowButtons(text: string): HTMLElement[] {
  return Array.from(getRow(text).querySelectorAll('button:not([aria-expanded])'))
}

describe('FAQManager', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    mockOnChange.mockReset()
  })

  describe('rendering', () => {
    it('renders the default title and an add button', () => {
      render(<FAQManager faqs={[]} onChange={mockOnChange} />)

      expect(screen.getByText('FAQ管理')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /追加/ })).toBeInTheDocument()
    })

    it('renders a custom title when provided', () => {
      render(<FAQManager faqs={[]} onChange={mockOnChange} title="カスタムFAQ" />)

      expect(screen.getByText('カスタムFAQ')).toBeInTheDocument()
      expect(screen.queryByText('FAQ管理')).not.toBeInTheDocument()
    })

    it('shows the Japanese empty state when there are no FAQs', () => {
      render(<FAQManager faqs={[]} onChange={mockOnChange} />)

      expect(screen.getByText('FAQがありません')).toBeInTheDocument()
    })

    it('shows the English empty state for language en', () => {
      render(<FAQManager faqs={[]} onChange={mockOnChange} language="en" />)

      expect(screen.getByText('No FAQs')).toBeInTheDocument()
    })

    it('hides the add button in read-only mode', () => {
      render(<FAQManager faqs={[]} onChange={mockOnChange} readOnly />)

      expect(screen.queryByRole('button', { name: /追加/ })).toBeNull()
    })

    it('renders FAQs sorted by order regardless of array order', () => {
      const a = makeFAQ({ id: 'a', question: { ja: 'Alpha', en: 'Alpha' }, order: 0 })
      const b = makeFAQ({ id: 'b', question: { ja: 'Beta', en: 'Beta' }, order: 1 })

      render(<FAQManager faqs={[b, a]} onChange={mockOnChange} />)

      expect(screen.getByText('Alpha').compareDocumentPosition(screen.getByText('Beta'))).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      )
    })

    it('shows the Japanese fallback question when the question is empty', () => {
      const faq = makeFAQ({ id: 'f', question: { ja: '', en: '' }, order: 0 })

      render(<FAQManager faqs={[faq]} onChange={mockOnChange} />)

      expect(screen.getByText('質問 1')).toBeInTheDocument()
    })

    it('shows the English fallback question when language is en and en is empty', () => {
      const faq = makeFAQ({
        id: 'f',
        question: { ja: '日本語質問', en: '' },
        order: 0,
      })

      render(<FAQManager faqs={[faq]} onChange={mockOnChange} language="en" />)

      expect(screen.getByText('Question 1')).toBeInTheDocument()
    })
  })

  describe('read-only mode', () => {
    it('renders no action buttons', () => {
      const faq = makeFAQ({ question: { ja: '質問', en: 'Question' }, order: 0 })

      const { container } = render(<FAQManager faqs={[faq]} onChange={mockOnChange} readOnly />)

      expect(container.querySelector('button:not([aria-expanded])')).toBeNull()
    })

    it('reveals the answer when a row is expanded', () => {
      const faq = makeFAQ({
        id: 'f',
        question: { ja: '質問文', en: 'Question' },
        answer: { ja: '回答文', en: 'Answer' },
        order: 0,
      })

      render(<FAQManager faqs={[faq]} onChange={mockOnChange} readOnly />)

      expect(screen.queryByText('回答:')).toBeNull()
      expect(screen.queryByText('回答文')).toBeNull()

      fireEvent.click(screen.getByText('質問文'))

      expect(screen.getByText('回答:')).toBeInTheDocument()
      expect(screen.getByText('回答文')).toBeInTheDocument()
    })
  })

  describe('handleAdd', () => {
    it('appends a new empty FAQ and notifies the parent', () => {
      render(<FAQManager faqs={[]} onChange={mockOnChange} />)

      fireEvent.click(screen.getByRole('button', { name: /追加/ }))

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      const next = mockOnChange.mock.calls[0][0] as FAQItem[]
      expect(next).toHaveLength(1)

      const created = next[0]
      expect(created.id).toMatch(/^faq_\d+_[a-z0-9]+$/)
      expect(created.question).toEqual({ ja: '', en: '' })
      expect(created.answer).toEqual({ ja: '', en: '' })
      expect(created.order).toBe(0)
    })

    it('assigns the new FAQ an order equal to the current length', () => {
      const existing = makeFAQ({ id: 'e', order: 0 })

      render(<FAQManager faqs={[existing]} onChange={mockOnChange} />)

      fireEvent.click(screen.getByRole('button', { name: /追加/ }))

      const next = mockOnChange.mock.calls[0][0] as FAQItem[]
      expect(next).toHaveLength(2)
      expect(next[0]).toEqual(expect.objectContaining({ id: 'e' }))
      expect(next[1].order).toBe(1)
    })
  })

  describe('handleUpdate', () => {
    it('updates the Japanese question field while preserving other fields', () => {
      const faq = makeFAQ({ id: 'f', order: 0 })

      render(<FAQManager faqs={[faq]} onChange={mockOnChange} />)

      fireEvent.click(screen.getByText('質問1'))
      fireEvent.change(screen.getByPlaceholderText('質問を入力'), {
        target: { value: '新しい質問' },
      })

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      const next = mockOnChange.mock.calls[0][0] as FAQItem[]
      expect(next[0]).toEqual({
        id: 'f',
        question: { ja: '新しい質問', en: 'Question 1' },
        answer: { ja: '回答1', en: 'Answer 1' },
        order: 0,
      })
    })

    it('updates the English answer field for language en', () => {
      const faq = makeFAQ({
        id: 'f',
        answer: { ja: '回答1', en: '' },
        question: { ja: '質問1', en: 'Question 1' },
        order: 0,
      })

      render(<FAQManager faqs={[faq]} onChange={mockOnChange} language="en" />)

      fireEvent.click(screen.getByText('Question 1'))
      fireEvent.change(screen.getByPlaceholderText('Enter answer in English'), {
        target: { value: 'English answer' },
      })

      const next = mockOnChange.mock.calls[0][0] as FAQItem[]
      expect(next[0].answer).toEqual({ ja: '回答1', en: 'English answer' })
    })
  })

  describe('handleDelete', () => {
    it('removes the FAQ and re-numbers the remaining orders', () => {
      const a = makeFAQ({ id: 'a', question: { ja: 'Alpha', en: 'Alpha' }, order: 0 })
      const b = makeFAQ({ id: 'b', question: { ja: 'Beta', en: 'Beta' }, order: 1 })

      render(<FAQManager faqs={[a, b]} onChange={mockOnChange} />)

      const [, , deleteButton] = getRowButtons('Alpha')
      fireEvent.click(deleteButton)

      const next = mockOnChange.mock.calls[0][0] as FAQItem[]
      expect(next).toHaveLength(1)
      expect(next[0].id).toBe('b')
      expect(next[0].order).toBe(0)
    })

    it('collapses the edit form when the expanded FAQ is deleted', () => {
      const faq = makeFAQ({
        id: 'f',
        question: { ja: '質問文', en: 'Question' },
        order: 0,
      })

      render(<FAQManager faqs={[faq]} onChange={mockOnChange} />)

      fireEvent.click(screen.getByText('質問文'))
      expect(screen.getByPlaceholderText('質問を入力')).toBeInTheDocument()

      const [, , deleteButton] = getRowButtons('質問文')
      fireEvent.click(deleteButton)

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      expect(screen.queryByPlaceholderText('質問を入力')).not.toBeInTheDocument()
    })
  })

  describe('handleMoveUp', () => {
    it('swaps the FAQ with the previous one and re-numbers', () => {
      const a = makeFAQ({ id: 'a', question: { ja: 'Alpha', en: 'Alpha' }, order: 0 })
      const b = makeFAQ({ id: 'b', question: { ja: 'Beta', en: 'Beta' }, order: 1 })

      render(<FAQManager faqs={[a, b]} onChange={mockOnChange} />)

      const [upButton] = getRowButtons('Beta')
      fireEvent.click(upButton)

      const next = mockOnChange.mock.calls[0][0] as FAQItem[]
      expect(next.map((f) => f.id)).toEqual(['b', 'a'])
      expect(next.map((f) => f.order)).toEqual([0, 1])
    })

    it('disables move-up on the first FAQ', () => {
      const a = makeFAQ({ id: 'a', question: { ja: 'Alpha', en: 'Alpha' }, order: 0 })

      render(<FAQManager faqs={[a]} onChange={mockOnChange} />)

      const [upButton] = getRowButtons('Alpha')
      expect(upButton).toBeDisabled()
    })
  })

  describe('handleMoveDown', () => {
    it('swaps the FAQ with the next one and re-numbers', () => {
      const a = makeFAQ({ id: 'a', question: { ja: 'Alpha', en: 'Alpha' }, order: 0 })
      const b = makeFAQ({ id: 'b', question: { ja: 'Beta', en: 'Beta' }, order: 1 })

      render(<FAQManager faqs={[a, b]} onChange={mockOnChange} />)

      const [, downButton] = getRowButtons('Alpha')
      fireEvent.click(downButton)

      const next = mockOnChange.mock.calls[0][0] as FAQItem[]
      expect(next.map((f) => f.id)).toEqual(['b', 'a'])
      expect(next.map((f) => f.order)).toEqual([0, 1])
    })

    it('disables move-down on the last FAQ', () => {
      const a = makeFAQ({ id: 'a', question: { ja: 'Alpha', en: 'Alpha' }, order: 0 })

      render(<FAQManager faqs={[a]} onChange={mockOnChange} />)

      const [, downButton] = getRowButtons('Alpha')
      expect(downButton).toBeDisabled()
    })
  })

  describe('drag and drop reordering', () => {
    it('reorders FAQs on dragOver and notifies the parent', () => {
      const a = makeFAQ({ id: 'a', question: { ja: 'Alpha', en: 'Alpha' }, order: 0 })
      const b = makeFAQ({ id: 'b', question: { ja: 'Beta', en: 'Beta' }, order: 1 })

      render(<FAQManager faqs={[a, b]} onChange={mockOnChange} />)

      const rowA = getRow('Alpha')
      const rowB = getRow('Beta')

      fireEvent.dragStart(rowA)
      fireEvent.dragOver(rowB)

      expect(mockOnChange).toHaveBeenCalledTimes(1)
      const next = mockOnChange.mock.calls[0][0] as FAQItem[]
      expect(next.map((f) => f.id)).toEqual(['b', 'a'])
      expect(next.map((f) => f.order)).toEqual([0, 1])
    })

    it('does not reorder when dragging over the same item', () => {
      const a = makeFAQ({ id: 'a', question: { ja: 'Alpha', en: 'Alpha' }, order: 0 })

      render(<FAQManager faqs={[a]} onChange={mockOnChange} />)

      const rowA = getRow('Alpha')

      fireEvent.dragStart(rowA)
      fireEvent.dragOver(rowA)

      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it('does not reorder on dragOver without a prior dragStart', () => {
      const a = makeFAQ({ id: 'a', question: { ja: 'Alpha', en: 'Alpha' }, order: 0 })
      const b = makeFAQ({ id: 'b', question: { ja: 'Beta', en: 'Beta' }, order: 1 })

      render(<FAQManager faqs={[a, b]} onChange={mockOnChange} />)

      fireEvent.dragOver(getRow('Beta'))

      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it('clears the dragged state on dragEnd without notifying the parent', () => {
      const a = makeFAQ({ id: 'a', question: { ja: 'Alpha', en: 'Alpha' }, order: 0 })
      const b = makeFAQ({ id: 'b', question: { ja: 'Beta', en: 'Beta' }, order: 1 })

      render(<FAQManager faqs={[a, b]} onChange={mockOnChange} />)

      const rowA = getRow('Alpha')
      fireEvent.dragStart(rowA)
      fireEvent.dragEnd(rowA)

      expect(mockOnChange).not.toHaveBeenCalled()
    })
  })

  describe('localization', () => {
    it('prefers the Japanese text in bilingual mode', () => {
      const faq = makeFAQ({
        id: 'f',
        question: { ja: '日本語質問', en: 'EN question' },
        order: 0,
      })

      render(<FAQManager faqs={[faq]} onChange={mockOnChange} language="bilingual" />)

      expect(screen.getByText('日本語質問')).toBeInTheDocument()
    })

    it('falls back to the English text in bilingual mode when Japanese is empty', () => {
      const faq = makeFAQ({
        id: 'f',
        question: { ja: '', en: 'EN only' },
        order: 0,
      })

      render(<FAQManager faqs={[faq]} onChange={mockOnChange} language="bilingual" />)

      expect(screen.getByText('EN only')).toBeInTheDocument()
    })

    it('renders both language edit fields when expanded in bilingual mode', () => {
      const faq = makeFAQ({ id: 'f', order: 0 })

      render(<FAQManager faqs={[faq]} onChange={mockOnChange} language="bilingual" />)

      fireEvent.click(screen.getByText('質問1'))

      expect(screen.getByPlaceholderText('質問を入力')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter question in English')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('回答を入力')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter answer in English')).toBeInTheDocument()
    })
  })

  describe('accessibility (disclosure)', () => {
    it('renders the question header as a disclosure button wired to its panel', () => {
      const faq = makeFAQ({ id: 'f1', question: { ja: '質問A', en: 'Q' }, order: 0 })
      render(<FAQManager faqs={[faq]} onChange={mockOnChange} />)

      const trigger = screen.getByRole('button', { name: '質問A' })
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
      expect(trigger).toHaveAttribute('aria-controls', 'faq-panel-f1')
      expect(trigger).toHaveAttribute('id', 'faq-trigger-f1')
    })

    it('toggles aria-expanded and reveals the labelled panel on click', () => {
      const faq = makeFAQ({ id: 'f1', question: { ja: '質問A', en: 'Q' }, order: 0 })
      render(<FAQManager faqs={[faq]} onChange={mockOnChange} />)

      const trigger = screen.getByRole('button', { name: '質問A' })
      expect(screen.queryByRole('region')).not.toBeInTheDocument()

      fireEvent.click(trigger)

      expect(trigger).toHaveAttribute('aria-expanded', 'true')
      const panel = screen.getByRole('region')
      expect(panel).toHaveAttribute('id', 'faq-panel-f1')
      expect(panel).toHaveAttribute('aria-labelledby', 'faq-trigger-f1')
    })

    it('gives the icon-only action buttons accessible names', () => {
      const faq = makeFAQ({ id: 'f1', question: { ja: '質問A', en: 'Q' }, order: 0 })
      render(<FAQManager faqs={[faq]} onChange={mockOnChange} />)

      const [up, down, del] = getRowButtons('質問A')
      expect(up).toHaveAttribute('aria-label', '上に移動')
      expect(down).toHaveAttribute('aria-label', '下に移動')
      expect(del).toHaveAttribute('aria-label', '削除')
    })

    it('keeps the disclosure button but drops action buttons in read-only mode', () => {
      const faq = makeFAQ({ id: 'f1', question: { ja: '質問A', en: 'Q' }, order: 0 })
      render(<FAQManager faqs={[faq]} onChange={mockOnChange} readOnly />)

      expect(screen.getByRole('button', { name: '質問A' })).toHaveAttribute(
        'aria-expanded',
        'false'
      )
      expect(screen.queryByRole('button', { name: '削除' })).not.toBeInTheDocument()
    })
  })
})
