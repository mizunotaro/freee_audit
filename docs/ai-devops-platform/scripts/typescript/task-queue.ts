/**
 * Task Queue Manager for AI-DevOps-Platform Central Hub
 *
 * Manages task collection, prioritization, and execution across multiple repositories.
 * Ensures GLM5 session limits are respected.
 *
 * @see docs/ARCHITECTURE.md - Central Hub Architecture
 */

import { Result, AppError, ErrorCodes, createError } from './result'

export interface Repository {
  name: string
  enabled: boolean
  priority: number
  labels: {
    task: string
    inProgress: string
    completed: string
    blocked: string
    autoMerge: string
    doNotMerge: string
  }
  qualityGates: Record<
    string,
    {
      command: string
      timeout: number
      required: boolean
    }
  >
  constraints: {
    maxFileSizeKB: number
    maxFilesPerTask: number
    forbiddenPaths: string[]
    requiredReviewers: string[]
  }
}

export interface Task {
  id: string
  repository: string
  issueNumber: number
  issueTitle: string
  issueBody: string
  labels: string[]
  priority: 'critical' | 'high' | 'medium' | 'low'
  createdAt: Date
  ageHours: number
  dependencies: number[]
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed'
  retryCount: number
  lastError?: string | undefined
}

export interface TaskQueueConfig {
  maxQueueSize: number
  scanIntervalMinutes: number
  taskTimeoutMinutes: number
  retryAttempts: number
  priorityWeights: {
    critical: number
    high: number
    medium: number
    low: number
  }
  ageBonusPerHour: number
  maxAgeBonus: number
}

export const DEFAULT_TASK_QUEUE_CONFIG: TaskQueueConfig = {
  maxQueueSize: 100,
  scanIntervalMinutes: 15,
  taskTimeoutMinutes: 30,
  retryAttempts: 3,
  priorityWeights: {
    critical: 1000,
    high: 100,
    medium: 10,
    low: 1,
  },
  ageBonusPerHour: 1,
  maxAgeBonus: 48,
}

export class TaskQueue {
  private queue: Task[] = []
  private running: Map<string, Task> = new Map()
  private config: TaskQueueConfig
  private repositories: Map<string, Repository> = new Map()

  constructor(config: Partial<TaskQueueConfig> = {}) {
    this.config = { ...DEFAULT_TASK_QUEUE_CONFIG, ...config }
  }

  registerRepository(repo: Repository): void {
    this.repositories.set(repo.name, repo)
  }

  addTask(task: Task): Result<void, AppError> {
    if (this.queue.length >= this.config.maxQueueSize) {
      return Result.err(
        createError(ErrorCodes.RESOURCE_CONFLICT, 'Task queue is full', {
          maxQueueSize: this.config.maxQueueSize,
        })
      )
    }

    const existingIndex = this.queue.findIndex(
      (t) => t.repository === task.repository && t.issueNumber === task.issueNumber
    )

    if (existingIndex >= 0) {
      return Result.err(
        createError(ErrorCodes.RESOURCE_CONFLICT, 'Task already exists in queue', {
          repository: task.repository,
          issueNumber: task.issueNumber,
        })
      )
    }

    this.queue.push(task)
    this.sortQueue()
    return Result.ok(undefined)
  }

  removeTask(repository: string, issueNumber: number): boolean {
    const index = this.queue.findIndex(
      (t) => t.repository === repository && t.issueNumber === issueNumber
    )
    if (index >= 0) {
      this.queue.splice(index, 1)
      return true
    }
    return false
  }

  getNextTask(maxConcurrency: number): Task | null {
    if (this.running.size >= maxConcurrency) {
      return null
    }

    const pendingTask = this.queue.find((t) => t.status === 'pending' && this.areDependenciesMet(t))

    if (!pendingTask) {
      return null
    }

    pendingTask.status = 'running'
    this.running.set(pendingTask.id, pendingTask)
    return pendingTask
  }

  completeTask(taskId: string, success: boolean, error?: string): void {
    const task = this.running.get(taskId)
    if (!task) return

    this.running.delete(taskId)
    this.removeTask(task.repository, task.issueNumber)

    if (!success && task.retryCount < this.config.retryAttempts) {
      task.retryCount++
      task.status = 'pending'
      task.lastError = error
      this.queue.push(task)
      this.sortQueue()
    }
  }

  calculateScore(task: Task): number {
    const priorityWeight = this.config.priorityWeights[task.priority]
    const ageBonus = Math.min(task.ageHours * this.config.ageBonusPerHour, this.config.maxAgeBonus)

    let score = priorityWeight + ageBonus

    if (!this.areDependenciesMet(task)) {
      score = 0
    }

    return score
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      const scoreA = this.calculateScore(a)
      const scoreB = this.calculateScore(b)
      return scoreB - scoreA
    })
  }

  private areDependenciesMet(task: Task): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true
    }

    for (const depIssueNumber of task.dependencies) {
      const depTask = this.queue.find(
        (t) => t.repository === task.repository && t.issueNumber === depIssueNumber
      )
      if (depTask && depTask.status !== 'completed') {
        return false
      }
    }

    return true
  }

  getQueueLength(): number {
    return this.queue.length
  }

  getRunningCount(): number {
    return this.running.size
  }

  getQueueStatus(): {
    pending: number
    running: number
    queued: Task[]
    runningTasks: Task[]
  } {
    return {
      pending: this.queue.filter((t) => t.status === 'pending').length,
      running: this.running.size,
      queued: this.queue.map((t) => ({ ...t })),
      runningTasks: Array.from(this.running.values()),
    }
  }
}

export function parsePriorityFromLabels(labels: string[]): Task['priority'] {
  if (labels.includes('priority-critical')) return 'critical'
  if (labels.includes('priority-high')) return 'high'
  if (labels.includes('priority-low')) return 'low'
  return 'medium'
}

export function parseDependenciesFromBody(body: string): number[] {
  const depPattern = /(?:depends[_-]?on|依存|前提)[:\s]*#?(\d+)/gi
  const dependencies: number[] = []
  let match

  while ((match = depPattern.exec(body)) !== null) {
    const issueNum = parseInt(match[1] ?? '', 10)
    if (!isNaN(issueNum) && !dependencies.includes(issueNum)) {
      dependencies.push(issueNum)
    }
  }

  return dependencies
}

export function createTaskFromIssue(
  repository: string,
  issue: {
    number: number
    title: string
    body: string
    labels: string[]
    createdAt: string
  }
): Task {
  const createdAt = new Date(issue.createdAt)
  const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60)

  return {
    id: `${repository}#${issue.number}`,
    repository,
    issueNumber: issue.number,
    issueTitle: issue.title,
    issueBody: issue.body || '',
    labels: issue.labels as string[],
    priority: parsePriorityFromLabels(issue.labels as string[]),
    createdAt,
    ageHours,
    dependencies: parseDependenciesFromBody(issue.body || ''),
    status: 'pending',
    retryCount: 0,
  }
}

export function getCurrentMaxConcurrency(scheduleConfig: {
  defaultConcurrency: number
  schedules: Array<{
    cron: string
    timezone: string
    maxConcurrency: number
  }>
}): number {
  const now = new Date()

  for (const schedule of scheduleConfig.schedules) {
    if (matchesCron(now, schedule.cron, schedule.timezone)) {
      return schedule.maxConcurrency
    }
  }

  return scheduleConfig.defaultConcurrency
}

function matchesCron(date: Date, cron: string, timezone: string): boolean {
  const cronParts = cron.split(' ')
  if (cronParts.length !== 5) return false

  const [minute, hour, dayOfMonth, month, dayOfWeek] = cronParts

  const targetDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }))

  const fields = {
    minute: targetDate.getMinutes(),
    hour: targetDate.getHours(),
    dayOfMonth: targetDate.getDate(),
    month: targetDate.getMonth() + 1,
    dayOfWeek: targetDate.getDay(),
  }

  return (
    matchesCronField(fields.minute, minute ?? '*') &&
    matchesCronField(fields.hour, hour ?? '*') &&
    matchesCronField(fields.dayOfMonth, dayOfMonth ?? '*') &&
    matchesCronField(fields.month, month ?? '*') &&
    matchesCronField(fields.dayOfWeek, (dayOfWeek === '0' ? '7' : dayOfWeek) ?? '*')
  )
}

function matchesCronField(value: number, pattern: string): boolean {
  if (pattern === '*') return true

  if (pattern.includes(',')) {
    return pattern.split(',').some((p) => matchesCronField(value, p))
  }

  if (pattern.includes('-')) {
    const parts = pattern.split('-').map(Number)
    const start = parts[0]
    const end = parts[1]
    if (start === undefined || end === undefined) return false
    return value >= start && value <= end
  }

  return value === parseInt(pattern, 10)
}

export const taskQueue = new TaskQueue()
