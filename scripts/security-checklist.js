#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const glob = require('glob')

const PUBLIC_ROUTES = ['/api/auth/login', '/api/auth/logout', '/api/health', '/api/freee/callback']

const AUTH_PATTERNS = [
  'withAuth',
  'validateSession',
  'getAuthenticatedUser',
  'requireRole',
  'requireCompanyAccess',
]

let exitCode = 0

function log(message, type = 'info') {
  const symbols = {
    success: '✓',
    error: '✗',
    warning: '⚠',
    info: '○',
  }
  console.log(`  ${symbols[type]} ${message}`)
}

function checkEnvironmentVariables() {
  console.log('\n1. Checking required environment variables...')
  const requiredVars = ['JWT_SECRET', 'CSRF_SECRET', 'ENCRYPTION_KEY']

  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      log(`${varName} is not set`, 'error')
      exitCode = 1
    } else {
      log(`${varName} is set`)
    }
  })
}

function checkEnvironmentVariableStrength() {
  console.log('\n2. Checking environment variable strength...')

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    log('JWT_SECRET is too short (minimum 32 characters)', 'warning')
  } else {
    log('JWT_SECRET has sufficient length', 'success')
  }

  if (process.env.CSRF_SECRET && process.env.CSRF_SECRET.length < 32) {
    log('CSRF_SECRET is too short (minimum 32 characters)', 'warning')
  } else {
    log('CSRF_SECRET has sufficient length', 'success')
  }

  if (process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length !== 64) {
    log('ENCRYPTION_KEY should be 64 characters (32 bytes hex)', 'warning')
  } else {
    log('ENCRYPTION_KEY has correct length', 'success')
  }
}

function checkDependencies() {
  console.log('\n3. Checking for vulnerable dependencies...')
  try {
    execSync('pnpm audit --audit-level=moderate', { stdio: 'pipe' })
    log('No vulnerabilities in dependencies', 'success')
  } catch (error) {
    log('Vulnerabilities found in dependencies', 'warning')
    log('Run: pnpm audit for details', 'info')
  }
}

function checkTypeScript() {
  console.log('\n4. Running TypeScript type check...')
  try {
    execSync('pnpm typecheck', { stdio: 'pipe' })
    log('TypeScript check passed', 'success')
  } catch (error) {
    log('TypeScript errors found', 'error')
    exitCode = 1
  }
}

function checkUnprotectedRoutes() {
  console.log('\n5. Checking for unprotected routes...')

  const routeFiles = glob.sync('src/app/api/**/route.ts')
  let unprotectedCount = 0

  routeFiles.forEach((file) => {
    const content = fs.readFileSync(file, 'utf-8')
    const route = file
      .replace('src/app/api', '/api')
      .replace('/route.ts', '')
      .split(path.sep)
      .join('/')

    const isPublic = PUBLIC_ROUTES.some((publicRoute) => route.startsWith(publicRoute))

    if (!isPublic) {
      const hasAuth = AUTH_PATTERNS.some((pattern) => content.includes(pattern))
      if (!hasAuth) {
        log(`Potentially unprotected: ${route}`, 'warning')
        unprotectedCount++
      }
    }
  })

  if (unprotectedCount === 0) {
    log('All routes are protected', 'success')
  } else {
    log(`Found ${unprotectedCount} potentially unprotected routes`, 'warning')
  }
}

function checkSensitiveDataExposure() {
  console.log('\n6. Checking for sensitive data exposure...')

  const sensitivePatterns = [
    /decrypt.*ApiKey/i,
    /openaiApiKey.*\.json\(\)/i,
    /geminiApiKey.*\.json\(\)/i,
    /claudeApiKey.*\.json\(\)/i,
    /passwordHash.*\.json\(\)/i,
  ]

  const routeFiles = glob.sync('src/app/api/**/route.ts')
  let violations = 0

  routeFiles.forEach((file) => {
    const content = fs.readFileSync(file, 'utf-8')
    sensitivePatterns.forEach((pattern) => {
      if (pattern.test(content)) {
        log(`Potential exposure in ${file}: ${pattern}`, 'warning')
        violations++
      }
    })
  })

  if (violations === 0) {
    log('No sensitive data exposure detected', 'success')
  }
}

function checkDefaultSecrets() {
  console.log('\n7. Checking for default secrets...')

  const defaultSecrets = ['your-secret-key', 'change-me', 'default', 'secret123', 'test-secret']

  const envFiles = ['.env', '.env.local', '.env.example']
  let foundDefaults = false

  envFiles.forEach((envFile) => {
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf-8')
      defaultSecrets.forEach((secret) => {
        if (content.toLowerCase().includes(secret.toLowerCase())) {
          log(`Default secret "${secret}" found in ${envFile}`, 'error')
          foundDefaults = true
          exitCode = 1
        }
      })
    }
  })

  if (!foundDefaults) {
    log('No default secrets found', 'success')
  }
}

function main() {
  console.log('=== Security Checklist ===')

  checkEnvironmentVariables()
  checkEnvironmentVariableStrength()
  checkDependencies()
  checkTypeScript()
  checkUnprotectedRoutes()
  checkSensitiveDataExposure()
  checkDefaultSecrets()

  console.log('\n=== Security Check Complete ===')

  if (exitCode === 0) {
    console.log('\n✓ All security checks passed!\n')
  } else {
    console.log('\n✗ Some security checks failed. Please review the issues above.\n')
  }

  process.exit(exitCode)
}

main()
