import { ReactNode } from 'react'
import Link from 'next/link'

interface SettingsLayoutProps {
  children: ReactNode
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const navItems = [
    { href: '/settings/freee', label: 'freee連携' },
    { href: '/settings/ai', label: 'AI API' },
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-6xl py-8">
        <h1 className="mb-8 text-3xl font-bold">設定</h1>

        <div className="flex gap-8">
          <nav className="w-48 flex-shrink-0">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded px-4 py-2 transition-all hover:bg-white hover:shadow-sm"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <main className="flex-1 rounded-lg bg-white shadow">{children}</main>
        </div>
      </div>
    </div>
  )
}
