import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..')

// The well-known sequential 64-hex value previously shipped in user-facing
// templates. Copy-pasting it into a real deployment puts every ciphertext
// under a publicly known key (SEC-CRYPTO-06). This value is still used by
// tests/setup.ts and CI as an explicit dev/test fixture — that is correct and
// must NOT be changed; only user-facing templates must not ship it.
const WELL_KNOWN_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

function readUserFacing(path: string): string | null {
  const full = join(REPO_ROOT, path)
  return existsSync(full) ? readFileSync(full, 'utf-8') : null
}

describe('SEC-CRYPTO-06: user-facing templates must not ship the well-known ENCRYPTION_KEY', () => {
  it('.env.example uses a placeholder, not the well-known key', () => {
    const env = readUserFacing('.env.example')
    expect(env, '.env.example must exist').not.toBeNull()
    expect(env).not.toContain(WELL_KNOWN_KEY)
    expect(env).toMatch(/ENCRYPTION_KEY="<generate-32-byte-hex-string>"/)
  })

  it('README setup docs do not ship the well-known key', () => {
    const readme = readUserFacing('README.md')
    expect(readme, 'README.md must exist').not.toBeNull()
    expect(readme).not.toContain(WELL_KNOWN_KEY)
  })
})
