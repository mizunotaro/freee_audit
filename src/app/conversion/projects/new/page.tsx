'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { ConversionLayout } from '@/components/conversion/layout'
import { ProjectWizard } from '@/components/conversion/project-wizard'
import type { AccountingStandard } from '@/types/conversion'

interface ChartOfAccount {
  id: string
  name: string
  standard: AccountingStandard
}

export default function NewProjectPage() {
  const router = useRouter()
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCoa = async () => {
      try {
        const res = await fetch('/api/conversion/coa')
        if (res.ok) {
          const data = await res.json()
          setChartOfAccounts(
            data.data.map((coa: { id: string; name: string; standard: AccountingStandard }) => ({
              id: coa.id,
              name: coa.name,
              standard: coa.standard,
            }))
          )
        }
      } catch (error) {
        console.error('Failed to fetch chart of accounts:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchCoa()
  }, [])

  if (loading) {
    return (
      <ConversionLayout companyId="">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </ConversionLayout>
    )
  }

  return (
    <ConversionLayout companyId="">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            戻る
          </Button>
          <div>
            <h1 className="text-2xl font-bold">新規プロジェクト作成</h1>
            <p className="text-muted-foreground">ウィザードに従って変換プロジェクトを作成します</p>
          </div>
        </div>

        <ProjectWizard companyId="" chartOfAccounts={chartOfAccounts} />
      </div>
    </ConversionLayout>
  )
}
