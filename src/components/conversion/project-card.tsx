'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ArrowRight } from 'lucide-react'
import type { ConversionProject } from '@/types/conversion'
import { StatusBadge } from './status-badge'

interface ProjectCardProps {
  project: ConversionProject
}

export function ProjectCard({ project }: ProjectCardProps) {
  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ja-JP')
  }

  return (
    <Card className="group relative transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{project.name}</CardTitle>
            <CardDescription className="mt-1">{project.targetStandard}への変換</CardDescription>
          </div>
          <StatusBadge status={project.status} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">期間</span>
            <span>
              {formatDate(project.periodStart)} - {formatDate(project.periodEnd)}
            </span>
          </div>

          {project.status === 'converting' && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">進捗</span>
                <span>{Math.round(project.progress)}%</span>
              </div>
              <Progress value={project.progress} />
            </div>
          )}

          {project.statistics && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded bg-muted p-2">
                <div className="font-medium">{project.statistics.mappedAccounts}</div>
                <div className="text-muted-foreground">マッピング</div>
              </div>
              <div className="rounded bg-muted p-2">
                <div className="font-medium">{project.statistics.totalJournals}</div>
                <div className="text-muted-foreground">仕訳</div>
              </div>
              <div className="rounded bg-muted p-2">
                <div className="font-medium">{project.statistics.adjustingEntryCount}</div>
                <div className="text-muted-foreground">調整</div>
              </div>
            </div>
          )}

          <Link href={`/conversion/projects/${project.id}`}>
            <Button
              variant="outline"
              className="w-full group-hover:bg-primary group-hover:text-primary-foreground"
            >
              詳細を見る
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
