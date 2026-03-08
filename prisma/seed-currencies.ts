import { PrismaClient } from '@prisma/client'

const currencies = [
  { code: 'USD', name: 'US Dollar', nameJa: '米ドル', symbol: '$', sortOrder: 1 },
  { code: 'EUR', name: 'Euro', nameJa: 'ユーロ', symbol: '€', sortOrder: 2 },
  { code: 'GBP', name: 'British Pound', nameJa: '英ポンド', symbol: '£', sortOrder: 3 },
  { code: 'AUD', name: 'Australian Dollar', nameJa: '豪ドル', symbol: 'A$', sortOrder: 4 },
  { code: 'CNY', name: 'Chinese Yuan', nameJa: '中国人民元', symbol: '¥', sortOrder: 5 },
  { code: 'CHF', name: 'Swiss Franc', nameJa: 'スイスフラン', symbol: 'Fr', sortOrder: 6 },
  { code: 'CAD', name: 'Canadian Dollar', nameJa: 'カナダドル', symbol: 'C$', sortOrder: 7 },
  { code: 'HKD', name: 'Hong Kong Dollar', nameJa: '香港ドル', symbol: 'HK$', sortOrder: 8 },
  { code: 'KRW', name: 'Korean Won', nameJa: '韓国ウォン', symbol: '₩', sortOrder: 9 },
  {
    code: 'SGD',
    name: 'Singapore Dollar',
    nameJa: 'シンガポールドル',
    symbol: 'S$',
    sortOrder: 10,
  },
]

export async function seedCurrencies(prisma: PrismaClient) {
  for (const currency of currencies) {
    await prisma.currency.upsert({
      where: { code: currency.code },
      update: currency,
      create: currency,
    })
  }
  console.log(`Seeded ${currencies.length} currencies`)
}
