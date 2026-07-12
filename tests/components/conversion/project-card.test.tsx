import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProjectCard } from '@/components/conversion/project-card'
import type { ConversionProject, ConversionStatus } from '@/types/conversion'

// Local-noon dates keep the calendar day stable across host timezones, since
// toLocaleDateString renders the local-calendar date and a UTC-midnight date
// would otherwise roll back a day on machines behind UTC.
const PERIOD_START = new Date(2026, 0, 15, 12, 0, 0)
const PERIOD_END = new Date(2026, 11, 31, 12, 0, 0)

const fmt = (d: Date) => new Date(d).toLocaleDateString('ja-JP')

function makeProject(overrides: Partial<ConversionProject> = {}): ConversionProject {
  return {
    id: 'proj-1',
    companyId: 'company-1',
    name: '決算変換プロジェクト',
    sourceStandard: 'JGAAP',
    targetStandard: 'IFRS',
    targetCoaId: 'coa-1',
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    status: 'draft',
    progress: 0,
    settings: {
      includeJournals: true,
      includeFinancialStatements: true,
      generateAdjustingEntries: true,
      aiAssistedMapping: true,
    },
    createdBy: 'user-1',
    createdAt: PERIOD_START,
    updatedAt: PERIOD_START,
    ...overrides,
  }
}

describe('conversion/project-card', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('header', () => {
    it('renders the project name as the card title', () => {
      render(<ProjectCard project={makeProject({ name: 'IFRS移行 2026' })} />)
      expect(screen.getByText('IFRS移行 2026')).toBeInTheDocument()
    })

    it.each([
      ['IFRS', 'IFRSへの変換'],
      ['USGAAP', 'USGAAPへの変換'],
    ] as const)(
      'renders the conversion description for targetStandard=%s',
      (targetStandard, expected) => {
        render(<ProjectCard project={makeProject({ targetStandard })} />)
        expect(screen.getByText(expected)).toBeInTheDocument()
      }
    )
  })

  describe('period formatting', () => {
    it('renders the period start and end joined with " - " using ja-JP formatting', () => {
      render(<ProjectCard project={makeProject()} />)
      expect(screen.getByText(`${fmt(PERIOD_START)} - ${fmt(PERIOD_END)}`)).toBeInTheDocument()
    })

    it('renders both dates when the period is inverted (end before start)', () => {
      render(
        <ProjectCard project={makeProject({ periodStart: PERIOD_END, periodEnd: PERIOD_START })} />
      )
      expect(screen.getByText(`${fmt(PERIOD_END)} - ${fmt(PERIOD_START)}`)).toBeInTheDocument()
    })
  })

  describe('status badge delegation', () => {
    it.each([
      ['draft', '下書き'],
      ['mapping', 'マッピング中'],
      ['validating', '検証中'],
      ['converting', '変換中'],
      ['reviewing', 'レビュー中'],
      ['completed', '完了'],
      ['error', 'エラー'],
    ] as const)('renders the %s status label via StatusBadge', (status, label) => {
      render(<ProjectCard project={makeProject({ status: status as ConversionStatus })} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  describe('progress section (status === "converting")', () => {
    it('shows the rounded percentage, the progressbar role, and forwards value to the indicator transform', () => {
      const { container } = render(
        <ProjectCard project={makeProject({ status: 'converting', progress: 42 })} />
      )
      expect(screen.getByText('42%')).toBeInTheDocument()

      const bar = screen.getByRole('progressbar')
      expect(bar).toHaveAttribute('aria-valuemin', '0')
      expect(bar).toHaveAttribute('aria-valuemax', '100')
      // shadcn Progress forwards `value` only to the indicator transform, not to
      // aria-valuenow (which stays indeterminate), so the transform is the
      // deterministic reflection of the value being passed through.
      const indicator = container.querySelector('[style*="translateX"]') as HTMLElement
      expect(indicator).not.toBeNull()
      expect(indicator.style.transform).toBe('translateX(-58%)')
    })

    it.each([
      [0, '0%'],
      [42.4, '42%'],
      [42.5, '43%'],
      [50, '50%'],
      [99.5, '100%'],
      [100, '100%'],
    ])('rounds progress=%f to %s (Math.round boundary)', (progress, expected) => {
      render(<ProjectCard project={makeProject({ status: 'converting', progress })} />)
      expect(screen.getByText(expected)).toBeInTheDocument()
    })

    it('does not render the progress section for a non-converting status even when progress > 0', () => {
      render(<ProjectCard project={makeProject({ status: 'completed', progress: 100 })} />)
      expect(screen.queryByText(/^\d+%$/)).not.toBeInTheDocument()
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    it('renders without crashing for out-of-range progress (no internal clamping; fail-safe)', () => {
      render(<ProjectCard project={makeProject({ status: 'converting', progress: 150 })} />)
      // Documents current behavior: the percentage is rendered as-is with no clamp.
      // The progress bar indicator itself overflows in this state (the underlying
      // snippet computes `translateX(-${100 - value}%)`, i.e. `translateX(--50%)`,
      // an invalid value), so the only deterministic, observable contract here is
      // that the card does not crash and shows the raw rounded percentage.
      expect(screen.getByText('150%')).toBeInTheDocument()
    })
  })

  describe('statistics section', () => {
    it('renders mappedAccounts, totalJournals and adjustingEntryCount with their labels', () => {
      render(
        <ProjectCard
          project={makeProject({
            statistics: {
              totalAccounts: 200,
              mappedAccounts: 150,
              reviewRequiredCount: 5,
              totalJournals: 1000,
              convertedJournals: 900,
              adjustingEntryCount: 7,
              averageConfidence: 0.92,
            },
          })}
        />
      )
      expect(screen.getByText('150')).toBeInTheDocument()
      expect(screen.getByText('1000')).toBeInTheDocument()
      expect(screen.getByText('7')).toBeInTheDocument()
      expect(screen.getByText('マッピング')).toBeInTheDocument()
      expect(screen.getByText('仕訳')).toBeInTheDocument()
      expect(screen.getByText('調整')).toBeInTheDocument()
    })

    it('omits the statistics grid when statistics is absent', () => {
      render(<ProjectCard project={makeProject({ statistics: undefined })} />)
      expect(screen.queryByText('マッピング')).not.toBeInTheDocument()
      expect(screen.queryByText('仕訳')).not.toBeInTheDocument()
      expect(screen.queryByText('調整')).not.toBeInTheDocument()
    })

    it('renders zero-valued statistics (boundary: falsy numbers still display)', () => {
      render(
        <ProjectCard
          project={makeProject({
            statistics: {
              totalAccounts: 0,
              mappedAccounts: 0,
              reviewRequiredCount: 0,
              totalJournals: 0,
              convertedJournals: 0,
              adjustingEntryCount: 0,
              averageConfidence: 0,
            },
          })}
        />
      )
      // One "0" cell per displayed statistic (mappedAccounts / totalJournals / adjustingEntryCount).
      expect(screen.getAllByText('0')).toHaveLength(3)
      expect(screen.getByText('マッピング')).toBeInTheDocument()
      expect(screen.getByText('仕訳')).toBeInTheDocument()
      expect(screen.getByText('調整')).toBeInTheDocument()
    })
  })

  describe('detail link', () => {
    it('links to the project detail page using project.id', () => {
      render(<ProjectCard project={makeProject({ id: 'proj-42' })} />)
      const link = screen.getByRole('link', { name: '詳細を見る' })
      expect(link).toHaveAttribute('href', '/conversion/projects/proj-42')
    })

    it('renders the detail button label', () => {
      render(<ProjectCard project={makeProject()} />)
      expect(screen.getByRole('link', { name: '詳細を見る' })).toBeInTheDocument()
    })
  })
})
