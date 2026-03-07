'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Play, Download, Settings, Loader2, AlertTriangle } from 'lucide-react'
import { ConversionLayout } from '@/components/conversion/layout'
import { ConversionStepper, type Step } from '@/components/conversion/stepper'
import { StatusBadge } from '@/components/conversion/status-badge'
import { ProjectProgress } from '@/components/conversion/project-progress'
import type { ConversionProject } from '@/types/conversion'

const PROJECT_STEPS: Step[] = [
  { id: 'setup', label: 'セットアップ', status: 'completed' },
  { id: 'mapping', label: 'マッピング', status: 'pending' },
  { id: 'validate', label: '検証', status: 'pending' },
  { id: 'convert', label: '変換', status: 'pending' },
  { id: 'review', label: 'レビュー', status: 'pending' },
  { id: 'complete', label: '完了', status: 'pending' },
]

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [project, setProject] = useState<ConversionProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const projectRes = await fetch(`/api/conversion/projects/${id}`)

        if (projectRes.ok) {
          const data = await projectRes.json()
          setProject(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch project:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  const getSteps = (): Step[] => {
    if (!project) return PROJECT_STEPS

    const statusOrder = ['draft', 'mapping', 'validating', 'converting', 'reviewing', 'completed']
    const currentIndex = statusOrder.indexOf(project.status)

    return PROJECT_STEPS.map((step, index) => {
      let status: Step['status'] = 'pending'
      if (index < currentIndex) {
        status = 'completed'
      } else if (index === currentIndex) {
        status = project.status === 'error' ? 'error' : 'current'
      }

      return { ...step, status }
    })
  }

  const handleExecute = async (dryRun: boolean = false) => {
    if (!project) return
    setExecuting(true)

    try {
      const res = await fetch(`/api/conversion/projects/${id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      })

      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to execute conversion')
      }
    } catch (error) {
      console.error('Failed to execute:', error)
      alert('Failed to execute conversion')
    } finally {
      setExecuting(false)
    }
  }

  if (loading) {
    return (
      <ConversionLayout companyId="">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </ConversionLayout>
    )
  }

  if (!project) {
    return (
      <ConversionLayout companyId="">
        <div className="p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold">プロジェクトが見つかりません</h2>
        </div>
      </ConversionLayout>
    )
  }

  return (
    <ConversionLayout companyId="">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-muted-foreground">{project.description}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/conversion/projects/${id}/settings`)}
            >
              <Settings className="mr-2 h-4 w-4" />
              設定
            </Button>
            {project.status === 'completed' && (
              <Button onClick={() => router.push(`/conversion/projects/${id}/results`)}>
                <Download className="mr-2 h-4 w-4" />
                結果を見る
              </Button>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>進捗</CardTitle>
          </CardHeader>
          <CardContent>
            <ConversionStepper steps={getSteps()} />
          </CardContent>
        </Card>

        {project.status === 'converting' ? (
          <ProjectProgress projectId={id} onComplete={() => router.refresh()} />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>アクション</CardTitle>
              <CardDescription>変換を実行または中止</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {['draft', 'mapping', 'error'].includes(project.status) && (
                  <>
                    <Button onClick={() => handleExecute(false)} disabled={executing}>
                      {executing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="mr-2 h-4 w-4" />
                      )}
                      変換実行
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleExecute(true)}
                      disabled={executing}
                    >
                      ドライラン
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>プロジェクト情報</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">ソース基準</dt>
                <dd className="font-medium">{project.sourceStandard}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">ターゲット基準</dt>
                <dd className="font-medium">{project.targetStandard}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">期間開始</dt>
                <dd className="font-medium">
                  {new Date(project.periodStart).toLocaleDateString('ja-JP')}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">期間終了</dt>
                <dd className="font-medium">
                  {new Date(project.periodEnd).toLocaleDateString('ja-JP')}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {project.statistics && (
          <Card>
            <CardHeader>
              <CardTitle>統計</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div className="rounded-lg bg-muted p-4">
                  <div className="text-2xl font-bold">{project.statistics.mappedAccounts}</div>
                  <div className="text-sm text-muted-foreground">マッピング済み</div>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <div className="text-2xl font-bold">{project.statistics.totalJournals}</div>
                  <div className="text-sm text-muted-foreground">総仕訳数</div>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <div className="text-2xl font-bold">{project.statistics.adjustingEntryCount}</div>
                  <div className="text-sm text-muted-foreground">調整仕訳</div>
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <div className="text-2xl font-bold">
                    {Math.round(project.statistics.averageConfidence * 100)}%
                  </div>
                  <div className="text-sm text-muted-foreground">平均信頼度</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ConversionLayout>
  )
}
