'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, Loader2 } from 'lucide-react'
import { ConversionLayout } from '@/components/conversion/layout'
import { ProjectCard } from '@/components/conversion/project-card'
import type { ConversionProject } from '@/types/conversion'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ConversionProject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch('/api/conversion/projects')
        if (res.ok) {
          const data = await res.json()
          setProjects(data.data)
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchProjects()
  }, [])

  if (loading) {
    return (
      <ConversionLayout companyId="">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </ConversionLayout>
    )
  }

  return (
    <ConversionLayout companyId="">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">変換プロジェクト</h1>
            <p className="text-muted-foreground">会計基準変換プロジェクトを作成・管理</p>
          </div>
          <Link href="/conversion/projects/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              新規プロジェクト
            </Button>
          </Link>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <h3 className="text-lg font-semibold">プロジェクトがありません</h3>
            <p className="mt-1 text-muted-foreground">
              最初の変換プロジェクトを作成して始めましょう
            </p>
            <Link href="/conversion/projects/new">
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                プロジェクトを作成
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </ConversionLayout>
  )
}
