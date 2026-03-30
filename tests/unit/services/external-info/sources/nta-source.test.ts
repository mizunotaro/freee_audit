import { NtaInfoSource, NTA_CONFIG } from '@/services/external-info/sources/nta-source'

describe('NtaInfoSource', () => {
  it('has correct sourceId', () => {
    const source = new NtaInfoSource()
    expect(source.sourceId).toBe('nta')
  })

  it('has correct displayName', () => {
    const source = new NtaInfoSource()
    expect(source.displayName).toBe('国税庁')
  })

  it('returns disabled result when disabled', async () => {
    const source = new NtaInfoSource({ enabled: false })
    const result = await source.fetch({ query: '税制改正' })
    expect(result.success).toBe(false)
    if (!result.success && result.error) {
      expect(result.error.code).toBe('source_disabled')
    }
  })

  it('returns error when scraping not implemented', async () => {
    const source = new NtaInfoSource()
    const result = await source.fetch({ query: '税制改正' })
    expect(result.success).toBe(false)
    if (!result.success && result.error) {
      expect(result.error.code).toBe('nta_fetch_error')
    }
  })

  it('uses default config', () => {
    const source = new NtaInfoSource()
    const config = source.getConfig()
    expect(config.id).toBe('nta')
    expect(config.timeoutMs).toBe(30000)
  })

  it('merges custom config', () => {
    const source = new NtaInfoSource({ timeoutMs: 60000 })
    const config = source.getConfig()
    expect(config.timeoutMs).toBe(60000)
  })

  it('starts with active health status', () => {
    const source = new NtaInfoSource()
    const health = source.getHealth()
    expect(health.status).toBe('active')
    expect(health.sourceId).toBe('nta')
  })

  describe('NTA_CONFIG', () => {
    it('has correct defaults', () => {
      expect(NTA_CONFIG.id).toBe('nta')
      expect(NTA_CONFIG.maxRetries).toBe(3)
      expect(NTA_CONFIG.cacheTtlMs).toBe(86400000)
    })
  })
})
