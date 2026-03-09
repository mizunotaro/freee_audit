'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface UserInfo {
  id: string
  email: string
  name: string
  role: string
}

export default function InvestorPortalPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me')
        const data = await response.json()

        if (!data.success || !data.user) {
          router.push('/login')
          return
        }

        if (data.user.role !== 'INVESTOR') {
          router.push('/dashboard')
          return
        }

        setUser(data.user)

        await fetch('/api/investor/access-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'view_portal' }),
        })
      } catch {
        setError('Failed to authenticate')
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Investor Portal</h1>
        <p className="text-muted-foreground">Welcome, {user?.name}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Financial Reports</CardTitle>
            <CardDescription>View company financial reports</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Access monthly and annual financial reports
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>KPI Dashboard</CardTitle>
            <CardDescription>Key performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Track business metrics and performance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Board Reports</CardTitle>
            <CardDescription>Board meeting materials</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Review board reports and meeting minutes
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
