'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'

interface User {
  id: string
  email: string
  name: string
  role: string
  companyId: string | null
}

export default function AuthenticatedLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me')
        const data = await response.json()

        if (data.success && data.user) {
          setUser(data.user)
        } else {
          router.push(`/${locale}/login`)
        }
      } catch {
        router.push(`/${locale}/login`)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [locale, router, pathname])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <Sidebar
        user={{
          name: user.name,
          email: user.email,
          role: user.role,
        }}
        locale={locale}
      />
      <main className="min-h-screen lg:pl-64">
        <div className="pt-14 lg:pt-0">
          <div className="p-4 lg:p-6">{children}</div>
        </div>
      </main>
    </div>
  )
}
