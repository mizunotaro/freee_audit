'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Settings,
  Home,
  FileText,
  DollarSign,
  BarChart3,
  ClipboardCheck,
  Receipt,
  Users,
  Shield,
  Calculator,
  FileCheck,
  Sparkles,
  TrendingUp,
  FileAudit,
  FileSpreadsheet,
  FileCog,
  LayoutDashboard,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
  title?: string
}

const navItems = [
  { href: '/reports/monthly', label: '月次レポート', icon: BarChart3 },
  { href: '/reports/periodic', label: '多期間レポート', icon: TrendingUp },
  { href: '/budgets', label: '予実管理', icon: DollarSign },
  { href: '/reports/kpi', label: '経営指標', icon: ClipboardCheck },
  { href: '/settings/kpi', label: 'KPI設定', icon: Settings },
  { href: '/cashflow', label: '資金繰り表', icon: Receipt },
  { href: '/tax', label: '税金管理', icon: FileText },
  { href: '/board', label: '取締役会議議室', icon: Users },
  { href: '/audit/journal', label: '記帳診断', icon: FileAudit },
  { href: '/audit/expense', label: '経費監査', icon: Receipt },
  { href: '/audit/basis', label: '発生主義チェック', icon: FileCheck },
  { href: '/settings', label: '設定', icon: Settings },
]

export function AppLayout({ children, title }: AppLayoutProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white shadow dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              >
                <Home className="h-5 w-5" />
                <span className="ml-2 text-lg font-bold">freee監査システム</span>
              </Link>
              {title && <span className="text-gray-400 dark:text-gray-500">/ {title}</span>}
            </div>
            <div className="flex items-center space-x-4">
              <nav className="hidden space-x-1 md:flex">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                      )}
                    >
                      <Icon className="mr-1.5 h-4 w-4" />
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
              <Link
                href="/settings"
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                <Settings className="h-5 w-5" />
              </Link>
            </div>
          </div>
          <nav className="mt-4 flex flex-wrap gap-2 md:hidden">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center rounded-md px-3 py-2 text-sm font-medium',
                    isActive
                      ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  )}
                >
                  <Icon className="mr-1.5 h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
