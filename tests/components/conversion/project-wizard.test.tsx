import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ProjectWizard } from '@/components/conversion/project-wizard'
import type { AccountingStandard } from '@/types/conversion'

// The wizard is built on Radix-based shadcn primitives (Select = Radix Select,
// Switch = Radix Switch) whose portals / pointer-capture behaviour do not work
// in jsdom. These primitives are a UI boundary, not the wizard logic under test.
// We follow the established repo pattern (mapping-filters.test.tsx,
// ProposalActions.test.tsx) and replace them with native equivalents that keep
// the component's own value -> onValueChange / checked -> onCheckedChange wiring
// live and drivable, instead of a blind pass-through that would hide the logic.

// router.push is asserted per-test, so it must be a stable, hoisted reference.
const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/components/ui/select', () => {
  const React: typeof import('react') = require('react')
  const SelectItem = () => null
  const SelectValue = ({ placeholder }: { placeholder?: string }) =>
    placeholder ? React.createElement('span', null, placeholder) : null

  type Item = { value: string; label: string }

  // Walk the children to collect SelectItem options + the SelectValue
  // placeholder so the native <select> can render a queryable empty option.
  function collect(node: React.ReactNode): { items: Item[]; placeholder: string } {
    const items: Item[] = []
    let placeholder = ''
    const walk = (n: React.ReactNode) => {
      React.Children.forEach(n, (child) => {
        if (!React.isValidElement(child)) return
        if (child.type === SelectValue) {
          placeholder = (child.props as { placeholder?: string }).placeholder ?? ''
        }
        if (child.type === SelectItem) {
          const raw = (child.props as { children?: ReactNode }).children
          const label = typeof raw === 'string' ? raw : String(raw ?? '')
          items.push({ value: (child.props as { value: string }).value, label })
          return
        }
        if (child.props && child.props.children) walk(child.props.children)
      })
    }
    walk(node)
    return { items, placeholder }
  }

  // The two selects are told apart by their SelectItem value signature:
  // the target-standard select holds USGAAP/IFRS; the COA select holds coa ids.
  function testidFor(items: Item[]): string {
    const values = items.map((i) => i.value).join('|')
    if (values === 'USGAAP|IFRS') return 'standard-select'
    return 'coa-select'
  }

  const Select = ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value?: string
    onValueChange?: (v: string) => void
    disabled?: boolean
    children?: ReactNode
  }) => {
    const { items, placeholder } = collect(children)
    const options: Array<React.ReactElement | null> = []
    if (placeholder) {
      options.push(React.createElement('option', { key: 'ph', value: '' }, placeholder))
    }
    items.forEach((i) =>
      options.push(
        React.createElement('option', { key: `${i.value}|${i.label}`, value: i.value }, i.label)
      )
    )
    return React.createElement(
      'select',
      {
        'data-testid': testidFor(items),
        value: value ?? '',
        disabled,
        onChange: (e: { target: { value: string } }) => onValueChange?.(e.target.value),
      },
      options
    )
  }
  const Pass = ({ children }: { children?: ReactNode }) => children ?? null
  return {
    Select,
    SelectContent: Pass,
    SelectItem,
    SelectTrigger: Pass,
    SelectValue,
  }
})

vi.mock('@/components/ui/switch', () => {
  const React: typeof import('react') = require('react')
  const Switch = ({
    checked,
    onCheckedChange,
    disabled,
  }: {
    checked?: boolean
    onCheckedChange?: (v: boolean) => void
    disabled?: boolean
  }) =>
    React.createElement('input', {
      type: 'checkbox',
      role: 'switch',
      checked: checked ?? false,
      disabled,
      onChange: (e: { target: { checked: boolean } }) => onCheckedChange?.(e.target.checked),
    })
  return { Switch }
})

const COAS: Array<{ id: string; name: string; standard: AccountingStandard }> = [
  { id: 'coa-us-1', name: 'US GAAP Chart A', standard: 'USGAAP' },
  { id: 'coa-us-2', name: 'US GAAP Chart B', standard: 'USGAAP' },
  { id: 'coa-ifrs-1', name: 'IFRS Chart', standard: 'IFRS' },
]

function renderWizard(chartOfAccounts: typeof COAS = COAS, companyId = 'comp-1') {
  return render(<ProjectWizard companyId={companyId} chartOfAccounts={chartOfAccounts} />)
}

// Step-0 controls
const nameInput = () => screen.getByPlaceholderText('例: 2024年度 IFRS変換') as HTMLInputElement
const descInput = () =>
  screen.getByPlaceholderText('プロジェクトの目的や備考を入力') as HTMLTextAreaElement
// Navigation controls
const nextBtn = () => screen.getByRole('button', { name: '次へ' })
const backBtn = () => screen.getByRole('button', { name: /戻る/ })
const createBtn = () => screen.getByRole('button', { name: /作成/ })

// The four step-3 switches share role="switch"; locate the one whose row holds
// the given label text (render order is fixed: 仕訳変換 / 財務諸表変換 / 調整仕訳生成 /
// AIアシストマッピング, but label-based lookup is self-documenting).
function switchFor(labelText: string): HTMLInputElement {
  const label = screen.getByText(labelText)
  const row = label.parentElement?.parentElement
  return within(row as HTMLElement).getByRole('switch') as HTMLInputElement
}

function fillName(name: string) {
  fireEvent.change(nameInput(), { target: { value: name } })
}
function fillPeriod(start: string, end: string) {
  fireEvent.change(screen.getByLabelText('期間開始日 *'), { target: { value: start } })
  fireEvent.change(screen.getByLabelText('期間終了日 *'), { target: { value: end } })
}
function selectStandard(value: string) {
  fireEvent.change(screen.getByTestId('standard-select'), { target: { value } })
}
function selectCoa(value: string) {
  fireEvent.change(screen.getByTestId('coa-select'), { target: { value } })
}

// Advance the wizard deterministically to the requested 0-based step index by
// filling each gate's required inputs and clicking Next.
function goToStep(targetStep: number) {
  if (targetStep >= 1) {
    fillName('テストプロジェクト')
    fireEvent.click(nextBtn())
  }
  if (targetStep >= 2) {
    fillPeriod('2024-01-01', '2024-12-31')
    fireEvent.click(nextBtn())
  }
  if (targetStep >= 3) {
    selectStandard('USGAAP')
    selectCoa('coa-us-1')
    fireEvent.click(nextBtn())
  }
  if (targetStep >= 4) {
    fireEvent.click(nextBtn())
  }
}

describe('ProjectWizard — initial render & structure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the stepper with every step label', () => {
    renderWizard()
    // The current step label also appears as the CardTitle, so it is not unique.
    expect(screen.getAllByText('基本情報').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('期間設定')).toBeInTheDocument()
    expect(screen.getByText('ターゲット設定')).toBeInTheDocument()
    expect(screen.getByText('オプション')).toBeInTheDocument()
    expect(screen.getByText('確認')).toBeInTheDocument()
  })

  it('starts on step 1 of 5 with the basic-info card title', () => {
    renderWizard()
    expect(screen.getAllByText('基本情報').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('ステップ 1 / 5')).toBeInTheDocument()
  })

  it('renders the name and description inputs on the first step', () => {
    renderWizard()
    expect(nameInput()).toBeInTheDocument()
    expect(descInput()).toBeInTheDocument()
  })

  it('does not use companyId in any visible output (prop is reserved for future wiring)', () => {
    const { container } = renderWizard()
    expect(container.textContent).not.toContain('comp-1')
  })
})

describe('ProjectWizard — step 0 validation gate (name)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('disables the Next button when the name is empty', () => {
    renderWizard()
    expect(nextBtn()).toBeDisabled()
  })

  it('disables the Next button when the name is only whitespace', () => {
    renderWizard()
    fillName('   ')
    expect(nextBtn()).toBeDisabled()
  })

  it('enables the Next button once a non-empty name is entered', () => {
    renderWizard()
    fillName('2024 IFRS変換')
    expect(nextBtn()).toBeEnabled()
  })

  it('keeps the name after navigating forward and back', () => {
    renderWizard()
    fillName('永続プロジェクト')
    fireEvent.click(nextBtn())
    expect(screen.getByText('ステップ 2 / 5')).toBeInTheDocument()
    fireEvent.click(backBtn())
    expect(screen.getByText('ステップ 1 / 5')).toBeInTheDocument()
    expect(nameInput()).toHaveValue('永続プロジェクト')
  })
})

describe('ProjectWizard — step 1 validation gate (period)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    renderWizard()
    fillName('p')
    fireEvent.click(nextBtn())
  })

  it('disables Next while both dates are empty', () => {
    expect(nextBtn()).toBeDisabled()
  })

  it('disables Next when only the start date is set', () => {
    fillPeriod('2024-01-01', '')
    expect(nextBtn()).toBeDisabled()
  })

  it('disables Next and shows the ordering error when start >= end', () => {
    fillPeriod('2024-12-31', '2024-01-01')
    expect(nextBtn()).toBeDisabled()
    expect(screen.getByText('期間開始日は期間終了日より前に設定してください')).toBeInTheDocument()
  })

  it('hides the ordering error and enables Next when start < end', () => {
    fillPeriod('2024-12-31', '2024-01-01')
    expect(screen.getByText('期間開始日は期間終了日より前に設定してください')).toBeInTheDocument()
    fillPeriod('2024-01-01', '2024-12-31')
    expect(
      screen.queryByText('期間開始日は期間終了日より前に設定してください')
    ).not.toBeInTheDocument()
    expect(nextBtn()).toBeEnabled()
  })

  it('accepts equal-length boundary dates as long as start precedes end', () => {
    fillPeriod('2024-01-01', '2024-01-02')
    expect(nextBtn()).toBeEnabled()
  })
})

describe('ProjectWizard — step 2 validation gate (standard + COA)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    renderWizard()
    fillName('p')
    fireEvent.click(nextBtn())
    fillPeriod('2024-01-01', '2024-12-31')
    fireEvent.click(nextBtn())
  })

  it('disables the COA select until a standard is chosen', () => {
    expect(screen.getByTestId('coa-select')).toBeDisabled()
    expect(screen.getByText('先に会計基準を選択')).toBeInTheDocument()
  })

  it('disables Next while the standard is unselected', () => {
    expect(nextBtn()).toBeDisabled()
  })

  it('still disables Next after selecting only the standard (COA missing)', () => {
    selectStandard('USGAAP')
    expect(screen.getByTestId('coa-select')).toBeEnabled()
    expect(screen.queryByText('先に会計基準を選択')).not.toBeInTheDocument()
    expect(nextBtn()).toBeDisabled()
  })

  it('filters the COA options by the selected standard', () => {
    selectStandard('IFRS')
    const coa = screen.getByTestId('coa-select') as HTMLSelectElement
    const values = [...coa.options].map((o) => o.value)
    expect(values).toContain('coa-ifrs-1')
    expect(values).not.toContain('coa-us-1')
    expect(values).not.toContain('coa-us-2')
  })

  it('enables Next once both standard and COA are chosen', () => {
    selectStandard('USGAAP')
    selectCoa('coa-us-2')
    expect(nextBtn()).toBeEnabled()
  })

  it('resets the COA selection when the standard changes', () => {
    selectStandard('USGAAP')
    selectCoa('coa-us-1')
    expect(screen.getByTestId('coa-select')).toHaveValue('coa-us-1')
    selectStandard('IFRS')
    expect(screen.getByTestId('coa-select')).toHaveValue('')
  })

  it('renders the empty-COA hint for a standard that has matching charts (hint hidden)', () => {
    selectStandard('IFRS')
    selectCoa('coa-ifrs-1')
    expect(
      screen.queryByText('選択した基準の勘定科目表がありません。先に勘定科目表を作成してください。')
    ).not.toBeInTheDocument()
  })
})

describe('ProjectWizard — step 2 COA list edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the empty-COA hint for a standard with zero matching charts', () => {
    renderWizard([
      { id: 'coa-us-1', name: 'US GAAP Chart A', standard: 'USGAAP' },
      { id: 'coa-us-2', name: 'US GAAP Chart B', standard: 'USGAAP' },
    ])
    goToStep(2)
    selectStandard('IFRS')
    expect(
      screen.getByText('選択した基準の勘定科目表がありません。先に勘定科目表を作成してください。')
    ).toBeInTheDocument()
  })

  it('renders an empty COA list gracefully (no options beyond the placeholder)', () => {
    renderWizard([])
    goToStep(2)
    selectStandard('USGAAP')
    const coa = screen.getByTestId('coa-select') as HTMLSelectElement
    // Only the placeholder option exists.
    expect([...coa.options].every((o) => o.value === '')).toBe(true)
  })
})

describe('ProjectWizard — step 3 option switches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    renderWizard()
    goToStep(3)
  })

  it('renders all four option switches defaulting to enabled', () => {
    const labels = ['仕訳変換', '財務諸表変換', '調整仕訳生成', 'AIアシストマッピング']
    labels.forEach((label) => {
      expect(switchFor(label)).toBeInTheDocument()
      expect((switchFor(label) as HTMLInputElement).checked).toBe(true)
    })
  })

  it('reflects a toggled switch in the confirm summary', () => {
    fireEvent.click(switchFor('仕訳変換'))
    fireEvent.click(switchFor('AIアシストマッピング'))
    fireEvent.click(nextBtn())
    expect(screen.getByText('仕訳変換: 無効')).toBeInTheDocument()
    expect(screen.getByText('AIマッピング: 無効')).toBeInTheDocument()
    expect(screen.getByText('財務諸表: 有効')).toBeInTheDocument()
    expect(screen.getByText('調整仕訳: 有効')).toBeInTheDocument()
  })

  it('reflects all switches disabled when every one is toggled off', () => {
    fireEvent.click(switchFor('仕訳変換'))
    fireEvent.click(switchFor('財務諸表変換'))
    fireEvent.click(switchFor('調整仕訳生成'))
    fireEvent.click(switchFor('AIアシストマッピング'))
    fireEvent.click(nextBtn())
    // Each option renders as "仕訳変換: 無効" etc., so match the suffix via regex.
    expect(screen.getAllByText(/無効$/)).toHaveLength(4)
  })

  it('keeps Next enabled on the options step regardless of switch state', () => {
    expect(nextBtn()).toBeEnabled()
    fireEvent.click(switchFor('仕訳変換'))
    expect(nextBtn()).toBeEnabled()
  })
})

describe('ProjectWizard — navigation (back / next boundaries)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    renderWizard()
  })

  it('disables the Back button on the first step', () => {
    expect(backBtn()).toBeDisabled()
  })

  it('does not advance past the last step (no Next button on confirm)', () => {
    goToStep(4)
    expect(screen.queryByRole('button', { name: '次へ' })).not.toBeInTheDocument()
    expect(createBtn()).toBeInTheDocument()
  })

  it('can navigate back from confirm to options and forward again', () => {
    goToStep(4)
    fireEvent.click(backBtn())
    expect(screen.getByText('ステップ 4 / 5')).toBeInTheDocument()
    fireEvent.click(nextBtn())
    expect(screen.getByText('ステップ 5 / 5')).toBeInTheDocument()
  })

  it('updates the card title and step counter as the user advances', () => {
    fillName('p')
    fireEvent.click(nextBtn())
    expect(screen.getByText('ステップ 2 / 5')).toBeInTheDocument()
    fillPeriod('2024-01-01', '2024-12-31')
    fireEvent.click(nextBtn())
    // 'ターゲット設定' now appears both in the stepper and as the CardTitle.
    expect(screen.getAllByText('ターゲット設定')).toHaveLength(2)
    expect(screen.getByText('ステップ 3 / 5')).toBeInTheDocument()
  })
})

describe('ProjectWizard — confirm summary (step 4)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mirrors the entered name, standard, period, description and the dash fallback', () => {
    renderWizard()
    fillName('2024 IFRSプロジェクト')
    fireEvent.change(descInput(), { target: { value: '決算対応' } })
    fireEvent.click(nextBtn())
    fillPeriod('2024-04-01', '2025-03-31')
    fireEvent.click(nextBtn())
    selectStandard('IFRS')
    selectCoa('coa-ifrs-1')
    fireEvent.click(nextBtn())
    fireEvent.click(nextBtn())
    expect(screen.getByText('2024 IFRSプロジェクト')).toBeInTheDocument()
    expect(screen.getByText('IFRS')).toBeInTheDocument()
    expect(screen.getByText('2024-04-01')).toBeInTheDocument()
    expect(screen.getByText('2025-03-31')).toBeInTheDocument()
    expect(screen.getByText('決算対応')).toBeInTheDocument()
  })

  it('renders the dash fallback when no description was entered', () => {
    renderWizard()
    goToStep(4)
    expect(screen.getByText('-')).toBeInTheDocument()
  })

  it('does not render the error box when there is no error', () => {
    renderWizard()
    goToStep(4)
    expect(screen.queryByText('Failed to create project')).not.toBeInTheDocument()
  })
})

describe('ProjectWizard — submit (create project)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs the assembled request body to the projects endpoint on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: 'proj-42' } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderWizard()
    fillName('送信プロジェクト')
    fireEvent.change(descInput(), { target: { value: '備考' } })
    fireEvent.click(nextBtn())
    fillPeriod('2024-01-01', '2024-12-31')
    fireEvent.click(nextBtn())
    selectStandard('USGAAP')
    selectCoa('coa-us-1')
    fireEvent.click(nextBtn())
    fireEvent.click(nextBtn())

    await act(async () => {
      fireEvent.click(createBtn())
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/conversion/projects')
    expect(init).toMatchObject({ method: 'POST' })
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      name: '送信プロジェクト',
      description: '備考',
      targetStandard: 'USGAAP',
      targetCoaId: 'coa-us-1',
      periodStart: '2024-01-01',
      periodEnd: '2024-12-31',
      settings: {
        includeJournals: true,
        includeFinancialStatements: true,
        generateAdjustingEntries: true,
        aiAssistedMapping: true,
      },
    })
    expect(pushMock).toHaveBeenCalledWith('/conversion/projects/proj-42')
  })

  it('omits description from the body when left blank', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: 'proj-1' } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderWizard()
    goToStep(4)
    await act(async () => {
      fireEvent.click(createBtn())
    })
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.description).toBeUndefined()
  })

  it('redirects to the created project id returned by the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: 'abc-123' } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderWizard()
    goToStep(4)
    await act(async () => {
      fireEvent.click(createBtn())
    })
    expect(pushMock).toHaveBeenCalledWith('/conversion/projects/abc-123')
  })

  it('shows a spinner and disables actions while submitting, then clears loading', async () => {
    let resolveResponse!: (v: { ok: boolean; json: () => Promise<unknown> }) => void
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((res) => {
        resolveResponse = res as typeof resolveResponse
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    renderWizard()
    goToStep(4)

    await act(async () => {
      fireEvent.click(createBtn())
    })

    // While the request is in-flight: spinner shown, button + back disabled.
    expect(document.querySelector('.animate-spin')).not.toBeNull()
    expect(createBtn()).toBeDisabled()
    expect(backBtn()).toBeDisabled()

    await act(async () => {
      resolveResponse({ ok: true, json: async () => ({ data: { id: 'proj-x' } }) })
    })

    // After resolution: loading cleared.
    expect(document.querySelector('.animate-spin')).toBeNull()
  })

  it('surfaces the API error message on a non-ok response and does not redirect', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: '期間が無効です' }),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderWizard()
    goToStep(4)
    await act(async () => {
      fireEvent.click(createBtn())
    })
    expect(screen.getByText('期間が無効です')).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
    // The button is usable again after the failure.
    expect(createBtn()).toBeEnabled()
  })

  it('falls back to the generic message when the API error body has no error field', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderWizard()
    goToStep(4)
    await act(async () => {
      fireEvent.click(createBtn())
    })
    expect(screen.getByText('Failed to create project')).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('degrades safely on a network failure: sets a safe error and keeps the button usable', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)
    renderWizard()
    goToStep(4)
    await act(async () => {
      fireEvent.click(createBtn())
    })
    expect(screen.getByText('network down')).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
    expect(createBtn()).toBeEnabled()
    expect(document.querySelector('.animate-spin')).toBeNull()
  })

  it('degrades safely on a non-Error rejection: shows the generic unknown-error message', async () => {
    const fetchMock = vi.fn().mockRejectedValue('something odd')
    vi.stubGlobal('fetch', fetchMock)
    renderWizard()
    goToStep(4)
    await act(async () => {
      fireEvent.click(createBtn())
    })
    expect(screen.getByText('Unknown error')).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('does not call fetch twice on a single create click', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { id: 'proj-1' } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    renderWizard()
    goToStep(4)
    await act(async () => {
      fireEvent.click(createBtn())
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('ProjectWizard — fail-safe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders without throwing for an empty chartOfAccounts list', () => {
    const { container } = renderWizard([])
    expect(container).toBeInTheDocument()
    expect(nextBtn()).toBeDisabled()
  })

  it('renders without throwing when no companyId is supplied', () => {
    const { container } = render(<ProjectWizard companyId="" chartOfAccounts={COAS} />)
    expect(container).toBeInTheDocument()
  })

  it('does not emit a spurious fetch on mount', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    renderWizard()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('never calls router.push before a successful submit', () => {
    renderWizard()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('blocks a second submit once the loading state has applied (button disabled)', async () => {
    let resolveResponse!: (v: { ok: boolean; json: () => Promise<unknown> }) => void
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((res) => {
        resolveResponse = res as typeof resolveResponse
      })
    )
    vi.stubGlobal('fetch', fetchMock)
    renderWizard()
    goToStep(4)

    // First click enters the in-flight state; act flushes setLoading(true).
    await act(async () => {
      fireEvent.click(createBtn())
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(createBtn()).toBeDisabled()

    // A second click while disabled is a no-op.
    await act(async () => {
      fireEvent.click(createBtn())
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveResponse({ ok: true, json: async () => ({ data: { id: 'p' } }) })
    })
  })
})
