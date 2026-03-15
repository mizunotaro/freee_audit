'use client'

import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Construction, Search, FileText, TrendingUp, Building2 } from 'lucide-react'

const plannedFeatures = [
  {
    icon: Search,
    title: 'IPOショートレビュー',
    description: '上場前の財務データを迅速に分析し、リスク項目を抽出',
  },
  {
    icon: Building2,
    title: 'M&A財務デューデリジェンス',
    description: '買収対象企業の財務健全性を多角的に評価',
  },
  {
    icon: FileText,
    title: 'レポート自動生成',
    description: 'まとまったレポートを即座に作成・提出可能',
  },
  {
    icon: TrendingUp,
    title: 'インタラクティブ分析',
    description: '気になる項目をドリルダウンして詳細確認',
  },
]

export default function FinancialDDPage() {
  const t = useTranslations('navigation')

  return (
    <div className="container mx-auto max-w-4xl py-8">
      <Card>
        <CardHeader className="pb-2 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <Construction className="h-8 w-8 text-muted-foreground" />
            <Badge variant="secondary">準備中</Badge>
          </div>
          <CardTitle className="text-2xl">{t('financialDD')}</CardTitle>
          <CardDescription className="mt-2 text-base">
            IPOショートレビュー・M&A時の財務デューデリジェンス機能を開発中です
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <p className="mb-6 text-center text-muted-foreground">
            まとまったレポートを即座に作成し、インタラクティブにドリルダウン分析が可能になります。
            公開までお待ちください。
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
