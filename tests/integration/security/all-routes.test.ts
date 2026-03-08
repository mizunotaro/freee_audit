import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs/promises'
import path from 'path'

const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/health',
  '/api/freee/callback',
  '/api/investor/accept',
]

const AUTH_PATTERNS = [
  'withAuth',
  'withAdminAuth',
  'withAccountantAuth',
  'validateSession',
  'getAuthenticatedUser',
  'requireRole',
  'requireCompanyAccess',
]

async function findRouteFiles(dir: string, files: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await findRouteFiles(fullPath, files)
    } else if (entry.name === 'route.ts') {
      files.push(fullPath)
    }
  }

  return files
}

describe('All API Routes Protection', () => {
  let routeFiles: string[] = []

  beforeAll(async () => {
    routeFiles = await findRouteFiles('src/app/api')
  })

  it('should have API routes to test', () => {
    expect(routeFiles.length).toBeGreaterThan(0)
  })

  it('should protect all non-public routes', async () => {
    const unprotectedRoutes: string[] = []
    const protectedRoutes: string[] = []
    const publicRoutesList: string[] = []

    for (const file of routeFiles) {
      const content = await fs.readFile(file, 'utf-8')
      const normalizedFile = file.replace(/\\/g, '/')
      const route = normalizedFile.replace('src/app/api', '/api').replace('/route.ts', '')

      const isPublic = PUBLIC_ROUTES.some(
        (publicRoute) => route === publicRoute || route.startsWith(publicRoute + '/')
      )

      if (isPublic) {
        publicRoutesList.push(route)
      } else {
        const hasAuth = AUTH_PATTERNS.some((pattern) => content.includes(pattern))

        if (hasAuth) {
          protectedRoutes.push(route)
        } else {
          unprotectedRoutes.push(route)
        }
      }
    }

    console.log('\n=== Route Protection Status ===')
    console.log(`\nPublic routes (${publicRoutesList.length}):`)
    publicRoutesList.forEach((r) => console.log(`  ○ ${r}`))

    console.log(`\nProtected routes (${protectedRoutes.length}):`)
    protectedRoutes.forEach((r) => console.log(`  ✓ ${r}`))

    if (unprotectedRoutes.length > 0) {
      console.log(`\n⚠ Potentially unprotected routes (${unprotectedRoutes.length}):`)
      unprotectedRoutes.forEach((r) => console.log(`  ✗ ${r}`))
    }

    expect(protectedRoutes.length).toBeGreaterThan(0)
    expect(unprotectedRoutes.length).toBe(0)
  })

  it('should not expose sensitive data in any route', async () => {
    const sensitivePatterns = [
      /decrypt.*ApiKey/i,
      /openaiApiKey.*\.json\(\)/i,
      /geminiApiKey.*\.json\(\)/i,
      /claudeApiKey.*\.json\(\)/i,
      /passwordHash.*\.json\(\)/i,
      /return.*password/i,
    ]

    const violations: string[] = []

    for (const file of routeFiles) {
      const content = await fs.readFile(file, 'utf-8')
      const normalizedFile = file.replace(/\\/g, '/')
      const route = normalizedFile.replace('src/app/api', '/api').replace('/route.ts', '')

      for (const pattern of sensitivePatterns) {
        if (pattern.test(content)) {
          violations.push(`${route}: matches ${pattern}`)
        }
      }
    }

    if (violations.length > 0) {
      console.log('\n=== Sensitive Data Exposure Warnings ===')
      violations.forEach((v) => console.log(`  ⚠ ${v}`))
    }

    expect(violations.length).toBe(0)
  })

  it('should use secure cookie settings for session', async () => {
    const normalizedFiles = routeFiles.map((f) => f.replace(/\\/g, '/'))
    const loginRoute = normalizedFiles.find(
      (f) => f.includes('auth/login') && f.endsWith('route.ts')
    )
    expect(loginRoute).toBeDefined()

    if (loginRoute) {
      const content = await fs.readFile(loginRoute, 'utf-8')

      const hasHttpOnly = content.includes('httpOnly') || content.includes('HttpOnly')
      const hasSecure = content.includes('secure') || content.includes('Secure')
      const hasSameSite =
        content.includes('sameSite') ||
        content.includes('SameSite') ||
        content.includes('same-site')

      console.log('\n=== Session Cookie Settings ===')
      console.log(`  HttpOnly: ${hasHttpOnly ? '✓' : '✗'}`)
      console.log(`  Secure: ${hasSecure ? '✓' : '✗'}`)
      console.log(`  SameSite: ${hasSameSite ? '✓' : '✗'}`)

      expect(hasHttpOnly || hasSecure || hasSameSite).toBe(true)
    }
  })
})
