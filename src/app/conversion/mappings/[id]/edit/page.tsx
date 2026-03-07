'use client'

import { useState, useEffect, use, useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ConversionLayout } from '@/components/conversion/layout'
import { MappingEditor, MappingEditorValue } from '@/components/conversion/mapping-editor'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AccountMapping, ChartOfAccounts, ChartOfAccountItem } from '@/types/conversion'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function MappingEditPage({ params }: PageProps) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [mapping, setMapping] = useState<AccountMapping | null>(null)
  const [sourceCoa, setSourceCoa] = useState<ChartOfAccounts | null>(null)
  const [targetCoa, setTargetCoa] = useState<ChartOfAccounts | null>(null)

  const fetchMapping = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/conversion/mappings/${resolvedParams.id}`)
      if (response.ok) {
        const data = await response.json()
        setMapping(data.data)

        if (data.data) {
          await fetchCOAs(data.data)
        }
      } else {
        toast.error('マッピングが見つかりません')
        router.push('/conversion/mappings')
      }
    } catch {
      toast.error('データの取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }, [resolvedParams.id, router])

  const fetchCOAs = async (mappingData: AccountMapping) => {
    try {
      const [sourceRes, targetRes] = await Promise.all([
        fetch(`/api/conversion/coa/${mappingData.sourceAccountId || mappingData.sourceItemId}`),
        fetch(`/api/conversion/coa/${mappingData.targetAccountId || mappingData.targetItemId}`),
      ])

      if (sourceRes.ok) {
        const data = await sourceRes.json()
        setSourceCoa(data.data)
      }

      if (targetRes.ok) {
        const data = await targetRes.json()
        setTargetCoa(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch COAs:', error)
    }
  }

  useEffect(() => {
    fetchMapping()
  }, [fetchMapping])

  const handleSave = async (value: MappingEditorValue) => {
    if (!mapping) return

    try {
      const response = await fetch(`/api/conversion/mappings/${mapping.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetItemId: value.targetItemId,
          mappingType: value.mappingType,
          conversionRule: value.conversionRule,
          percentage: value.percentage,
          notes: value.notes,
        }),
      })

      if (response.ok) {
        toast.success('マッピングを更新しました')
        router.push('/conversion/mappings')
      } else {
        toast.error('更新に失敗しました')
      }
    } catch {
      toast.error('更新に失敗しました')
    }
  }

  const handleDelete = async () => {
    if (!mapping) return

    try {
      const response = await fetch(`/api/conversion/mappings/${mapping.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('マッピングを削除しました')
        router.push('/conversion/mappings')
      } else {
        toast.error('削除に失敗しました')
      }
    } catch {
      toast.error('削除に失敗しました')
    }
  }

  const sourceItems: ChartOfAccountItem[] = sourceCoa?.items || []
  const targetItems: ChartOfAccountItem[] = targetCoa?.items || []

  return (
    <ConversionLayout companyId="current">
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/conversion/mappings">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">マッピング編集</h1>
            <p className="text-muted-foreground">Edit Mapping</p>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="space-y-6 pt-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <div className="flex justify-end gap-2">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-24" />
              </div>
            </CardContent>
          </Card>
        ) : mapping ? (
          <MappingEditor
            sourceItems={sourceItems}
            targetItems={targetItems}
            mapping={mapping}
            onSave={handleSave}
            onDelete={handleDelete}
            onCancel={() => router.push('/conversion/mappings')}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              マッピングが見つかりません
            </CardContent>
          </Card>
        )}
      </div>
    </ConversionLayout>
  )
}
