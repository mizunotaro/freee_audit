'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  FileCheck,
  TrendingUp,
  ArrowLeftRight,
  Sparkles,
  BarChart3,
  Wallet,
  Calculator,
  Users,
  Settings,
  FlaskConical,
  DollarSign,
  Clock,
  Building2,
} from 'lucide-react'

interface QuickActionProps {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  color?: string
}

interface DashboardData {
  company: {
    name: string
    stage: string
    leadCompound: string
    developmentPhase: string
  }
  kpis: {
    runway: number
    monthlyBurnRate: number
    cashBalance: number
    rdSpendYtd: number
    externalRdRatio: number
  }
  milestones: Array<{
    milestone: string
    date: string
    status: string
  }>
}

function QuickAction({
  href,
  icon: Icon,
  label,
  description,
  color = 'text-primary',
}: QuickActionProps) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-lg border p-4 transition-all hover:bg-muted/50 hover:shadow-sm"
    >
      <div className={`rounded-lg bg-muted p-2 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="font-medium">{label}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
    </Link>
  )
}

function formatCurrency(value: number): string {
  if (value >= 1000000000) {
    return `¥${(value / 1000000000).toFixed(1)}B`
  }
  if (value >= 1000000) {
    return `¥${(value / 1000000).toFixed(0)}M`
  }
  return `¥${value.toLocaleString()}`
}

export default function DashboardPage() {
  const t = useTranslations('navigation')
  const tKpi = useTranslations('kpi')
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const response = await fetch('/api/dashboard')
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

  const quickActions: QuickActionProps[] = [
    {
      href: '/journal-proposal',
      icon: Sparkles,
      label: t('journalProposal'),
      description: 'AI journal entry suggestions',
      color: 'text-pink-500',
    },
    {
      href: '/reports/monthly',
      icon: BarChart3,
      label: t('monthlyReport'),
      description: 'Monthly closing reports',
      color: 'text-cyan-500',
    },
    {
      href: '/reports/periodic',
      icon: TrendingUp,
      label: t('periodicComparison'),
      description: 'Multi-period trend analysis',
      color: 'text-emerald-500',
    },
    {
      href: '/reports/budget',
      icon: Wallet,
      label: t('budget'),
      description: 'Budget vs actual management',
      color: 'text-amber-500',
    },
    {
      href: '/board',
      icon: Users,
      label: t('board'),
      description: 'Board meeting materials',
      color: 'text-indigo-500',
    },
    {
      href: '/audit/journals',
      icon: FileCheck,
      label: t('audit'),
      description: 'Journal entry audit',
      color: 'text-blue-500',
    },
    {
      href: '/valuation',
      icon: TrendingUp,
      label: t('valuation'),
      description: 'DCF & comparable company analysis',
      color: 'text-green-500',
    },
    {
      href: '/conversion/projects',
      icon: ArrowLeftRight,
      label: t('conversion'),
      description: 'Accounting standard conversion',
      color: 'text-purple-500',
    },
    {
      href: '/tax',
      icon: Calculator,
      label: t('tax'),
      description: 'Tax schedule management',
      color: 'text-red-500',
    },
    {
      href: '/settings',
      icon: Settings,
      label: t('settings'),
      description: 'System settings',
      color: 'text-gray-500',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('dashboard')}</h1>
          <p className="text-muted-foreground">
            {data?.company?.name || 'Sample Therapeutics株式会社'}
            {data?.company?.stage && (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {data.company.stage}
              </span>
            )}
          </p>
        </div>
        {data?.company?.leadCompound && (
          <Card className="hidden md:block">
            <CardContent className="flex items-center gap-3 p-4">
              <FlaskConical className="h-8 w-8 text-primary" />
              <div>
                <div className="text-sm font-medium">Lead Compound</div>
                <div className="text-lg font-bold">{data.company.leadCompound}</div>
                <div className="text-xs text-muted-foreground">{data.company.developmentPhase}</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{tKpi('runway')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-2xl font-bold">--</div>
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {data?.kpis?.runway || 24} {tKpi('months')}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Based on current burn rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Burn Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-2xl font-bold">--</div>
            ) : (
              <div className="text-2xl font-bold text-amber-600">
                {formatCurrency(data?.kpis?.monthlyBurnRate || 165000000)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Average monthly spend</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-2xl font-bold">--</div>
            ) : (
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(data?.kpis?.cashBalance || 405000000)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">As of end of period</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">R&D Spend YTD</CardTitle>
            <FlaskConical className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-2xl font-bold">--</div>
            ) : (
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(data?.kpis?.rdSpendYtd || 1015000000)}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              External: {((data?.kpis?.externalRdRatio || 0.532) * 100).toFixed(0)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Key Milestones
            </CardTitle>
            <CardDescription>Development pipeline progress</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data?.milestones?.slice(0, 5).map((m, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        m.status === 'completed'
                          ? 'bg-green-500'
                          : m.status === 'in_progress'
                            ? 'bg-blue-500'
                            : 'bg-gray-300'
                      }`}
                    />
                    <span className="text-sm">{m.milestone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{m.date}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        m.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : m.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {m.status === 'completed'
                        ? '完了'
                        : m.status === 'in_progress'
                          ? '進行中'
                          : '計画'}
                    </span>
                  </div>
                </div>
              )) || (
                <>
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm">Series A Closing</span>
                    </div>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      完了
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-green-500" />
                      <span className="text-sm">Lead Compound Selection</span>
                    </div>
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                      完了
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="text-sm">GLP Toxicology Study</span>
                    </div>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                      進行中
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-gray-300" />
                      <span className="text-sm">IND Submission</span>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      計画
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-gray-300" />
                      <span className="text-sm">Phase 1 Trial Start</span>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      計画
                    </span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Peer Comparison
            </CardTitle>
            <CardDescription>Biotech peer company benchmarks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground">
                <span>Company</span>
                <span className="text-right">Stage</span>
                <span className="text-right">Runway</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 p-3">
                <span className="text-sm font-medium">Sample Therapeutics</span>
                <span className="text-xs text-primary">IND Prep</span>
                <span className="text-sm font-bold text-primary">24 mo</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <span className="text-sm">Oncolyze Bio</span>
                <span className="text-xs text-muted-foreground">Phase 1</span>
                <span className="text-sm">20 mo</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <span className="text-sm">ImmunoTarget</span>
                <span className="text-xs text-muted-foreground">Phase 2</span>
                <span className="text-sm">16 mo</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <span className="text-sm">ProteinRx</span>
                <span className="text-xs text-muted-foreground">IND</span>
                <span className="text-sm">18 mo</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Navigate to key features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {quickActions.map((action) => (
              <QuickAction key={action.href} {...action} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
