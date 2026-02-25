'use client'

import { useState, useEffect } from 'react'

type AIProvider = 'openai' | 'gemini' | 'claude'

interface AIConfig {
  provider: AIProvider
  apiKey: string
  model?: string
}

const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  openai: ['gpt-4-turbo-preview', 'gpt-4', 'gpt-3.5-turbo'],
  gemini: ['gemini-pro', 'gemini-pro-vision'],
  claude: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
}

export function AiSettings() {
  const [config, setConfig] = useState<AIConfig>({
    provider: 'openai',
    apiKey: '',
    model: '',
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/settings/ai')
      if (response.ok) {
        const data = await response.json()
        if (data.config) {
          setConfig({
            provider: data.config.provider || 'openai',
            apiKey: '',
            model: data.config.model || '',
          })
        }
      }
    } catch (err) {
      console.error('Failed to load config:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })

      if (response.ok) {
        setSuccess('設定を保存しました')
        setConfig((prev) => ({ ...prev, apiKey: '' }))
      } else {
        const data = await response.json()
        setError(data.error || '保存に失敗しました')
      }
    } catch (err) {
      setError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleProviderChange = (provider: AIProvider) => {
    setConfig({
      provider,
      apiKey: '',
      model: PROVIDER_MODELS[provider][0],
    })
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="mb-4 h-8 w-1/4 rounded bg-gray-200"></div>
          <div className="h-64 rounded bg-gray-200"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h2 className="mb-6 text-2xl font-bold">AI API設定</h2>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
          {success}
          <button
            onClick={() => setSuccess(null)}
            className="ml-2 text-green-500 hover:text-green-700"
          >
            ×
          </button>
        </div>
      )}

      <div className="mb-6 rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">AIプロバイダー選択</h3>

        <div className="mb-6 grid grid-cols-3 gap-4">
          {(['openai', 'gemini', 'claude'] as AIProvider[]).map((provider) => (
            <button
              key={provider}
              onClick={() => handleProviderChange(provider)}
              className={`rounded-lg border-2 p-4 transition-all ${
                config.provider === provider
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-semibold capitalize">{provider}</div>
              <div className="mt-1 text-xs text-gray-500">
                {provider === 'openai' && 'GPT-4, GPT-3.5'}
                {provider === 'gemini' && 'Gemini Pro'}
                {provider === 'claude' && 'Claude 3'}
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">APIキー</label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={config.apiKey}
                onChange={(e) => setConfig((prev) => ({ ...prev, apiKey: e.target.value }))}
                placeholder="sk-..."
                className="w-full rounded-lg border px-4 py-2 pr-20"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-500 hover:text-gray-700"
              >
                {showApiKey ? '隠す' : '表示'}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">APIキーは暗号化されて保存されます</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">モデル</label>
            <select
              value={config.model}
              onChange={(e) => setConfig((prev) => ({ ...prev, model: e.target.value }))}
              className="w-full rounded-lg border px-4 py-2"
            >
              {PROVIDER_MODELS[config.provider].map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary-500 hover:bg-primary-600 rounded px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-gray-50 p-6">
        <h3 className="mb-4 text-lg font-semibold">使用方法</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>• 証憑分析: アップロードされた証憑の自動読み取り</li>
          <li>• 仕訳監査: 勘定科目の妥当性チェック</li>
          <li>• レポート生成: 月次レポートの要約作成</li>
        </ul>
      </div>
    </div>
  )
}
