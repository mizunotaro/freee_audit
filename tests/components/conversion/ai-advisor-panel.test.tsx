import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { AIAdvisorPanel } from '@/components/conversion/ai-advisor-panel'
import type {
  MappingSuggestion,
  AdjustmentRecommendation,
  RiskAssessment,
} from '@/types/conversion'

// Radix ScrollArea (rendered while not loading) instantiates a ResizeObserver
// in a layout effect; jsdom does not provide one, so we supply a no-op shim.
beforeAll(() => {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    configurable: true,
    value: MockResizeObserver,
  })
})

function makeSuggestion(overrides: Partial<MappingSuggestion> = {}): MappingSuggestion {
  return {
    sourceAccountCode: '1000',
    sourceAccountName: '現金',
    suggestedTargetCode: '1010',
    suggestedTargetName: 'Cash and Cash Equivalents',
    confidence: 0.92,
    reasoning: '流動性の高い資産のため',
    alternatives: [],
    ...overrides,
  }
}

function makeAdjustment(
  overrides: Partial<AdjustmentRecommendation> = {}
): AdjustmentRecommendation {
  return {
    type: 'revenue_recognition',
    priority: 'high',
    title: '収益認識の調整',
    description: '出荷基準から引渡基準へ変更',
    estimatedImpact: { netIncomeChange: 500 },
    reasoning: 'IFRS第15号への準拠',
    references: ['IFRS 15'],
    ...overrides,
  }
}

function makeRisk(overrides: Partial<RiskAssessment> = {}): RiskAssessment {
  return {
    category: '収益認識',
    riskLevel: 'high',
    description: '収益認識基準の相違',
    mitigationSuggestion: '開示注記を追加',
    ...overrides,
  }
}

describe('conversion/ai-advisor-panel — loading state', () => {
  it('renders three skeletons and hides the section content while loading', () => {
    const { container } = render(<AIAdvisorPanel projectId="p1" isLoading />)

    expect(container.querySelectorAll('.animate-pulse').length).toBe(3)
    expect(screen.queryByRole('button', { name: /マッピング推奨/ })).not.toBeInTheDocument()
    expect(screen.queryByText('AI アドバイザー')).toBeInTheDocument()
  })

  it('prefers the loading skeleton over populated lists', () => {
    const { container } = render(
      <AIAdvisorPanel
        projectId="p1"
        isLoading
        mappingSuggestions={[makeSuggestion()]}
        adjustmentRecommendations={[makeAdjustment()]}
        riskAssessments={[makeRisk()]}
      />
    )

    expect(container.querySelectorAll('.animate-pulse').length).toBe(3)
    expect(screen.queryByText('現金')).not.toBeInTheDocument()
  })
})

describe('conversion/ai-advisor-panel — empty state & fail-safe', () => {
  it('renders the empty-state copy and zero counts when no data is supplied', () => {
    render(<AIAdvisorPanel projectId="p1" />)

    expect(screen.getAllByText('推奨はありません').length).toBe(2)
    expect(screen.getByText('リスクは検出されませんでした')).toBeInTheDocument()

    const mappingTrigger = screen.getByRole('button', { name: /マッピング推奨/ })
    const adjustmentTrigger = screen.getByRole('button', { name: /調整仕訳推奨/ })
    const riskTrigger = screen.getByRole('button', { name: /リスク評価/ })
    expect(within(mappingTrigger).getByText('0')).toBeInTheDocument()
    expect(within(adjustmentTrigger).getByText('0')).toBeInTheDocument()
    expect(within(riskTrigger).getByText('0')).toBeInTheDocument()
  })

  it('does not throw when accept/reject callbacks are not provided (fail-safe)', () => {
    const suggestion = makeSuggestion()
    render(<AIAdvisorPanel projectId="p1" mappingSuggestions={[suggestion]} />)

    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: '採用' }))
      fireEvent.click(screen.getByRole('button', { name: '却下' }))
    }).not.toThrow()
  })

  it('does not throw when the adjustment accept callback is not provided (fail-safe)', () => {
    render(<AIAdvisorPanel projectId="p1" adjustmentRecommendations={[makeAdjustment()]} />)

    expect(() => fireEvent.click(screen.getByRole('button', { name: '調整を追加' }))).not.toThrow()
  })
})

describe('conversion/ai-advisor-panel — MappingSuggestionCard', () => {
  it('renders source/target codes & names and the reasoning', () => {
    const suggestion = makeSuggestion({ reasoning: '現金は流動資産に該当する' })
    render(<AIAdvisorPanel projectId="p1" mappingSuggestions={[suggestion]} />)

    expect(screen.getByText('1000')).toBeInTheDocument()
    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.getByText('1010')).toBeInTheDocument()
    expect(screen.getByText('Cash and Cash Equivalents')).toBeInTheDocument()
    expect(screen.getByText('現金は流動資産に該当する')).toBeInTheDocument()
  })

  it.each([
    { confidence: 1.0, percent: '100%', token: 'bg-primary' },
    { confidence: 0.9, percent: '90%', token: 'bg-primary' },
    { confidence: 0.89, percent: '89%', token: 'bg-secondary' },
    { confidence: 0.7, percent: '70%', token: 'bg-secondary' },
    { confidence: 0.69, percent: '69%', token: 'text-foreground' },
    { confidence: 0, percent: '0%', token: 'text-foreground' },
  ])(
    'applies the correct badge variant for confidence $confidence ($percent)',
    ({ confidence, percent, token }) => {
      render(
        <AIAdvisorPanel projectId="p1" mappingSuggestions={[makeSuggestion({ confidence })]} />
      )

      const confidenceBadge = screen.getByText(percent)
      expect(confidenceBadge.className).toMatch(new RegExp(token))
    }
  )

  it('renders the alternatives block when alternatives are present', () => {
    const suggestion = makeSuggestion({
      alternatives: [
        { code: '1020', name: 'Petty Cash', confidence: 0.65 },
        { code: '1030', name: 'Bank Deposits', confidence: 0.4 },
      ],
    })
    render(<AIAdvisorPanel projectId="p1" mappingSuggestions={[suggestion]} />)

    expect(screen.getByText('代替案:')).toBeInTheDocument()
    expect(screen.getByText(/1020/)).toBeInTheDocument()
    expect(screen.getByText(/65%/)).toBeInTheDocument()
    expect(screen.getByText(/1030/)).toBeInTheDocument()
    expect(screen.getByText(/40%/)).toBeInTheDocument()
  })

  it('omits the alternatives block when alternatives is empty', () => {
    render(<AIAdvisorPanel projectId="p1" mappingSuggestions={[makeSuggestion()]} />)

    expect(screen.queryByText('代替案:')).not.toBeInTheDocument()
  })

  it('fires onAcceptMappingSuggestion with the suggestion when 採用 is clicked', () => {
    const onAccept = vi.fn()
    const suggestion = makeSuggestion()
    render(
      <AIAdvisorPanel
        projectId="p1"
        mappingSuggestions={[suggestion]}
        onAcceptMappingSuggestion={onAccept}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '採用' }))

    expect(onAccept).toHaveBeenCalledOnce()
    expect(onAccept).toHaveBeenCalledWith(suggestion)
  })

  it('fires onRejectMappingSuggestion with the suggestion when 却下 is clicked', () => {
    const onReject = vi.fn()
    const suggestion = makeSuggestion()
    render(
      <AIAdvisorPanel
        projectId="p1"
        mappingSuggestions={[suggestion]}
        onRejectMappingSuggestion={onReject}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '却下' }))

    expect(onReject).toHaveBeenCalledOnce()
    expect(onReject).toHaveBeenCalledWith(suggestion)
  })

  it('renders one card per suggestion and keeps each card scoped to its own data', () => {
    render(
      <AIAdvisorPanel
        projectId="p1"
        mappingSuggestions={[
          makeSuggestion({ sourceAccountName: '現金', suggestedTargetName: 'Cash' }),
          makeSuggestion({ sourceAccountName: '当座預金', suggestedTargetName: 'Current Account' }),
        ]}
      />
    )

    expect(screen.getByText('現金')).toBeInTheDocument()
    expect(screen.getByText('当座預金')).toBeInTheDocument()
    expect(screen.getByText('Cash')).toBeInTheDocument()
    expect(screen.getByText('Current Account')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '採用' }).length).toBe(2)
  })
})

describe('conversion/ai-advisor-panel — AdjustmentCard', () => {
  it.each([
    { priority: 'high' as const, label: '高優先度' },
    { priority: 'medium' as const, label: '中優先度' },
    { priority: 'low' as const, label: '低優先度' },
  ])('renders the $priority priority label', ({ priority, label }) => {
    render(
      <AIAdvisorPanel projectId="p1" adjustmentRecommendations={[makeAdjustment({ priority })]} />
    )

    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('renders the title, description and reasoning', () => {
    const adjustment = makeAdjustment({
      title: 'リース分類の調整',
      description: '所有権移転リースの識別',
      reasoning: 'IFRS第16号の要件',
    })
    render(<AIAdvisorPanel projectId="p1" adjustmentRecommendations={[adjustment]} />)

    expect(screen.getByText('リース分類の調整')).toBeInTheDocument()
    expect(screen.getByText('所有権移転リースの識別')).toBeInTheDocument()
    expect(screen.getByText('IFRS第16号の要件')).toBeInTheDocument()
  })

  it('renders estimated impact with sign prefix for asset and net income changes', () => {
    // Values kept under 1000 so toLocaleString() output is locale-independent.
    const adjustment = makeAdjustment({
      estimatedImpact: { assetChange: 500, netIncomeChange: -250 },
    })
    render(<AIAdvisorPanel projectId="p1" adjustmentRecommendations={[adjustment]} />)

    expect(screen.getByText('資産変動:')).toBeInTheDocument()
    expect(screen.getByText('+500')).toBeInTheDocument()
    expect(screen.getByText('純利益変動:')).toBeInTheDocument()
    expect(screen.getByText('-250')).toBeInTheDocument()
  })

  it('renders a zero impact change with a plus sign', () => {
    const adjustment = makeAdjustment({ estimatedImpact: { assetChange: 0 } })
    render(<AIAdvisorPanel projectId="p1" adjustmentRecommendations={[adjustment]} />)

    expect(screen.getByText('+0')).toBeInTheDocument()
  })

  it('omits the impact grid when estimatedImpact is absent', () => {
    // The component guards on truthy estimatedImpact; the type marks it
    // required, so we cast to exercise the runtime-falsy branch.
    const adjustment = {
      ...makeAdjustment(),
      estimatedImpact: undefined,
    } as unknown as AdjustmentRecommendation
    render(<AIAdvisorPanel projectId="p1" adjustmentRecommendations={[adjustment]} />)

    expect(screen.queryByText('資産変動:')).not.toBeInTheDocument()
    expect(screen.queryByText('純利益変動:')).not.toBeInTheDocument()
  })

  it('omits asset/netIncome rows when only other impact fields are set', () => {
    const adjustment = makeAdjustment({
      estimatedImpact: { liabilityChange: 100, equityChange: 50 },
    })
    render(<AIAdvisorPanel projectId="p1" adjustmentRecommendations={[adjustment]} />)

    expect(screen.queryByText('資産変動:')).not.toBeInTheDocument()
    expect(screen.queryByText('純利益変動:')).not.toBeInTheDocument()
  })

  it('renders references joined by comma when present', () => {
    const adjustment = makeAdjustment({ references: ['IFRS 15', 'ASBJ 実務指針'] })
    render(<AIAdvisorPanel projectId="p1" adjustmentRecommendations={[adjustment]} />)

    expect(screen.getByText(/参照:/)).toHaveTextContent('参照: IFRS 15, ASBJ 実務指針')
  })

  it('omits the references line when references is empty', () => {
    const adjustment = makeAdjustment({ references: [] })
    render(<AIAdvisorPanel projectId="p1" adjustmentRecommendations={[adjustment]} />)

    expect(screen.queryByText(/参照:/)).not.toBeInTheDocument()
  })

  it('fires onAcceptAdjustment with the adjustment when 調整を追加 is clicked', () => {
    const onAccept = vi.fn()
    const adjustment = makeAdjustment()
    render(
      <AIAdvisorPanel
        projectId="p1"
        adjustmentRecommendations={[adjustment]}
        onAcceptAdjustment={onAccept}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '調整を追加' }))

    expect(onAccept).toHaveBeenCalledOnce()
    expect(onAccept).toHaveBeenCalledWith(adjustment)
  })
})

describe('conversion/ai-advisor-panel — RiskCard', () => {
  it.each([
    { riskLevel: 'low' as const, label: '低リスク' },
    { riskLevel: 'medium' as const, label: '中リスク' },
    { riskLevel: 'high' as const, label: '高リスク' },
  ])('renders the $riskLevel risk label', ({ riskLevel, label }) => {
    render(<AIAdvisorPanel projectId="p1" riskAssessments={[makeRisk({ riskLevel })]} />)

    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('renders the category, description and mitigation suggestion', () => {
    const risk = makeRisk({
      category: 'リース取引',
      description: 'リース取引の分類リスク',
      mitigationSuggestion: '契約条項の開示',
    })
    render(<AIAdvisorPanel projectId="p1" riskAssessments={[risk]} />)

    expect(screen.getByText('リース取引')).toBeInTheDocument()
    expect(screen.getByText('リース取引の分類リスク')).toBeInTheDocument()
    expect(screen.getByText('契約条項の開示')).toBeInTheDocument()
  })

  it('renders one card per risk', () => {
    render(
      <AIAdvisorPanel
        projectId="p1"
        riskAssessments={[makeRisk({ category: '収益認識' }), makeRisk({ category: '在庫評価' })]}
      />
    )

    expect(screen.getAllByText('収益認識').length).toBeGreaterThan(0)
    expect(screen.getByText('在庫評価')).toBeInTheDocument()
  })
})

describe('conversion/ai-advisor-panel — collapsible sections', () => {
  it('renders all sections expanded by default', () => {
    render(
      <AIAdvisorPanel
        projectId="p1"
        mappingSuggestions={[makeSuggestion()]}
        adjustmentRecommendations={[makeAdjustment()]}
        riskAssessments={[makeRisk()]}
      />
    )

    expect(screen.getByRole('button', { name: /マッピング推奨/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(screen.getByRole('button', { name: /調整仕訳推奨/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(screen.getByRole('button', { name: /リスク評価/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
  })

  it('collapses and re-expands a single section without affecting the others', () => {
    render(
      <AIAdvisorPanel
        projectId="p1"
        mappingSuggestions={[makeSuggestion()]}
        adjustmentRecommendations={[makeAdjustment()]}
      />
    )

    const mappingTrigger = screen.getByRole('button', { name: /マッピング推奨/ })
    const adjustmentTrigger = screen.getByRole('button', { name: /調整仕訳推奨/ })

    fireEvent.click(mappingTrigger)
    expect(mappingTrigger).toHaveAttribute('aria-expanded', 'false')
    expect(adjustmentTrigger).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(mappingTrigger)
    expect(mappingTrigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('reflects list length in each section header count', () => {
    render(
      <AIAdvisorPanel
        projectId="p1"
        mappingSuggestions={[makeSuggestion(), makeSuggestion()]}
        adjustmentRecommendations={[makeAdjustment()]}
        riskAssessments={[makeRisk(), makeRisk(), makeRisk()]}
      />
    )

    expect(
      within(screen.getByRole('button', { name: /マッピング推奨/ })).getByText('2')
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('button', { name: /調整仕訳推奨/ })).getByText('1')
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('button', { name: /リスク評価/ })).getByText('3')
    ).toBeInTheDocument()
  })
})
