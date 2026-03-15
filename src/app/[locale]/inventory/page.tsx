'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Construction, Package, ListChecks, Calculator, TrendingDown } from 'lucide-react'

const plannedFeatures = [
  {
    icon: Package,
    title: '棚卸資産詳細管理',
    description: '製品・半製品・原材料等の品目ごとに数量・金額を登録',
  },
  {
    icon: ListChecks,
    title: '在庫棚卸サポート',
    description: '棚卸作業を効率化し、帳簿との照合を支援',
  },
  {
    icon: Calculator,
    title: '評価減計算',
    description: '簿価切り下げや評価損の自動計算に対応',
  },
  {
    icon: TrendingDown,
    title: 'BS連携表示',
    description: '貸借対照表の棚卸資産と詳細データを紐付け',
  },
]

export default function InventoryPage() {
  const t = useTranslations('navigation')

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Card>
        <CardHeader className="pb-2 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Construction className="h-8 w-8 text-muted-foreground" />
            <Badge variant="secondary">準備中</Badge>
          </div>
          <CardTitle className="text-2xl">{t('inventory')}</CardTitle>
          <CardDescription className="mt-2 text-base">
            棚卸資産（製品・半製品・原材料等）の詳細管理機能を開発中です
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="mb-6 text-center text-muted-foreground">
            品目ごとの数量・金額登録、在庫棚卸、評価減計算に対応します。 公開までお待ちください。
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {plannedFeatures.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card key={index} className="bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div>
                        <h3 className="text-sm font-medium">{feature.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
