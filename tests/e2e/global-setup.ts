import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { applyE2eEnvDefaults } from './lib/env'

// The CI e2e job runs `pnpm e2e` against a fresh SQLite DB and never migrates
// or seeds it, so a login smoke flow would have no schema and no admin user.
// This one-shot Playwright globalSetup makes `pnpm e2e` self-contained:
//   1. sync the schema into the configured DATABASE_URL (`prisma db push`),
//   2. upsert the seeded admin the smoke spec logs in as.
// Idempotent (upserts only), so re-runs are safe.

async function pushSchema(): Promise<void> {
  execSync('prisma db push --skip-generate', { stdio: 'inherit' })
}

async function seedAdmin(prisma: PrismaClient): Promise<void> {
  const company = await prisma.company.upsert({
    where: { id: 'company_1' },
    update: {},
    create: { id: 'company_1', name: 'Sample Therapeutics株式会社' },
  })

  const passwordHash = await bcrypt.hash('admin123', 12)
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { passwordHash },
    create: {
      email: 'admin@example.com',
      name: 'システム管理者',
      passwordHash,
      role: 'ADMIN',
      companyId: company.id,
    },
  })
}

export default async function globalSetup(): Promise<void> {
  applyE2eEnvDefaults()
  await pushSchema()
  const prisma = new PrismaClient()
  try {
    await seedAdmin(prisma)
  } finally {
    await prisma.$disconnect()
  }
}
