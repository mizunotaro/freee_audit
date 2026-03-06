'use client'

import { useState, useEffect } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Eye, EyeOff, Save, RefreshCw, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface TaxSettings {
  withholdingSpecialRule: boolean
  withholdingEmployeeCount: number
  fiscalYearStart: number
  consumptionTaxable: boolean
  taxFilingMethod: string
}

interface Settings {
  theme: 'light' | 'dark' | 'system'
  aiProvider: 'openai' | 'gemini' | 'claude' | 'azure' | 'aws' | 'gcp'
  openaiApiKey: string
  geminiApiKey: string
  claudeApiKey: string
  azureApiKey: string
  azureEndpoint: string
  awsAccessKeyId: string
  awsSecretAccessKey: string
  awsRegion: string
  gcpApiKey: string
  gcpProjectId: string
  secretSource:
    | 'local'
    | 'gcp_secret'
    | 'aws_secrets'
    | 'azure_keyvault'
    | 'onepassword'
    | 'lastpass'
  freeeClientId: string
  freeeClientSecret: string
  freeeCompanyId: string
  analysisPrompt: string
  fiscalYearEndMonth: number
  taxBusinessType: 'exempt' | 'simplified' | 'general'
  taxSettings: TaxSettings
}

const defaultPrompt = `freeeから取得したスタートアップ企業の財務データを公認会計士・税理士の観点から分析を行って下さい。経営指標についてはVC/CVCや銀行員の観点からも評価をおこなってください。

分析にあたっては以下の点に注意してください：
1. 収益性、安全性、効率性、成長性の観点から総合評価を行う
2. 特異な数値や異常値があれば指摘する
3. 改善すべき点があれば具体的なアクションプランを提示する
4. 業界標準との比較観点も含める`

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    theme: 'system',
    aiProvider: 'openai',
    openaiApiKey: '',
    geminiApiKey: '',
    claudeApiKey: '',
    azureApiKey: '',
    azureEndpoint: '',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsRegion: 'ap-northeast-1',
    gcpApiKey: '',
    gcpProjectId: '',
    secretSource: 'local',
    freeeClientId: '',
    freeeClientSecret: '',
    freeeCompanyId: '',
    analysisPrompt: defaultPrompt,
    fiscalYearEndMonth: 12,
    taxBusinessType: 'general',
    taxSettings: {
      withholdingSpecialRule: false,
      withholdingEmployeeCount: 0,
      fiscalYearStart: 1,
      consumptionTaxable: true,
      taxFilingMethod: 'BLUE',
    },
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [taxSettingsSaving, setTaxSettingsSaving] = useState(false)

  useEffect(() => {
    fetchSettings()
  }, [])

  useEffect(() => {
    applyTheme(settings.theme)
  }, [settings.theme])

  const fetchSettings = async () => {
    try {
      const [settingsRes, taxSettingsRes] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/tax/settings'),
      ])

      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setSettings((prev) => ({ ...prev, ...data }))
      }

      if (taxSettingsRes.ok) {
        const taxData = await taxSettingsRes.json()
        setSettings((prev) => ({
          ...prev,
          taxSettings: {
            withholdingSpecialRule: taxData.withholdingSpecialRule ?? false,
            withholdingEmployeeCount: taxData.withholdingEmployeeCount ?? 0,
            fiscalYearStart: taxData.fiscalYearStart ?? 1,
            consumptionTaxable: taxData.consumptionTaxable ?? true,
            taxFilingMethod: taxData.taxFilingMethod ?? 'BLUE',
          },
        }))
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const applyTheme = (theme: string) => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (res.ok) {
        toast.success('設定を保存しました')
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('設定の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const toggleShowSecret = (key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const updateTaxSetting = <K extends keyof TaxSettings>(key: K, value: TaxSettings[K]) => {
    setSettings((prev) => ({
      ...prev,
      taxSettings: { ...prev.taxSettings, [key]: value },
    }))
  }

  const handleSaveTaxSettings = async () => {
    setTaxSettingsSaving(true)
    try {
      const res = await fetch('/api/tax/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings.taxSettings),
      })

      if (res.ok) {
        toast.success('税金設定を保存しました')
      } else {
        throw new Error('Failed to save tax settings')
      }
    } catch (error) {
      console.error('Failed to save tax settings:', error)
      toast.error('税金設定の保存に失敗しました')
    } finally {
      setTaxSettingsSaving(false)
    }
  }

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <AppLayout title="設定">
        <div className="animate-pulse space-y-4">
          <div className="h-32 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
          <div className="h-64 rounded-lg bg-gray-200 dark:bg-gray-700"></div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout title="設定">
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">一般</TabsTrigger>
          <TabsTrigger value="ai">AI設定</TabsTrigger>
          <TabsTrigger value="freee">freee連携</TabsTrigger>
          <TabsTrigger value="tax">税金設定</TabsTrigger>
          <TabsTrigger value="prompt">プロンプト</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>外観</CardTitle>
              <CardDescription>テーマとダークモードの設定</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="theme">テーマ</Label>
                  <p className="text-sm text-gray-500">
                    システム設定に従う場合は自動的に切り替わります
                  </p>
                </div>
                <Select
                  value={settings.theme}
                  onValueChange={(value) => updateSetting('theme', value as Settings['theme'])}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">システム設定</SelectItem>
                    <SelectItem value="light">ライトモード</SelectItem>
                    <SelectItem value="dark">ダークモード</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI プロバイダー設定</CardTitle>
              <CardDescription>使用するLLMとAPIキーを設定します</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>利用するLLM</Label>
                <Select
                  value={settings.aiProvider}
                  onValueChange={(value) =>
                    updateSetting('aiProvider', value as Settings['aiProvider'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI (GPT-4)</SelectItem>
                    <SelectItem value="gemini">Google Gemini</SelectItem>
                    <SelectItem value="claude">Anthropic Claude</SelectItem>
                    <SelectItem value="azure">Azure OpenAI</SelectItem>
                    <SelectItem value="aws">AWS Bedrock</SelectItem>
                    <SelectItem value="gcp">Google Cloud Vertex AI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>シークレット取得元</Label>
                <Select
                  value={settings.secretSource}
                  onValueChange={(value) =>
                    updateSetting('secretSource', value as Settings['secretSource'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">ローカル保存（暗号化）</SelectItem>
                    <SelectItem value="gcp_secret">GCP Secret Manager</SelectItem>
                    <SelectItem value="aws_secrets">AWS Secrets Manager</SelectItem>
                    <SelectItem value="azure_keyvault">Azure Key Vault</SelectItem>
                    <SelectItem value="onepassword">1Password</SelectItem>
                    <SelectItem value="lastpass">LastPass</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.secretSource === 'local' && (
                <>
                  {settings.aiProvider === 'openai' && (
                    <div className="space-y-2">
                      <Label htmlFor="openai-key">OpenAI API Key</Label>
                      <div className="relative">
                        <Input
                          id="openai-key"
                          type={showSecrets['openai'] ? 'text' : 'password'}
                          value={settings.openaiApiKey}
                          onChange={(e) => updateSetting('openaiApiKey', e.target.value)}
                          placeholder="sk-..."
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowSecret('openai')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showSecrets['openai'] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {settings.aiProvider === 'gemini' && (
                    <div className="space-y-2">
                      <Label htmlFor="gemini-key">Google AI API Key</Label>
                      <div className="relative">
                        <Input
                          id="gemini-key"
                          type={showSecrets['gemini'] ? 'text' : 'password'}
                          value={settings.geminiApiKey}
                          onChange={(e) => updateSetting('geminiApiKey', e.target.value)}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowSecret('gemini')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showSecrets['gemini'] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {settings.aiProvider === 'claude' && (
                    <div className="space-y-2">
                      <Label htmlFor="claude-key">Anthropic API Key</Label>
                      <div className="relative">
                        <Input
                          id="claude-key"
                          type={showSecrets['claude'] ? 'text' : 'password'}
                          value={settings.claudeApiKey}
                          onChange={(e) => updateSetting('claudeApiKey', e.target.value)}
                          placeholder="sk-ant-..."
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowSecret('claude')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showSecrets['claude'] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {settings.aiProvider === 'azure' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="azure-key">Azure OpenAI API Key</Label>
                        <div className="relative">
                          <Input
                            id="azure-key"
                            type={showSecrets['azure'] ? 'text' : 'password'}
                            value={settings.azureApiKey}
                            onChange={(e) => updateSetting('azureApiKey', e.target.value)}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowSecret('azure')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showSecrets['azure'] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="azure-endpoint">Azure Endpoint</Label>
                        <Input
                          id="azure-endpoint"
                          type="text"
                          value={settings.azureEndpoint}
                          onChange={(e) => updateSetting('azureEndpoint', e.target.value)}
                          placeholder="https://your-resource.openai.azure.com/"
                        />
                      </div>
                    </>
                  )}

                  {settings.aiProvider === 'aws' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="aws-access-key">AWS Access Key ID</Label>
                        <Input
                          id="aws-access-key"
                          type="text"
                          value={settings.awsAccessKeyId}
                          onChange={(e) => updateSetting('awsAccessKeyId', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="aws-secret-key">AWS Secret Access Key</Label>
                        <div className="relative">
                          <Input
                            id="aws-secret-key"
                            type={showSecrets['aws'] ? 'text' : 'password'}
                            value={settings.awsSecretAccessKey}
                            onChange={(e) => updateSetting('awsSecretAccessKey', e.target.value)}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowSecret('aws')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showSecrets['aws'] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="aws-region">AWS Region</Label>
                        <Input
                          id="aws-region"
                          type="text"
                          value={settings.awsRegion}
                          onChange={(e) => updateSetting('awsRegion', e.target.value)}
                          placeholder="ap-northeast-1"
                        />
                      </div>
                    </>
                  )}

                  {settings.aiProvider === 'gcp' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="gcp-key">GCP API Key</Label>
                        <div className="relative">
                          <Input
                            id="gcp-key"
                            type={showSecrets['gcp'] ? 'text' : 'password'}
                            value={settings.gcpApiKey}
                            onChange={(e) => updateSetting('gcpApiKey', e.target.value)}
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowSecret('gcp')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showSecrets['gcp'] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gcp-project">GCP Project ID</Label>
                        <Input
                          id="gcp-project"
                          type="text"
                          value={settings.gcpProjectId}
                          onChange={(e) => updateSetting('gcpProjectId', e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {settings.secretSource !== 'local' && (
                <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    APIキーは
                    {settings.secretSource === 'gcp_secret'
                      ? 'GCP Secret Manager'
                      : settings.secretSource === 'aws_secrets'
                        ? 'AWS Secrets Manager'
                        : settings.secretSource === 'azure_keyvault'
                          ? 'Azure Key Vault'
                          : settings.secretSource === 'onepassword'
                            ? '1Password'
                            : 'LastPass'}
                    から取得されます。 対象のシステムで適切なシークレット名を設定してください。
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="freee" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>freee API 設定</CardTitle>
              <CardDescription>会計freeeとの連携設定を行います</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="freee-client-id">Client ID</Label>
                <Input
                  id="freee-client-id"
                  type="text"
                  value={settings.freeeClientId}
                  onChange={(e) => updateSetting('freeeClientId', e.target.value)}
                  placeholder="freeeアプリのClient ID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="freee-client-secret">Client Secret</Label>
                <div className="relative">
                  <Input
                    id="freee-client-secret"
                    type={showSecrets['freee'] ? 'text' : 'password'}
                    value={settings.freeeClientSecret}
                    onChange={(e) => updateSetting('freeeClientSecret', e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => toggleShowSecret('freee')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showSecrets['freee'] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="freee-company-id">事業所ID</Label>
                <Input
                  id="freee-company-id"
                  type="text"
                  value={settings.freeeCompanyId}
                  onChange={(e) => updateSetting('freeeCompanyId', e.target.value)}
                  placeholder="freee事業所ID（数値）"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => (window.location.href = '/api/auth/freee')}
                >
                  freee認証
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompt" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>LLM分析プロンプト</CardTitle>
              <CardDescription>
                財務分析や記帳診断で使用するプロンプトをカスタマイズできます
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="analysis-prompt">分析用プロンプト</Label>
                <Textarea
                  id="analysis-prompt"
                  value={settings.analysisPrompt}
                  onChange={(e) => updateSetting('analysisPrompt', e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => updateSetting('analysisPrompt', defaultPrompt)}
                >
                  デフォルトに戻す
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tax" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>源泉徴収税設定</CardTitle>
              <CardDescription>源泉徴収税の納期設定を管理します</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="withholding-special-rule">納期の特例を利用する</Label>
                  <p className="text-sm text-gray-500">
                    給与の支払を受ける人数が常時10人未満の場合に利用可能
                  </p>
                </div>
                <Switch
                  id="withholding-special-rule"
                  checked={settings.taxSettings.withholdingSpecialRule}
                  onCheckedChange={(checked) => updateTaxSetting('withholdingSpecialRule', checked)}
                />
              </div>

              {settings.taxSettings.withholdingSpecialRule && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>納期の特例適用中</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-2 list-inside list-disc text-sm">
                      <li>1月〜6月分：7月10日納付</li>
                      <li>7月〜12月分：翌年1月20日納付</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="withholding-employee-count">
                  従業員数（源泉徴収税納期の特例判定用）
                </Label>
                <Input
                  id="withholding-employee-count"
                  type="number"
                  value={settings.taxSettings.withholdingEmployeeCount}
                  onChange={(e) =>
                    updateTaxSetting('withholdingEmployeeCount', parseInt(e.target.value) || 0)
                  }
                  className="w-40"
                />
                <p className="text-xs text-gray-500">
                  常時10人未満の場合、納期の特例が適用可能です
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax-filing-method">申告区分</Label>
                <Select
                  value={settings.taxSettings.taxFilingMethod || 'BLUE'}
                  onValueChange={(value) => updateTaxSetting('taxFilingMethod', value)}
                >
                  <SelectTrigger className="w-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BLUE">青色申告</SelectItem>
                    <SelectItem value="WHITE">白色申告</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveTaxSettings} disabled={taxSettingsSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {taxSettingsSaving ? '保存中...' : '税金設定を保存'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>消費税設定</CardTitle>
              <CardDescription>消費税に関する設定を行います</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="consumption-taxable">課税事業者</Label>
                  <p className="text-sm text-gray-500">免税事業者の場合はオフにしてください</p>
                </div>
                <Switch
                  id="consumption-taxable"
                  checked={settings.taxSettings.consumptionTaxable}
                  onCheckedChange={(checked) => updateTaxSetting('consumptionTaxable', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax-business-type">課税事業者区分</Label>
                <Select
                  value={settings.taxBusinessType || 'general'}
                  onValueChange={(value) =>
                    updateSetting('taxBusinessType', value as Settings['taxBusinessType'])
                  }
                >
                  <SelectTrigger className="w-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exempt">免税事業者</SelectItem>
                    <SelectItem value="simplified">簡易課税事業者</SelectItem>
                    <SelectItem value="general">一般課税事業者</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500">消費税の計算方法や申告要件が異なります</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>決算期設定</CardTitle>
              <CardDescription>決算月を設定します</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="fiscal-year-end">決算月</Label>
                <Select
                  value={settings.fiscalYearEndMonth?.toString() || '12'}
                  onValueChange={(value) => updateSetting('fiscalYearEndMonth', parseInt(value))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      { value: '1', label: '1月' },
                      { value: '2', label: '2月' },
                      { value: '3', label: '3月' },
                      { value: '4', label: '4月' },
                      { value: '5', label: '5月' },
                      { value: '6', label: '6月' },
                      { value: '7', label: '7月' },
                      { value: '8', label: '8月' },
                      { value: '9', label: '9月' },
                      { value: '10', label: '10月' },
                      { value: '11', label: '11月' },
                      { value: '12', label: '12月' },
                    ].map((month) => (
                      <SelectItem key={month.value} value={month.value}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500">年間税金スケジュールの生成に使用されます</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={fetchSettings}>
          <RefreshCw className="mr-2 h-4 w-4" />
          キャンセル
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? '保存中...' : '設定を保存'}
        </Button>
      </div>
    </AppLayout>
  )
}
