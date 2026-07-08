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

  describe('error branches per provider', () => {
    it('returns web_search_error with not-configured message for openai without api key', async () => {
      const source = new WebSearchInfoSource({ enabled: true })
      const result = await source.fetch({ query: 'test' })

      expect(result.success).toBe(false)
      if (!result.success && result.error) {
        expect(result.error.code).toBe('web_search_error')
        expect(result.error.message).toContain('OpenAI API key not configured')
      }
    })

    it('returns web_search_error with not-implemented message for openai with api key', async () => {
      const source = new WebSearchInfoSource({ enabled: true }, { provider: 'openai', apiKey: 'k' })
      const result = await source.fetch({ query: 'test' })

      expect(result.success).toBe(false)
      if (!result.success && result.error) {
        expect(result.error.code).toBe('web_search_error')
        expect(result.error.message).toContain('OpenAI web search not implemented')
      }
    })

    it('returns web_search_error for serpapi not implemented', async () => {
      const source = new WebSearchInfoSource(
        { enabled: true },
        { provider: 'serpapi', apiKey: 'k' }
      )
      const result = await source.fetch({ query: 'test' })

      expect(result.success).toBe(false)
      if (!result.success && result.error) {
        expect(result.error.code).toBe('web_search_error')
        expect(result.error.message).toContain('SerpAPI not implemented')
      }
    })

    it('returns web_search_error for google not implemented', async () => {
      const source = new WebSearchInfoSource(
        { enabled: true },
        { provider: 'google', apiKey: 'k', searchEngineId: 'e' }
      )
      const result = await source.fetch({ query: 'test' })

      expect(result.success).toBe(false)
      if (!result.success && result.error) {
        expect(result.error.code).toBe('web_search_error')
        expect(result.error.message).toContain('Google Custom Search not implemented')
      }
    })

    it('returns web_search_error for bing not implemented', async () => {
      const source = new WebSearchInfoSource({ enabled: true }, { provider: 'bing', apiKey: 'k' })
      const result = await source.fetch({ query: 'test' })

      expect(result.success).toBe(false)
      if (!result.success && result.error) {
        expect(result.error.code).toBe('web_search_error')
        expect(result.error.message).toContain('Bing Search not implemented')
      }
    })

    it('returns web_search_error for unknown provider', async () => {
      const source = new WebSearchInfoSource({ enabled: true }, { provider: 'unknown' as never })
      const result = await source.fetch({ query: 'test' })

      expect(result.success).toBe(false)
      if (!result.success && result.error) {
        expect(result.error.code).toBe('web_search_error')
        expect(result.error.message).toContain('Unknown search provider: unknown')
      }
    })

    it('records failure health on error', async () => {
      const source = new WebSearchInfoSource({ enabled: true })
      await source.fetch({ query: 'test' })

      const health = source.getHealth()
      expect(health.status).toBe('degraded')
      expect(health.consecutiveFailures).toBe(1)
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
