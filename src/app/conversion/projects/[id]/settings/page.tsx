'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Loader2, AlertTriangle, Save, Trash2 } from 'lucide-react'
import { ConversionLayout } from '@/components/conversion/layout'
import { StatusBadge } from '@/components/conversion/status-badge'
import type { ConversionProject, ConversionSettings } from '@/types/conversion'

export default function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [project, setProject] = useState<ConversionProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    settings: {
      includeJournals: true,
      includeFinancialStatements: true,
      generateAdjustingEntries: true,
      aiAssistedMapping: true,
    } as ConversionSettings,
  })

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`/api/conversion/projects/${id}`)
        if (res.ok) {
          const data = await res.json()
          setProject(data.data)
          setFormData({
            name: data.data.name,
            description: data.data.description || '',
            settings: data.data.settings,
          })
        }
      } catch (err) {
        console.error('Failed to fetch project:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchProject()
  }, [id])

  const canEdit = project && ['draft', 'mapping'].includes(project.status)

  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...updates }))
  }

  const updateSettings = (updates: Partial<ConversionSettings>) => {
    setFormData((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
    }))
  }

  const handleSave = async () => {
    if (!canEdit) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/conversion/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          settings: formData.settings,
        }),
      })

      if (res.ok) {
        setSuccess('設定を保存しました')
        setTimeout(() => setSuccess(null), 3000)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to save settings')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!project) return
    if (!confirm(`プロジェクト「${project.name}」を削除しますか？この操作は取り消せません。`))
      return

    setDeleting(true)
    setError(null)

    try {
      const res = await fetch(`/api/conversion/projects/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.push('/conversion/projects')
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete project')
        setDeleting(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setDeleting(false)
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push(`/conversion/projects/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            プロジェクトに戻る
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">プロジェクト設定</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-muted-foreground">プロジェクトの設定を変更します</p>
          </div>
        </div>

        {!canEdit && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <p className="text-sm text-yellow-800">
                このプロジェクトは現在「{project.status}」状態のため、設定を変更できません。
                設定を変更するには、プロジェクトを下書き状態に戻してください。
              </p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {success && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <p className="text-sm text-green-800">{success}</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>基本設定</CardTitle>
            <CardDescription>プロジェクトの基本情報を設定します</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">プロジェクト名</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">説明</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateFormData({ description: e.target.value })}
                disabled={!canEdit}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>変換オプション</CardTitle>
            <CardDescription>変換処理のオプションを設定します</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>仕訳変換</Label>
                <p className="text-sm text-muted-foreground">期間内の仕訳を変換対象に含める</p>
              </div>
              <Switch
                checked={formData.settings.includeJournals}
                onCheckedChange={(checked) => updateSettings({ includeJournals: checked })}
                disabled={!canEdit}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>財務諸表変換</Label>
                <p className="text-sm text-muted-foreground">
                  貸借対照表・損益計算書・CF計算書を生成
                </p>
              </div>
              <Switch
                checked={formData.settings.includeFinancialStatements}
                onCheckedChange={(checked) =>
                  updateSettings({ includeFinancialStatements: checked })
                }
                disabled={!canEdit}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>調整仕訳生成</Label>
                <p className="text-sm text-muted-foreground">基準差異に基づく調整仕訳を自動生成</p>
              </div>
              <Switch
                checked={formData.settings.generateAdjustingEntries}
                onCheckedChange={(checked) => updateSettings({ generateAdjustingEntries: checked })}
                disabled={!canEdit}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>AIアシストマッピング</Label>
                <p className="text-sm text-muted-foreground">
                  AIによる勘定科目マッピング推奨を使用
                </p>
              </div>
              <Switch
                checked={formData.settings.aiAssistedMapping}
                onCheckedChange={(checked) => updateSettings({ aiAssistedMapping: checked })}
                disabled={!canEdit}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>プロジェクト情報</CardTitle>
            <CardDescription>変更できない情報</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">プロジェクトID</dt>
                <dd className="font-mono">{project.id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">ソース基準</dt>
                <dd>{project.sourceStandard}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">ターゲット基準</dt>
                <dd>{project.targetStandard}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">期間</dt>
                <dd>
                  {new Date(project.periodStart).toLocaleDateString('ja-JP')} -{' '}
                  {new Date(project.periodEnd).toLocaleDateString('ja-JP')}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">作成日時</dt>
                <dd>{new Date(project.createdAt).toLocaleString('ja-JP')}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">更新日時</dt>
                <dd>{new Date(project.updatedAt).toLocaleString('ja-JP')}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || project.status === 'converting'}
          >
            {deleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            プロジェクトを削除
          </Button>

          <Button onClick={handleSave} disabled={!canEdit || saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            保存
          </Button>
        </div>
      </div>
    </ConversionLayout>
  )
}
