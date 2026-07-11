import { describe, it, expect, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import {
  AuditTrailViewer,
  type AuditTrailEntry,
  type AuditTrailFilters,
  type PaginatedResult,
} from '@/components/conversion/audit-trail-viewer'
import type { AuditAction } from '@/types/conversion'

// The viewer renders a <SelectItem value=""> ("すべて" option), which
// @radix-ui/react-select refuses in jsdom. Replace the primitives with a native
// <select>/<option> that wires onValueChange so the component's filter wiring is
// exercised faithfully rather than stubbed out.
vi.mock('@/components/ui/select', () => {
  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    children?: ReactNode
  }) => (
    <select value={value} onChange={(e) => onValueChange?.(e.target.value)}>
      {children}
    </select>
  )
  const SelectContent = ({ children }: { children?: ReactNode }) => <>{children}</>
  const SelectItem = ({ value, children }: { value: string; children?: ReactNode }) => (
    <option value={value}>{children}</option>
  )
  const SelectTrigger = ({ children }: { children?: ReactNode }) => <>{children}</>
  const SelectValue = () => null
  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }
})

// Radix ScrollArea instantiates a ResizeObserver on mount; setup.ts does not
// provide one. It is a pure layout wrapper, so render its children directly.
vi.mock('@/components/ui/scroll-area', () => {
  const ScrollArea = ({ children, className }: { children?: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  )
  return { ScrollArea }
})

function makeEntry(overrides: Partial<AuditTrailEntry> = {}): AuditTrailEntry {
  return {
    id: 'e1',
    projectId: 'p1',
    action: 'project_create',
    entityType: 'project',
    entityId: 'ent-1',
    previousValue: undefined,
    newValue: undefined,
    changedFields: ['name', 'status'],
    userId: 'u1',
    userName: '山田 太郎',
    userRole: 'admin',
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    metadata: undefined,
    createdAt: new Date('2024-06-15T03:30:00.000Z'),
    ...overrides,
  }
}

function makePage(
  entries: AuditTrailEntry[] = [],
  pagination: Partial<PaginatedResult<AuditTrailEntry>['pagination']> = {}
): PaginatedResult<AuditTrailEntry> {
  return {
    data: entries,
    pagination: {
      page: 1,
      limit: 10,
      total: entries.length,
      totalPages: 1,
      ...pagination,
    },
  }
}

type Handlers = ReturnType<typeof makeHandlers>

function makeHandlers() {
  return {
    onFilterChange: vi.fn(),
    onPageChange: vi.fn(),
    onExport: vi.fn(),
    onRefresh: vi.fn(),
  }
}

function renderViewer(
  overrides: {
    entries?: PaginatedResult<AuditTrailEntry>
    filters?: AuditTrailFilters
    isLoading?: boolean
  } = {}
): { handlers: Handlers; container: HTMLElement } {
  const handlers = makeHandlers()
  const { container } = render(
    <AuditTrailViewer
      projectId="p1"
      entries={overrides.entries ?? makePage([makeEntry()])}
      filters={overrides.filters}
      onFilterChange={handlers.onFilterChange}
      onPageChange={handlers.onPageChange}
      onExport={handlers.onExport}
      onRefresh={handlers.onRefresh}
      isLoading={overrides.isLoading}
    />
  )
  return { handlers, container }
}

function openFilters(): void {
  fireEvent.click(screen.getByRole('button', { name: 'フィルタ' }))
}

function lastFilterArg(handlers: Handlers): AuditTrailFilters {
  const calls = handlers.onFilterChange.mock.calls
  return calls[calls.length - 1][0] as AuditTrailFilters
}

const normalize = (value: string | null | undefined): string =>
  (value ?? '').replace(/\s+/g, ' ').trim()

describe('AuditTrailViewer — rendering', () => {
  it('renders the title and the toolbar buttons', () => {
    renderViewer()

    expect(screen.getByText('監査証跡')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'フィルタ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '更新' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'CSV出力' })).toBeEnabled()
  })

  it('renders the action badge, entity label, actor, and changed fields for an entry', () => {
    renderViewer()

    expect(screen.getByText('プロジェクト作成')).toBeInTheDocument()
    expect(screen.getByText('プロジェクト')).toBeInTheDocument()
    expect(screen.getByText('ent-1')).toBeInTheDocument()
    expect(screen.getByText('山田 太郎')).toBeInTheDocument()
    expect(screen.getByText('(admin)')).toBeInTheDocument()
    expect(
      screen.getByText((_, el) => normalize(el?.textContent) === '変更フィールド: name, status')
    ).toBeInTheDocument()
  })

  it('omits the changed-fields line when changedFields is empty', () => {
    renderViewer({ entries: makePage([makeEntry({ changedFields: [] })]) })

    expect(
      screen.queryByText((_, el) => normalize(el?.textContent)?.includes('変更フィールド'))
    ).not.toBeInTheDocument()
  })

  it('omits the changed-fields line when changedFields is absent', () => {
    renderViewer({ entries: makePage([makeEntry({ changedFields: undefined })]) })

    expect(
      screen.queryByText((_, el) => normalize(el?.textContent)?.includes('変更フィールド'))
    ).not.toBeInTheDocument()
  })

  it('omits the entity id when entityId is absent', () => {
    renderViewer({ entries: makePage([makeEntry({ entityId: undefined })]) })

    expect(screen.queryByText('ent-1')).not.toBeInTheDocument()
  })

  it('falls back to the raw action string and outline badge for an unknown action', () => {
    renderViewer({
      entries: makePage([makeEntry({ action: 'mystery_action' as AuditAction })]),
    })

    const badge = screen.getByText('mystery_action')
    expect(badge).toBeInTheDocument()
  })

  it('falls back to the raw value for an unknown entity type', () => {
    renderViewer({
      entries: makePage([makeEntry({ entityType: 'custom_entity', entityId: undefined })]),
    })

    expect(screen.getByText('custom_entity')).toBeInTheDocument()
  })

  it('renders the empty-state message when there are no entries', () => {
    renderViewer({ entries: makePage([]) })

    expect(screen.getByText('監査ログがありません')).toBeInTheDocument()
  })
})

describe('AuditTrailViewer — filters panel', () => {
  it('is hidden by default and toggles open then closed', () => {
    renderViewer()

    expect(screen.queryByRole('button', { name: '適用' })).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('ユーザーID')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'フィルタ' }))
    expect(screen.getByRole('button', { name: '適用' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'リセット' })).toBeInTheDocument()
    expect(screen.getByPlaceholderText('ユーザーID')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'フィルタ' }))
    expect(screen.queryByRole('button', { name: '適用' })).not.toBeInTheDocument()
  })

  it('propagates the userId filter when 適用 is pressed', () => {
    const { handlers } = renderViewer()
    openFilters()

    fireEvent.change(screen.getByPlaceholderText('ユーザーID'), {
      target: { value: 'user-42' },
    })
    fireEvent.click(screen.getByRole('button', { name: '適用' }))

    expect(handlers.onFilterChange).toHaveBeenCalledTimes(1)
    expect(lastFilterArg(handlers).userId).toBe('user-42')
  })

  it('propagates the action selected in the action combobox', () => {
    const { handlers, container } = renderViewer()
    openFilters()

    const actionSelect = container.querySelectorAll('select')[0]
    fireEvent.change(actionSelect, { target: { value: 'project_execute' } })
    fireEvent.click(screen.getByRole('button', { name: '適用' }))

    expect(lastFilterArg(handlers).action).toBe('project_execute')
  })

  it('propagates the entity type selected in the entity-type combobox', () => {
    const { handlers, container } = renderViewer()
    openFilters()

    const entityTypeSelect = container.querySelectorAll('select')[1]
    fireEvent.change(entityTypeSelect, { target: { value: 'mapping' } })
    fireEvent.click(screen.getByRole('button', { name: '適用' }))

    expect(lastFilterArg(handlers).entityType).toBe('mapping')
  })

  it('clears the action filter when すべて is reselected', () => {
    const { handlers, container } = renderViewer()
    openFilters()

    const actionSelect = container.querySelectorAll('select')[0]
    fireEvent.change(actionSelect, { target: { value: 'project_execute' } })
    fireEvent.change(actionSelect, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: '適用' }))

    expect(lastFilterArg(handlers).action).toBeUndefined()
  })

  it('reset clears local filters and propagates an empty filter object', () => {
    const { handlers } = renderViewer()
    openFilters()

    const userInput = screen.getByPlaceholderText('ユーザーID') as HTMLInputElement
    fireEvent.change(userInput, { target: { value: 'abc' } })
    fireEvent.click(screen.getByRole('button', { name: '適用' }))
    expect(lastFilterArg(handlers)).toEqual({ userId: 'abc' })

    fireEvent.click(screen.getByRole('button', { name: 'リセット' }))
    expect(lastFilterArg(handlers)).toEqual({})
    expect(userInput.value).toBe('')

    fireEvent.click(screen.getByRole('button', { name: '適用' }))
    expect(lastFilterArg(handlers)).toEqual({})
  })
})

describe('AuditTrailViewer — toolbar actions', () => {
  it('invokes onExport with csv when CSV出力 is pressed', () => {
    const { handlers } = renderViewer()

    fireEvent.click(screen.getByRole('button', { name: 'CSV出力' }))

    expect(handlers.onExport).toHaveBeenCalledTimes(1)
    expect(handlers.onExport).toHaveBeenCalledWith('csv')
  })

  it('invokes onRefresh when 更新 is pressed', () => {
    const { handlers } = renderViewer()

    fireEvent.click(screen.getByRole('button', { name: '更新' }))

    expect(handlers.onRefresh).toHaveBeenCalledTimes(1)
  })
})

describe('AuditTrailViewer — pagination', () => {
  it('hides pagination when totalPages is 1 or less', () => {
    renderViewer({ entries: makePage([makeEntry()], { page: 1, total: 1, totalPages: 1 }) })

    expect(screen.queryByRole('button', { name: '前へ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '次へ' })).not.toBeInTheDocument()
  })

  it('shows the range summary and page indicator when there are multiple pages', () => {
    renderViewer({
      entries: makePage([makeEntry(), makeEntry({ id: 'e2' })], {
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
      }),
    })

    expect(
      screen.getByText((_, el) => normalize(el?.textContent) === '全 25 件中 11 - 20 件')
    ).toBeInTheDocument()
    expect(screen.getByText((_, el) => normalize(el?.textContent) === '2 / 3')).toBeInTheDocument()
  })

  it('calls onPageChange with adjacent page numbers', () => {
    const { handlers } = renderViewer({
      entries: makePage([makeEntry()], { page: 2, limit: 10, total: 25, totalPages: 3 }),
    })

    fireEvent.click(screen.getByRole('button', { name: '前へ' }))
    expect(handlers.onPageChange).toHaveBeenLastCalledWith(1)

    fireEvent.click(screen.getByRole('button', { name: '次へ' }))
    expect(handlers.onPageChange).toHaveBeenLastCalledWith(3)
  })

  it('disables 前へ on the first page', () => {
    renderViewer({
      entries: makePage([makeEntry()], { page: 1, limit: 10, total: 25, totalPages: 3 }),
    })

    expect(screen.getByRole('button', { name: '前へ' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '次へ' })).toBeEnabled()
  })

  it('disables 次へ on the last page', () => {
    renderViewer({
      entries: makePage([makeEntry()], { page: 3, limit: 10, total: 25, totalPages: 3 }),
    })

    expect(screen.getByRole('button', { name: '前へ' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled()
  })
})

describe('AuditTrailViewer — loading state', () => {
  it('disables 更新 and CSV出力 and spins the refresh icon while loading', () => {
    renderViewer({ isLoading: true })

    const refreshButton = screen.getByRole('button', { name: '更新' })
    expect(refreshButton).toBeDisabled()
    expect(screen.getByRole('button', { name: 'CSV出力' })).toBeDisabled()

    const refreshIcon = refreshButton.querySelector('svg')
    expect(refreshIcon?.classList.contains('animate-spin')).toBe(true)
  })

  it('does not spin the refresh icon when not loading', () => {
    renderViewer({ isLoading: false })

    const refreshIcon = screen.getByRole('button', { name: '更新' }).querySelector('svg')
    expect(refreshIcon?.classList.contains('animate-spin')).toBe(false)
  })

  it('disables the pagination buttons while loading', () => {
    renderViewer({
      entries: makePage([makeEntry()], { page: 2, limit: 10, total: 25, totalPages: 3 }),
      isLoading: true,
    })

    expect(screen.getByRole('button', { name: '前へ' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '次へ' })).toBeDisabled()
  })
})
