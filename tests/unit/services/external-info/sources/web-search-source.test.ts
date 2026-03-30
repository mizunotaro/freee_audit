import {
  WebSearchInfoSource,
  WEB_SEARCH_CONFIG,
} from '@/services/external-info/sources/web-search-source'

describe('WebSearchInfoSource', () => {
  it('has correct sourceId', () => {
    const source = new WebSearchInfoSource()
    expect(source.sourceId).toBe('web_search')
  })

  it('has correct displayName', () => {
    const source = new WebSearchInfoSource()
    expect(source.displayName).toBe('Web検索')
  })

  it('returns disabled result when disabled by default', async () => {
    const source = new WebSearchInfoSource()
    const result = await source.fetch({ query: 'test' })
    expect(result.success).toBe(false)
    if (!result.success && result.error) {
      expect(result.error.code).toBe('source_disabled')
    }
  })

  it('returns error when enabled but API key not configured', async () => {
    const source = new WebSearchInfoSource({ enabled: true })
    const result = await source.fetch({ query: 'test' })
    expect(result.success).toBe(false)
    if (!result.success && result.error) {
      expect(result.error.code).toBe('web_search_error')
    }
  })

  it('defaults to openai provider', () => {
    const source = new WebSearchInfoSource({ enabled: true })
    const config = source.getConfig()
    expect(config.id).toBe('web_search')
  })

  it('accepts custom search config', () => {
    const source = new WebSearchInfoSource({}, { provider: 'google', maxResults: 5 })
    const config = source.getConfig()
    expect(config.id).toBe('web_search')
  })

  it('starts with active health', () => {
    const source = new WebSearchInfoSource()
    expect(source.getHealth().status).toBe('active')
  })

  describe('updateSearchConfig', () => {
    it('updates search config', () => {
      const source = new WebSearchInfoSource({ enabled: true }, { provider: 'openai' })
      source.updateSearchConfig({ provider: 'bing' })
    })
  })

  describe('WEB_SEARCH_CONFIG', () => {
    it('has correct defaults', () => {
      expect(WEB_SEARCH_CONFIG.id).toBe('web_search')
      expect(WEB_SEARCH_CONFIG.enabled).toBe(false)
      expect(WEB_SEARCH_CONFIG.timeoutMs).toBe(15000)
    })
  })
})
