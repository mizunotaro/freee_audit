import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MappingList } from '@/components/conversion/mapping-list'
import type { AccountMapping } from '@/types/conversion'

function makeMapping(overrides: Partial<AccountMapping> = {}): AccountMapping {
  return {
    id: 'm1',
    sourceAccountId: 's1',
    sourceAccountCode: '1000',
    sourceAccountName: '現金',
    targetAccountId: 't1',
    targetAccountCode: '1010',
    targetAccountName: 'Cash',
    mappingType: '1to1',
    confidence: 0.92,
    isManualReview: false,
    ...overrides,
  }
}

const handlers = {
  onSelectionChange: vi.fn(),
  onApprove: vi.fn().mockResolvedValue(undefined),
  onDelete: vi.fn().mockResolvedValue(undefined),
}

describe('conversion/mapping-list — loading / error / empty states', () => {
  it('renders an accessible skeleton while loading', () => {
    const { container } = render(
      <MappingList mappings={[]} selectedIds={[]} isLoading {...handlers} />
    )

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelectorAll('.animate-pulse').length).toBe(4)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders the error message inside an alert', () => {
    render(
      <MappingList
        mappings={[]}
        selectedIds={[]}
        error="マッピングの取得に失敗しました"
        {...handlers}
      />
    )

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('マッピングの取得に失敗しました')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('renders the empty state with the preserved copy when there is no data', () => {
    render(<MappingList mappings={[]} selectedIds={[]} {...handlers} />)

    expect(screen.getByText('マッピングがありません')).toBeInTheDocument()
    expect(
      screen.getByText('AI推論を実行するか、手動でマッピングを作成してください')
    ).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('conversion/mapping-list — ready state', () => {
  it('renders the table and an aria-labelled actions trigger per row', () => {
    render(<MappingList mappings={[makeMapping()]} selectedIds={[]} {...handlers} />)

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '現金の操作' })).toBeInTheDocument()
  })

  it('prefers loading over a populated list', () => {
    const { container } = render(
      <MappingList mappings={[makeMapping()]} selectedIds={[]} isLoading {...handlers} />
    )

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('table')).toBeNull()
  })
})
