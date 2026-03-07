'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react'
import { ConversionLayout } from '@/components/conversion/layout'
import { ConversionResultViewer } from '@/components/conversion/conversion-result-viewer'
import type { ConversionResult } from '@/types/conversion'

export default function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [result, setResult] = useState<ConversionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res = await fetch(`/api/conversion/projects/${id}/results?includeJournals=true`)
        if (res.ok) {
          const data = await res.json()
          setResult(data.data)
        } else {
          setError('結果の取得に失敗しました')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchResult()
  }, [id])

  if (loading) {
    return (
      <ConversionLayout companyId="">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </ConversionLayout>
    )
  }

  if (error || !result) {
    return (
      <ConversionLayout companyId="">
        <div className="p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">結果が見つかりません</h2>
          <p className="mt-2 text-muted-foreground">{error || '変換結果が存在しません'}</p>
          <Button className="mt-4" onClick={() => router.push(`/conversion/projects/${id}`)}>
            プロジェクトに戻る
          </Button>
        </div>
      </ConversionLayout>
    )
  }

  return (
    <ConversionLayout companyId="">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push(`/conversion/projects/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            プロジェクトに戻る
          </Button>
          <div>
            <h1 className="text-2xl font-bold">変換結果</h1>
            <p className="text-muted-foreground">会計基準変換の結果を確認・エクスポート</p>
          </div>
        </div>

        <ConversionResultViewer result={result} projectId={id} />
      </div>
    </ConversionLayout>
  )
}
