import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..')
const NEXT_CONFIG = readFileSync(join(REPO_ROOT, 'next.config.js'), 'utf-8')

// SEC-HEADER-01: global defensive headers are served from next.config.js
// `headers()` on the catch-all `/:path*` source (which covers pages AND API
// routes). The REV-SEC-01 proposal missed this and assumed headers were
// per-route. This test pins the configuration so the protection cannot regress
// silently (e.g. by someone deleting the block or narrowing the source).
describe('SEC-HEADER-01: global security headers via next.config.js', () => {
  it('defines a headers() function with a catch-all /:path* source', () => {
    expect(NEXT_CONFIG).toMatch(/async\s+headers\s*\(\s*\)\s*{/)
    expect(NEXT_CONFIG).toMatch(/source:\s*['"]\/:path\*['"]/)
  })

  it('sets the defensive header set on /:path*', () => {
    const expected = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()',
      },
    ]
    for (const { key, value } of expected) {
      expect(NEXT_CONFIG, `missing header ${key}: ${value}`).toContain(`key: '${key}'`)
      expect(NEXT_CONFIG).toContain(`value: '${value}'`)
    }
  })

  it('sets Strict-Transport-Security (HSTS) with a long max-age and includeSubDomains', () => {
    expect(NEXT_CONFIG).toMatch(/key:\s*['"]Strict-Transport-Security['"]/)
    expect(NEXT_CONFIG).toContain('max-age=63072000')
    expect(NEXT_CONFIG).toContain('includeSubDomains')
  })

  it('sets a Content-Security-Policy that blocks framing, base hijack, object embedding, and external form posts', () => {
    expect(NEXT_CONFIG).toMatch(/key:\s*['"]Content-Security-Policy['"]/)
    expect(NEXT_CONFIG).toContain("frame-ancestors 'none'")
    expect(NEXT_CONFIG).toContain("base-uri 'self'")
    expect(NEXT_CONFIG).toContain("form-action 'self'")
    expect(NEXT_CONFIG).toContain("default-src 'self'")
  })

  it('disables the X-Powered-By header (poweredByHeader: false)', () => {
    expect(NEXT_CONFIG).toMatch(/poweredByHeader:\s*false/)
  })
})
