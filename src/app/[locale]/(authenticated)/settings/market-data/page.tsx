'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Database,
  Loader2,
  CheckCircle,
  XCircle,
  Settings,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'

interface Provider {
  id: string
  provider: string
  enabled: boolean
  priority: number
  lastSyncAt: string | null
  lastError: string | null
  createdAt: string
  updatedAt: string
}

const PROVIDER_INFO: Record<string, { name: string; description: string; url: string }> = {
  jquants: {
    name: 'J-Quants API',
    description: 'JPX Financial Research - Japanese stock market data',
    url: 'https://jquants.com/',
  },
  edinet: {
    name: 'EDINET API',
    description: 'Financial Services Agency - Financial documents (XBRL)',
    url: 'https://disclosure.edinet-fsa.go.jp/',
  },
}

export default function MarketDataProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([])
  const [_isLoading, setIsLoading] = useState(true)
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})

  const [jquantsConfig, setJquantsConfig] = useState({
    email: '',
    password: '',
  })

  const fetchProviders = useCallback(async () => {
    try {
      const response = await fetch('/api/settings/market-data/providers')
      const data = await response.json()
      if (data.success) {
        setProviders(data.data)
      }
    } catch {
      toast.error('Failed to fetch providers')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProviders()
  }, [fetchProviders])

  const handleToggleProvider = async (providerId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/settings/market-data/providers/${providerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      const data = await response.json()
      if (data.success) {
        toast.success(enabled ? 'Provider enabled' : 'Provider disabled')
        fetchProviders()
      } else {
        toast.error(data.error || 'Failed to update provider')
      }
    } catch {
      toast.error('Failed to update provider')
    }
  }

  const handleTestConnection = async (providerName: string) => {
    setIsTesting(providerName)
    try {
      const response = await fetch(`/api/settings/market-data/${providerName}/test`, {
        method: 'POST',
      })
      const data = await response.json()
      setTestResults((prev) => ({
        ...prev,
        [providerName]: data.success && data.data?.connected,
      }))
      if (data.success && data.data?.connected) {
        toast.success(`${PROVIDER_INFO[providerName]?.name} connection successful`)
      } else {
        toast.error(data.error || 'Connection failed')
      }
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [providerName]: false,
      }))
      toast.error('Connection test failed')
    } finally {
      setIsTesting(null)
    }
  }

  const handleSaveJquantsConfig = async () => {
    try {
      const response = await fetch('/api/settings/market-data/jquants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jquantsConfig),
      })
      const data = await response.json()
      if (data.success) {
        toast.success('J-Quants configuration saved')
        setIsConfigDialogOpen(false)
        fetchProviders()
      } else {
        toast.error(data.error || 'Failed to save configuration')
      }
    } catch {
      toast.error('Failed to save configuration')
    }
  }

  const openConfigDialog = (providerName: string) => {
    setSelectedProvider(providerName)
    if (providerName === 'jquants') {
      setJquantsConfig({ email: '', password: '' })
    }
    setIsConfigDialogOpen(true)
  }

  const getProviderStatus = (providerName: string) => {
    const provider = providers.find((p) => p.provider === providerName)
    if (!provider) return 'not_configured'
    if (!provider.enabled) return 'disabled'
    if (provider.lastError) return 'error'
    return 'active'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Active</Badge>
      case 'disabled':
        return <Badge variant="secondary">Disabled</Badge>
      case 'error':
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="outline">Not Configured</Badge>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Market Data Providers</h1>
          <p className="text-muted-foreground">
            Configure external data sources for financial information
          </p>
        </div>
        <Button variant="outline" onClick={fetchProviders}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4">
        {Object.entries(PROVIDER_INFO).map(([key, info]) => {
          const status = getProviderStatus(key)
          const provider = providers.find((p) => p.provider === key)

          return (
            <Card key={key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-lg">{info.name}</CardTitle>
                      <CardDescription>{info.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(status)}
                    <a
                      href={info.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {provider?.lastSyncAt ? (
                      <span>Last sync: {new Date(provider.lastSyncAt).toLocaleString()}</span>
                    ) : (
                      <span>Never synced</span>
                    )}
                    {provider?.lastError && (
                      <p className="mt-1 text-destructive">Error: {provider.lastError}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection(key)}
                      disabled={isTesting === key || status === 'not_configured'}
                    >
                      {isTesting === key ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : testResults[key] !== undefined ? (
                        testResults[key] ? (
                          <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="mr-2 h-4 w-4 text-destructive" />
                        )
                      ) : null}
                      Test Connection
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openConfigDialog(key)}>
                      <Settings className="mr-2 h-4 w-4" />
                      Configure
                    </Button>
                    {provider && (
                      <Switch
                        checked={provider.enabled}
                        onCheckedChange={(checked) => handleToggleProvider(provider.id, checked)}
                        disabled={status === 'not_configured'}
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium">J-Quants API</h4>
            <p className="text-sm text-muted-foreground">
              Register at jquants.com to get access. Use your registered email and password.
              The free plan provides daily stock prices and financial statements for TSE-listed companies.
            </p>
          </div>
          <div>
            <h4 className="font-medium">EDINET API</h4>
            <p className="text-sm text-muted-foreground">
              No registration required. The EDINET API provides access to financial documents (XBRL format)
              submitted to the Financial Services Agency. Rate limits apply.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/50 p-4">
            <h4 className="mb-2 font-medium">Environment Variables (Alternative)</h4>
            <p className="mb-2 text-sm text-muted-foreground">
              You can also configure providers via environment variables:
            </p>
            <pre className="text-xs">
{`JQUANTS_EMAIL=your-email@example.com
JQUANTS_PASSWORD=your-password
JQUANTS_ENABLED=true

EDINET_ENABLED=true`}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Configure {selectedProvider && PROVIDER_INFO[selectedProvider]?.name}
            </DialogTitle>
            <DialogDescription>
              Enter your credentials for this provider
            </DialogDescription>
          </DialogHeader>

          {selectedProvider === 'jquants' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="jquants-email">Email</Label>
                <Input
                  id="jquants-email"
                  type="email"
                  value={jquantsConfig.email}
                  onChange={(e) => setJquantsConfig({ ...jquantsConfig, email: e.target.value })}
                  placeholder="your-email@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jquants-password">Password</Label>
                <Input
                  id="jquants-password"
                  type="password"
                  value={jquantsConfig.password}
                  onChange={(e) => setJquantsConfig({ ...jquantsConfig, password: e.target.value })}
                  placeholder="Your J-Quants password"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Credentials are encrypted and stored securely. They are only used to authenticate
                with J-Quants API.
              </p>
            </div>
          )}

          {selectedProvider === 'edinet' && (
            <div className="py-4">
              <p className="text-muted-foreground">
                EDINET API does not require authentication. Simply enable the provider to start using it.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigDialogOpen(false)}>
              Cancel
            </Button>
            {selectedProvider === 'jquants' && (
              <Button onClick={handleSaveJquantsConfig}>Save Configuration</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
