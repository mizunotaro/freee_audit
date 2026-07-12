import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DashboardPage from '@/app/[locale]/(authenticated)/dashboard/page'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('DashboardPage', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders an explicit error state with a retry control when the fetch fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: '再試行' })).toBeInTheDocument()
  })

  it('retries the fetch when 再試行 is clicked', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    const user = userEvent.setup()
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: '再試行' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('marks the KPI region aria-busy and shows placeholders while loading', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    const { container } = render(<DashboardPage />)
    await waitFor(() => expect(container.querySelector('[aria-busy="true"]')).not.toBeNull())
    expect(screen.getAllByText('--').length).toBeGreaterThan(0)
  })

  it('renders the dashboard content after a successful fetch', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        company: {
          name: 'テスト株式会社',
          stage: '成長期',
          leadCompound: 'LC-1',
          developmentPhase: 'Phase 1',
        },
        kpis: {
          runway: 30,
          monthlyBurnRate: 1000000,
          cashBalance: 5000000,
          rdSpendYtd: 2000000,
          externalRdRatio: 0.5,
        },
        milestones: [],
      }),
    })
    render(<DashboardPage />)
    await waitFor(() => expect(screen.getByText('テスト株式会社')).toBeInTheDocument())
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
