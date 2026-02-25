import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const company = await prisma.company.upsert({
    where: { id: 'company_1' },
    update: {},
    create: {
      id: 'company_1',
      name: 'サンプル株式会社',
      freeeCompanyId: '12345',
      fiscalYearStart: 4,
    },
  })

  console.log('Created company:', company.name)

  const passwordHash = await bcrypt.hash('admin123', 12)

  const user = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash,
      name: 'システム管理者',
      role: 'ADMIN',
      companyId: company.id,
    },
  })

  console.log('Created user:', user.email)

  console.log('Seed complete!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
