'use client'

import { useState } from 'react'
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
  Menu,
  X,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface SidebarProps {
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
  { key: 'budgets', href: '/budgets', icon: Wallet },
  { key: 'settings', href: '/settings', icon: Settings },
]

export function Sidebar({ user, locale }: SidebarProps) {
  const t = useTranslations('navigation')
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = `/${locale}/login`
  }

  const NavLinks = () => (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => {
        const Icon = item.icon
        const href = `/${locale}${item.href}`
        const isActive = pathname.startsWith(href)

        return (
          <Link
            key={item.key}
            href={href}
            onClick={() => setIsOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {t(item.key)}
          </Link>
        )
      })}
    </nav>
  )

  const UserMenu = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2 px-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start text-left">
            <span className="text-sm font-medium">{user.name}</span>
            <span className="text-xs text-muted-foreground">{user.role}</span>
          </div>
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
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
  )

  return (
    <>
      {/* Mobile header */}
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4 lg:hidden">
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-lg font-bold">freee_audit</span>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <NavLinks />
            <div className="mt-auto pt-4">
              <UserMenu />
            </div>
          </SheetContent>
        </Sheet>
        <span className="font-semibold">freee_audit</span>
      </header>

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r bg-background lg:flex">
        <div className="flex h-14 items-center border-b px-4">
          <span className="text-lg font-bold">freee_audit</span>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <NavLinks />
        </div>
        <div className="border-t p-4">
          <UserMenu />
        </div>
      </aside>
    </>
  )
}
