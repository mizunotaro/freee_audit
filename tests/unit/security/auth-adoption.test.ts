import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..')
const API_ROOT = join(REPO_ROOT, 'src', 'app', 'api')

// SEC-AUTH-01 option (b): the middleware API gate is retired, so every API
// route is solely responsible for resolving identity via the DB-backed
// validateSession(). This guard fails if a route handler imports NEITHER the
// shared auth layer (@/lib/api) NOR @/lib/auth and is not on the explicit
// public allowlist — i.e. it is the "forgot to call auth" failure mode.
//
// Limitation: an import is necessary but not sufficient proof of enforcement
// (a route could import the module and forget to gate on it). It reliably
// catches the concrete regression of a brand-new route wired with no auth at
// all, which is the risk SEC-AUTH-01 names. The import-marker approach mirrors
// the proposal's own option (b) recommendation.
const PUBLIC_ALLOWLIST = new Set<string>(['src/app/api/health/route.ts'].map(normalize))

function normalize(p: string): string {
  return p.split(sep).join('/')
}

function findRouteFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...findRouteFiles(full))
    } else if (entry.name === 'route.ts' || entry.name === 'route.tsx') {
      out.push(full)
    }
  }
  return out
}

// Matches '@lib/api', '@/lib/api/auth-helpers', '@/lib/auth', etc. Does NOT
// match '@/lib/auth-edge' (edge-only validation is not DB-backed and is not a
// substitute for the handler-level session check).
const AUTH_IMPORT_RE = /['"]@\/lib\/(api|auth)(?:\/[^'"]*)?['"]/

describe('SEC-AUTH-01 option (b): API auth adoption guard', () => {
  const routeFiles = findRouteFiles(API_ROOT)

  it('found the API route tree (sanity)', () => {
    expect(routeFiles.length).toBeGreaterThan(100)
  })

  it('every non-public API route imports the shared auth layer (@/lib/api or @/lib/auth)', () => {
    const offenders: string[] = []
    for (const file of routeFiles) {
      const rel = normalize(relative(REPO_ROOT, file))
      if (PUBLIC_ALLOWLIST.has(rel)) continue
      const source = readFileSync(file, 'utf8')
      if (!AUTH_IMPORT_RE.test(source)) {
        offenders.push(rel)
      }
    }
    expect(
      offenders,
      `Routes missing an auth import (@/lib/api or @/lib/auth) and not on the public allowlist:\n${offenders.join('\n')}`
    ).toEqual([])
  })
})
