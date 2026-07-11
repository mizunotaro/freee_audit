// Shared E2E environment.
//
// The Playwright `webServer` (`pnpm dev`) and the one-shot `globalSetup` both
// need the same runtime secrets so the Next.js process can boot:
//   - CSRF_SECRET: validated (>=32 chars) at module-import time by
//     src/lib/security/csrf-protection.ts — a short value crashes the server.
//   - ENCRYPTION_KEY: 64-char hex consumed by src/lib/crypto.ts (AES-256-GCM).
//   - JWT_SECRET: any non-empty value (src/lib/auth).
//   - DATABASE_URL: SQLite file used by both `prisma db push` and the app.
// E2E additionally forces the documented dev mock flags so no external freee/AI
// call is attempted. CI provides real values via the e2e job env; these are
// only fallbacks for local `pnpm e2e` runs without a .env.local. Existing
// process.env values always win.

const HEX_64 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const E2E_ENV_FALLBACKS: ReadonlyArray<readonly [string, string]> = [
  ['DATABASE_URL', 'file:./test.db'],
  ['JWT_SECRET', `e2e-jwt-secret-${HEX_64}`],
  ['ENCRYPTION_KEY', HEX_64],
  ['CSRF_SECRET', `e2e-csrf-secret-${HEX_64}`],
]

function resolveEnv(key: string, fallback: string): string {
  const current = process.env[key]
  return current && current.length > 0 ? current : fallback
}

export const e2eEnv: Record<string, string> = {
  ...Object.fromEntries(E2E_ENV_FALLBACKS.map(([key, value]) => [key, resolveEnv(key, value)])),
  FREEE_MOCK_MODE: 'true',
  AI_MOCK_MODE: 'true',
}

// Backfill the launching process's own env with the same defaults so the
// globalSetup (prisma CLI + PrismaClient) runs even without a .env.local.
export function applyE2eEnvDefaults(): void {
  for (const [key, value] of Object.entries(e2eEnv)) {
    if (!process.env[key]) process.env[key] = value
  }
}

// Build the webServer process env: inherit every *defined* variable from the
// parent (PATH, CI secrets, ...) then layer mock mode + secret fallbacks on top.
// Defined-only filtering keeps the object `Record<string, string>` so it
// satisfies Playwright's `webServer.env` type (process.env is string|undefined).
export function webServerEnv(): Record<string, string> {
  const inherited: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) inherited[key] = value
  }
  return { ...inherited, ...e2eEnv }
}
