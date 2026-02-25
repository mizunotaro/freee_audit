import { NextResponse } from 'next/server'
import { healthCheck } from '@/lib/db'

export async function GET() {
  const dbHealthy = await healthCheck()

  const status = {
    status: dbHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: dbHealthy ? 'ok' : 'error',
    },
  }

  return NextResponse.json(status, {
    status: dbHealthy ? 200 : 503,
  })
}
