import { describe, it, expect, afterEach } from 'vitest'
import { LocalSecretProvider } from '@/lib/secrets'

// SEC-SECRET-03: LocalSecretProvider reads secrets from a plaintext JSON file
// (./secrets.json). That is fine for local dev but a footgun if SECRET_PROVIDER=local
// is set in production. The provider must fail closed (throw) when constructed
// under NODE_ENV=production so the misconfiguration is loud, not silent.
describe('SEC-SECRET-03: LocalSecretProvider refuses to run in production', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('throws when constructed under NODE_ENV=production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => new LocalSecretProvider({ provider: 'local' })).toThrowError(
      /must not be used in production/
    )
  })

  it('constructs normally outside production (dev/test)', () => {
    vi.stubEnv('NODE_ENV', 'test')
    expect(() => new LocalSecretProvider({ provider: 'local' })).not.toThrow()
  })
})
