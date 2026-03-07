'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, FileCheck, BarChart3, Wallet, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BottomNavigationProps {
  locale: string
}

const mobileNavItems = [
  { key: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { key: 'reports', href: '/reports', icon: BarChart3 },
  { key: 'audit', href: '/audit/journals', icon: FileCheck },
  { key: 'budgets', href: '/budgets', icon: Wallet },
  { key: 'settings', href: '/settings', icon: Settings },
]

export function BottomNavigation({ locale }: BottomNavigationProps) {
  const t = useTranslations('navigation')
  const pathname = usePathname()

  return (
    <nav className="safe-area-pb fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t bg-background lg:hidden">
      {mobileNavItems.map((item) => {
        const Icon = item.icon
        const href = `/${locale}${item.href}`
        const isActive = pathname.startsWith(href)

        return (
          <Link
            key={item.key}
            href={href}
            className={cn(
              'flex flex-col items-center justify-center gap-1 px-3 py-2',
              'transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs">{t(item.key)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
