'use client'

import { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileSpreadsheet, ArrowRightLeft, Settings, BarChart3, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConversionLayoutProps {
  children: ReactNode
  companyId: string
}

const navigation = [
  {
    name: 'ダッシュボード',
    href: '/conversion',
    icon: BarChart3,
  },
  {
    name: '勘定科目表',
    href: '/conversion/coa',
    icon: FileSpreadsheet,
  },
  {
    name: '変換プロジェクト',
    href: '/conversion/projects',
    icon: ArrowRightLeft,
  },
  {
    name: 'マッピング',
    href: '/conversion/mappings',
    icon: FileText,
  },
  {
    name: '設定',
    href: '/conversion/settings',
    icon: Settings,
  },
]

export function ConversionLayout({ children, companyId: _companyId }: ConversionLayoutProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <aside className="min-h-screen w-64 border-r bg-card">
          <div className="border-b p-4">
            <Link href="/conversion" className="flex items-center gap-2">
              <ArrowRightLeft className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">会計基準変換</span>
            </Link>
          </div>
          <nav className="space-y-1 p-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              )
            })}
          </nav>
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
