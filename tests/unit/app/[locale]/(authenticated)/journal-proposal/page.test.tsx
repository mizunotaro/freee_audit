import { describe, it, expect, vi } from 'vitest'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), useParams: () => ({}), useSearchParams: () => ({ get: vi.fn() }) }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
describe('Page', () => {
  it('should render without crashing', async () => {
    const mod = await import('@/app/[locale]/(authenticated)/journal-proposal/page')
    expect(mod.default).toBeDefined()
  })
})
