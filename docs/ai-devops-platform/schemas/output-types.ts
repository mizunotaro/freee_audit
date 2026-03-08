export interface Result<T, E = Error> {
  success: boolean
  data?: T
  error?: E
}

export interface JobError {
  code: 'RATE_LIMIT' | 'TIMEOUT' | 'PERMISSION' | 'VALIDATION' | 'UNKNOWN' | 'NETWORK' | 'AUTH'
  message: string
  retryable: boolean
  context?: Record<string, unknown>
}

export interface TaskResult {
  issueNumber: number
  status: 'success' | 'failed' | 'blocked'
  qualityGates: QualityGateResult[]
  prUrl?: string
  branchName?: string
  error?: JobError
  durationMs: number
}

export interface QualityGateResult {
  name: string
  status: 'pass' | 'fail' | 'timeout' | 'skipped'
  durationMs: number
  required: boolean
  output?: string
}

export interface PreflightResult {
  modeOk: boolean
  rateLimitOk: boolean
  targetRepo: string
  maxConcurrency: number
}

export interface SelectResult {
  hasTask: boolean
  issueNumber?: number
  issueTitle?: string
  issueBody?: string
  priority?: string
}

export interface ExecuteResult {
  outcome: 'success' | 'failure' | 'cancelled' | 'skipped'
  branchName?: string
}

export interface QualityResult {
  passed: boolean
  results: QualityGateResult[]
  attempt: number
}

export interface MergeResult {
  prNumber?: number
  eligible: boolean
  merged: boolean
}

export interface FixResult {
  canFix: boolean
  outcome?: 'success' | 'failure' | 'cancelled'
}

export interface IdleResult {
  coverageIssueCreated: boolean
  securityIssueCreated: boolean
  qualityIssueCreated: boolean
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  type: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  actor: string
  repository: string
  runId: string
  workflow: string
  data: Record<string, unknown>
}

export interface EnvironmentSnapshot {
  nodeVersion: string
  pnpmVersion: string
  os: string
  model: string
  temperature: number
  provider: string
  contextLength: number
  maxOutputTokens: number
}
