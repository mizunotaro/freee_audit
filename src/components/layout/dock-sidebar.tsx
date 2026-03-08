'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  FileCheck,
  BarChart3,
  Wallet,
  Settings,
  LogOut,
  Shield,
  Calculator,
  Receipt,
  Package,
  TrendingUp,
  Users,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface DockSidebarProps {
  user: {
    name: string
    email: string
    role: string
  }
  locale: string
}

const navItems = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'audit', href: '/audit/journals', icon: FileCheck },
  { key: 'reports', href: '/reports', icon: BarChart3 },
  { key: 'periodicReports', href: '/reports/periodic', icon: TrendingUp },
  { key: 'budgets', href: '/budgets', icon: Wallet },
  { key: 'kpiSettings', href: '/settings/kpi', icon: BarChart3 },
  { key: 'inventory', href: '/inventory', icon: Package },
  { key: 'tax', href: '/tax', icon: Receipt },
  { key: 'board', href: '/board', icon: Users },
  { key: 'businessReport', href: '/reports/business', icon: FileText },
  { key: 'socialInsurance', href: '/social-insurance', icon: Shield },
  { key: 'deferredAccrual', href: '/deferred-accrual', icon: Calculator },
  { key: 'settings', href: '/settings', icon: Settings },
]

export function DockSidebar({ user, locale }: DockSidebarProps) {
  const t = useTranslations('navigation')
  const pathname = usePathname()
  const [isExpanded, setIsExpanded] = useState(false)
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }
    setIsExpanded(true)
  }

  const handleMouseLeave = () => {
    if (isPinned) return
    hideTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false)
    }, 1000)
  }

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current)
      }
    }
  }, [])

  const handleLogout = async () => {
    window.location.href = `/${locale}/login`
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r bg-background transition-all duration-300 ease-in-out lg:flex',
          isExpanded ? 'w-[200px]' : 'w-16'
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex h-14 items-center justify-center border-b px-2">
          <span
            className={cn(
              'font-bold transition-opacity duration-200',
              isExpanded ? 'opacity-100' : 'w-0 opacity-0'
            )}
          >
            freee_audit
          </span>
          {!isExpanded && <span className="text-xl font-bold">F</span>}
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const href = `/${locale}${item.href}`
            const isActive = pathname.startsWith(href)

            return (
              <Tooltip key={item.key}>
                <TooltipTrigger asChild>
                  <Link
                    href={href}
                    className={cn(
                      'relative flex items-center gap-3 px-4 py-3 transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      isActive && 'bg-accent/50'
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r bg-primary" />
                    )}
                    <Icon className="h-5 w-5 shrink-0" />
                    <span
                      className={cn(
                        'whitespace-nowrap transition-opacity duration-200',
                        isExpanded ? 'opacity-100' : 'w-0 overflow-hidden opacity-0'
                      )}
                    >
                      {t(item.key)}
                    </span>
                  </Link>
                </TooltipTrigger>
                {!isExpanded && (
                  <TooltipContent side="right" className="font-medium">
                    {t(item.key)}
                  </TooltipContent>
                )}
              </Tooltip>
            )
          })}
        </nav>

        <div className="border-t p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  'w-full gap-2',
                  isExpanded ? 'justify-start px-2' : 'justify-center px-0'
                )}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback>
                    {user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isExpanded && (
                  <div className="flex flex-col items-start text-left">
                    <span className="text-sm font-medium">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.role}</span>
                  </div>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isExpanded ? 'end' : 'start'} className="w-56">
              <DropdownMenuItem asChild>
                <Link href={`/${locale}/settings`}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  )
}
