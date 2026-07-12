import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DisclosureEditor, DisclosureList } from '@/components/conversion/disclosure-editor'
import type { DisclosureDocument } from '@/types/conversion'

// disclosure-editor mounts Radix <ScrollArea/> which calls ResizeObserver at mount;
// tests/setup.ts only polyfills IntersectionObserver, so stub it per-file.
beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }))
  )
})

function makeDisclosure(overrides: Partial<DisclosureDocument> = {}): DisclosureDocument {
  return {
    id: 'd1',
    projectId: 'p1',
    category: 'significant_accounting_policies',
    title: '重要な会計方針',
    titleEn: 'Significant Accounting Policies',
    content: '日本語の開示内容',
    contentEn: 'English disclosure content',
    sections: [],
    standardReferences: [],
    relatedRationaleIds: [],
    isGenerated: true,
    isAiEnhanced: false,
    generatedAt: new Date('2024-01-15T00:00:00.000Z'),
    updatedAt: new Date('2024-01-16T00:00:00.000Z'),
    sortOrder: 0,
    ...overrides,
  }
}

// Inferred vi.fn<T>() keeps the mock assignable to the typed callback props
// (a bare `ReturnType<typeof vi.fn>` widens to `Mock<Procedure>` and fails the gate).
const onSave = vi.fn<(d: DisclosureDocument) => Promise<void>>()
const onEnhance = vi.fn<() => Promise<void>>()
const onExport = vi.fn<(f: 'pdf' | 'word') => void>()
const onReview = vi.fn<() => Promise<void>>()
const onSelect = vi.fn<(d: DisclosureDocument) => void>()

beforeEach(() => {
  onSave.mockReset()
  onSave.mockResolvedValue(undefined)
  onEnhance.mockReset()
  onEnhance.mockResolvedValue(undefined)
  onExport.mockReset()
  onReview.mockReset()
  onReview.mockResolvedValue(undefined)
  onSelect.mockReset()
})

function makeProps(opts: { disclosure?: Partial<DisclosureDocument>; withReview?: boolean } = {}) {
  return {
    projectId: 'p1',
    disclosure: makeDisclosure(opts.disclosure),
    onSave,
    onEnhance,
    onExport,
    onReview: opts.withReview ? onReview : undefined,
  }
}

// This @radix-ui/react-tabs build switches tabs from an onMouseDown handler
// (button 0, no ctrlKey), so a plain fireEvent.click() does not activate it.
function activateTab(name: string) {
  const trigger = screen.getByRole('tab', { name })
  fireEvent.mouseDown(trigger, { button: 0 })
  fireEvent.click(trigger)
}

describe('DisclosureEditor — rendering', () => {
  it('renders the disclosure title in the header', () => {
    render(<DisclosureEditor {...makeProps({ disclosure: { title: '減価償却の開示' } })} />)
    expect(screen.getByText('減価償却の開示')).toBeInTheDocument()
  })

  it('shows the AI強化済 badge when isAiEnhanced is true', () => {
    render(<DisclosureEditor {...makeProps({ disclosure: { isAiEnhanced: true } })} />)
    expect(screen.getByText('AI強化済')).toBeInTheDocument()
  })

  it('hides the AI強化済 badge when isAiEnhanced is false', () => {
    render(<DisclosureEditor {...makeProps()} />)
    expect(screen.queryByText('AI強化済')).not.toBeInTheDocument()
  })

  it('shows the レビュー済 badge when reviewedAt is set', () => {
    render(
      <DisclosureEditor
        {...makeProps({ disclosure: { reviewedAt: new Date('2024-02-01T00:00:00.000Z') } })}
      />
    )
    expect(screen.getByText('レビュー済')).toBeInTheDocument()
  })

  it('hides the レビュー済 badge when reviewedAt is absent', () => {
    render(<DisclosureEditor {...makeProps()} />)
    expect(screen.queryByText('レビュー済')).not.toBeInTheDocument()
  })
})

describe('DisclosureEditor — content tabs', () => {
  it('renders the japanese content in the default tab', () => {
    render(<DisclosureEditor {...makeProps({ disclosure: { content: '日本語の内容です' } })} />)
    expect(screen.getByText('日本語の内容です')).toBeInTheDocument()
  })

  it('renders the empty placeholder when japanese content is empty', () => {
    render(<DisclosureEditor {...makeProps({ disclosure: { content: '' } })} />)
    expect(screen.getByText('内容がありません')).toBeInTheDocument()
  })

  it('does not mount the english content until the English tab is selected', () => {
    render(<DisclosureEditor {...makeProps({ disclosure: { contentEn: 'English body text' } })} />)
    expect(screen.queryByText('English body text')).not.toBeInTheDocument()
    activateTab('English')
    expect(screen.getByText('English body text')).toBeInTheDocument()
  })

  it('renders the english placeholder when contentEn is undefined', () => {
    render(<DisclosureEditor {...makeProps({ disclosure: { contentEn: undefined } })} />)
    activateTab('English')
    expect(screen.getByText('No English content available')).toBeInTheDocument()
  })
})

describe('DisclosureEditor — preview tab (markdownToHtml)', () => {
  it('converts markdown headings, emphasis, list items and newlines to html', () => {
    const markdown = '# H1\n## H2\n### H3\n**b** *i*\n- ul\n1. ol'
    const { container } = render(
      <DisclosureEditor {...makeProps({ disclosure: { content: markdown } })} />
    )
    activateTab('プレビュー')
    const preview = container.querySelector('.prose.max-w-none') as HTMLElement
    expect(preview).not.toBeNull()
    const html = preview.innerHTML
    expect(html).toContain('<h1>H1</h1>')
    expect(html).toContain('<h2>H2</h2>')
    expect(html).toContain('<h3>H3</h3>')
    expect(html).toContain('<strong>b</strong>')
    expect(html).toContain('<em>i</em>')
    expect(html).toContain('<li>ul</li>')
    expect(html).toContain('<li>ol</li>')
    expect(html).toContain('<br>')
  })

  it('leaves non-markdown text untouched in the preview', () => {
    const { container } = render(
      <DisclosureEditor {...makeProps({ disclosure: { content: 'plain text 1234' } })} />
    )
    activateTab('プレビュー')
    const preview = container.querySelector('.prose.max-w-none') as HTMLElement
    expect(preview.innerHTML).toContain('plain text 1234')
    expect(preview.innerHTML).not.toContain('<h1>')
  })
})

describe('DisclosureEditor — standard references & rationale', () => {
  it('renders the standard references section when references exist', () => {
    render(
      <DisclosureEditor
        {...makeProps({
          disclosure: {
            standardReferences: [
              { id: 'r1', referenceNumber: 'IFRS 1', title: '初次適用', source: 'IFRS Foundation' },
            ],
          },
        })}
      />
    )
    expect(screen.getByText('参照会計基準')).toBeInTheDocument()
    expect(screen.getByText(/IFRS 1.*初次適用/)).toBeInTheDocument()
  })

  it('hides the standard references section when there are none', () => {
    render(<DisclosureEditor {...makeProps({ disclosure: { standardReferences: [] } })} />)
    expect(screen.queryByText('参照会計基準')).not.toBeInTheDocument()
  })

  it('renders the related rationale section when rationale ids exist', () => {
    render(
      <DisclosureEditor
        {...makeProps({ disclosure: { relatedRationaleIds: ['ra1', 'ra2', 'ra3'] } })}
      />
    )
    expect(screen.getByText('関連する変換根拠')).toBeInTheDocument()
    expect(screen.getByText(/3件の変換根拠が紐付けられています/)).toBeInTheDocument()
  })

  it('hides the related rationale section when there are none', () => {
    render(<DisclosureEditor {...makeProps({ disclosure: { relatedRationaleIds: [] } })} />)
    expect(screen.queryByText('関連する変換根拠')).not.toBeInTheDocument()
  })
})

describe('DisclosureEditor — timestamps', () => {
  it('renders the generatedAt label', () => {
    render(<DisclosureEditor {...makeProps()} />)
    expect(screen.getByText(/生成日時/)).toBeInTheDocument()
  })

  it('renders the reviewedAt label only when reviewedAt is set', () => {
    render(
      <DisclosureEditor
        {...makeProps({ disclosure: { reviewedAt: new Date('2024-02-01T00:00:00.000Z') } })}
      />
    )
    expect(screen.getByText(/レビュー日時/)).toBeInTheDocument()
  })

  it('omits the reviewedAt label when reviewedAt is absent', () => {
    render(<DisclosureEditor {...makeProps()} />)
    expect(screen.queryByText(/レビュー日時/)).not.toBeInTheDocument()
  })
})

describe('DisclosureEditor — AI強化', () => {
  it('calls onEnhance when the AI強化 button is clicked', async () => {
    render(<DisclosureEditor {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: 'AI強化' }))
    await waitFor(() => expect(onEnhance).toHaveBeenCalledTimes(1))
  })

  it('disables the AI強化 button while editing', () => {
    render(<DisclosureEditor {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    expect(screen.getByRole('button', { name: 'AI強化' })).toBeDisabled()
  })
})

describe('DisclosureEditor — review button', () => {
  it('renders the review button when onReview is provided and not yet reviewed', () => {
    render(<DisclosureEditor {...makeProps({ withReview: true })} />)
    expect(screen.getByRole('button', { name: 'レビュー' })).toBeInTheDocument()
  })

  it('hides the review button when already reviewed', () => {
    render(
      <DisclosureEditor
        {...makeProps({
          withReview: true,
          disclosure: { reviewedAt: new Date('2024-02-01T00:00:00.000Z') },
        })}
      />
    )
    expect(screen.queryByRole('button', { name: 'レビュー' })).not.toBeInTheDocument()
  })

  it('hides the review button when onReview is not provided', () => {
    render(<DisclosureEditor {...makeProps()} />)
    expect(screen.queryByRole('button', { name: 'レビュー' })).not.toBeInTheDocument()
  })

  it('calls onReview when the review button is clicked', async () => {
    render(<DisclosureEditor {...makeProps({ withReview: true })} />)
    fireEvent.click(screen.getByRole('button', { name: 'レビュー' }))
    await waitFor(() => expect(onReview).toHaveBeenCalledTimes(1))
  })
})

describe('DisclosureEditor — editing flow', () => {
  it('enters edit mode showing a textarea and the save/cancel actions', () => {
    render(<DisclosureEditor {...makeProps({ disclosure: { content: '元の内容' } })} />)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toHaveValue('元の内容')
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '編集' })).not.toBeInTheDocument()
  })

  it('saves the edited japanese content merged into the disclosure', async () => {
    render(
      <DisclosureEditor
        {...makeProps({ disclosure: { content: '元の内容', contentEn: 'orig en' } })}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '編集後の内容' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'd1', content: '編集後の内容', contentEn: 'orig en' })
    )
  })

  it('saves the edited english content after switching to the English tab', async () => {
    render(<DisclosureEditor {...makeProps({ disclosure: { contentEn: 'orig en' } })} />)
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    activateTab('English')
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'edited en' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ contentEn: 'edited en' }))
  })

  it('reverts to view mode after a successful save', async () => {
    render(<DisclosureEditor {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: '編集' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument()
  })

  it('resets edited content and exits editing on cancel', () => {
    render(<DisclosureEditor {...makeProps({ disclosure: { content: '元の内容' } })} />)
    fireEvent.click(screen.getByRole('button', { name: '編集' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '一時的な変更' } })
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '編集' })).toBeInTheDocument()
    expect(screen.getByText('元の内容')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })
})

describe('DisclosureEditor — export', () => {
  it('calls onExport with word when the Word button is clicked', async () => {
    render(<DisclosureEditor {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Word' }))
    await waitFor(() => expect(onExport).toHaveBeenCalledWith('word'))
  })

  it('calls onExport with pdf when the PDF button is clicked', async () => {
    render(<DisclosureEditor {...makeProps()} />)
    fireEvent.click(screen.getByRole('button', { name: 'PDF' }))
    await waitFor(() => expect(onExport).toHaveBeenCalledWith('pdf'))
  })

  it('disables both export buttons while an export is in flight, then re-enables', async () => {
    let resolveExport: () => void
    onExport.mockImplementation(() => new Promise<void>((resolve) => (resolveExport = resolve)))
    render(<DisclosureEditor {...makeProps()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Word' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Word' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'PDF' })).toBeDisabled()
    })
    expect(onExport).toHaveBeenCalledWith('word')

    resolveExport!()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Word' })).toBeEnabled()
      expect(screen.getByRole('button', { name: 'PDF' })).toBeEnabled()
    })
  })
})

// The async handlers (handleEnhance/handleSave/handleExport) wrap their awaited
// callback in try/finally with NO catch, so a rejecting callback surfaces as an
// unhandled rejection that crashes the vitest worker. Each rejection-path test
// attaches a scoped swallower and detaches in finally.
describe('DisclosureEditor — fail-safe (handlers reset state on rejection)', () => {
  it('re-enables the AI強化 button when onEnhance rejects', async () => {
    const swallow = vi.fn()
    process.on('unhandledRejection', swallow)
    onEnhance.mockRejectedValue(new Error('enhance boom'))
    try {
      render(<DisclosureEditor {...makeProps()} />)
      const button = screen.getByRole('button', { name: 'AI強化' })
      fireEvent.click(button)
      await waitFor(() => expect(button).toBeEnabled())
      expect(onEnhance).toHaveBeenCalledTimes(1)
      await new Promise((r) => setTimeout(r, 0))
    } finally {
      process.off('unhandledRejection', swallow)
    }
  })

  it('re-enables save and stays in edit mode when onSave rejects', async () => {
    const swallow = vi.fn()
    process.on('unhandledRejection', swallow)
    onSave.mockRejectedValue(new Error('save boom'))
    try {
      render(<DisclosureEditor {...makeProps()} />)
      fireEvent.click(screen.getByRole('button', { name: '編集' }))
      fireEvent.click(screen.getByRole('button', { name: '保存' }))
      await waitFor(() => expect(screen.getByRole('button', { name: '保存' })).toBeEnabled())
      expect(screen.queryByRole('button', { name: '編集' })).not.toBeInTheDocument()
      expect(onSave).toHaveBeenCalledTimes(1)
      await new Promise((r) => setTimeout(r, 0))
    } finally {
      process.off('unhandledRejection', swallow)
    }
  })

  it('re-enables export buttons when onExport rejects', async () => {
    const swallow = vi.fn()
    process.on('unhandledRejection', swallow)
    onExport.mockImplementation(() => Promise.reject(new Error('export boom')))
    try {
      render(<DisclosureEditor {...makeProps()} />)
      fireEvent.click(screen.getByRole('button', { name: 'PDF' }))
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'PDF' })).toBeEnabled()
        expect(screen.getByRole('button', { name: 'Word' })).toBeEnabled()
      })
      expect(onExport).toHaveBeenCalledWith('pdf')
      await new Promise((r) => setTimeout(r, 0))
    } finally {
      process.off('unhandledRejection', swallow)
    }
  })

  it('survives an onReview rejection (handleReview has no try/finally guard)', async () => {
    const swallow = vi.fn()
    process.on('unhandledRejection', swallow)
    onReview.mockRejectedValue(new Error('review boom'))
    try {
      render(<DisclosureEditor {...makeProps({ withReview: true })} />)
      fireEvent.click(screen.getByRole('button', { name: 'レビュー' }))
      await waitFor(() => expect(onReview).toHaveBeenCalledTimes(1))
      await new Promise((r) => setTimeout(r, 0))
      expect(swallow).toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', swallow)
    }
  })
})

describe('DisclosureList', () => {
  function makeListProps(opts: { disclosures?: DisclosureDocument[]; selectedId?: string } = {}) {
    return {
      projectId: 'p1',
      disclosures: opts.disclosures ?? [
        makeDisclosure({ id: 'd1', title: '開示A', content: 'これは開示Aの内容です。' }),
        makeDisclosure({ id: 'd2', title: '開示B', content: '開示Bの内容' }),
      ],
      onSelect,
      selectedId: opts.selectedId,
    }
  }

  it('renders the empty state when there are no disclosures', () => {
    render(<DisclosureList {...makeListProps({ disclosures: [] })} />)
    expect(screen.getByText('開示文書がありません')).toBeInTheDocument()
  })

  it('renders one selectable button per disclosure with its title', () => {
    render(<DisclosureList {...makeListProps()} />)
    expect(screen.getByText('開示A')).toBeInTheDocument()
    expect(screen.getByText('開示B')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('calls onSelect with the clicked disclosure', () => {
    render(<DisclosureList {...makeListProps()} />)
    fireEvent.click(screen.getByRole('button', { name: /開示A/ }))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'd1', title: '開示A' }))
  })

  it('highlights the selected disclosure and leaves others default', () => {
    render(<DisclosureList {...makeListProps({ selectedId: 'd1' })} />)
    expect(screen.getByRole('button', { name: /開示A/ })).toHaveClass('border-primary')
    expect(screen.getByRole('button', { name: /開示B/ })).not.toHaveClass('border-primary')
  })

  it('renders AI and reviewed badges per item', () => {
    render(
      <DisclosureList
        {...makeListProps({
          disclosures: [
            makeDisclosure({
              id: 'd1',
              title: '開示A',
              content: 'x',
              isAiEnhanced: true,
              reviewedAt: new Date('2024-02-01T00:00:00.000Z'),
            }),
          ],
        })}
      />
    )
    expect(screen.getByText('AI')).toBeInTheDocument()
    expect(screen.getByText('済')).toBeInTheDocument()
  })

  it('renders a truncated preview of each disclosure content', () => {
    render(<DisclosureList {...makeListProps()} />)
    expect(screen.getByText(/これは開示Aの内容です。\.\.\./)).toBeInTheDocument()
  })
})
