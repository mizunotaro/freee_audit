/**
 * OpenCode Custom Tool: github-issue-status
 * Gets detailed status of a GitHub Issue via gh CLI
 *
 * @see https://cli.github.com/manual/gh_issue_view
 */

import { $ } from 'bun'
import { z } from 'zod'

const IssueStatusSchema = z.object({
  issueNumber: z.number().int().positive(),
  repository: z.string().optional(),
  includePRs: z.boolean().default(true),
  includeWorkflowRuns: z.boolean().default(true),
})

export type IssueStatusInput = z.infer<typeof IssueStatusSchema>

export interface PullRequest {
  number: number
  title: string
  state: string
  url: string
  headBranch: string
  baseBranch: string
  isDraft: boolean
  mergeable?: string
  statusCheckRollup?: {
    status: string
    conclusion?: string
  }
}

export interface WorkflowRun {
  id: number
  name: string
  status: string
  conclusion?: string
  createdAt: string
  updatedAt: string
  url: string
  headBranch: string
  event: string
}

export interface IssueStatus {
  number: number
  title: string
  state: string
  body?: string
  labels: string[]
  assignees: string[]
  author: {
    login: string
    type: string
  }
  createdAt: string
  updatedAt: string
  closedAt?: string
  url: string
  milestone?: {
    title: string
    state: string
  }
  comments: number
  pullRequests?: PullRequest[]
  workflowRuns?: WorkflowRun[]
  aiSessionStatus?: {
    status: 'none' | 'pending' | 'in-progress' | 'completed' | 'failed'
    lastRunAt?: string
    branch?: string
    attemptCount?: number
  }
}

export interface IssueStatusOutput {
  success: boolean
  status?: IssueStatus
  error?: string
}

export const description = `Get detailed status of a GitHub Issue including linked PRs and workflow runs.

Example usage:
- Basic status: { issueNumber: 123 }
- Without PRs: { issueNumber: 123, includePRs: false }
- Without workflows: { issueNumber: 123, includeWorkflowRuns: false }

Parameters:
- issueNumber (required): Issue number to get status for
- repository (optional): Target repository in "owner/repo" format
- includePRs (optional): Include linked pull requests (default: true)
- includeWorkflowRuns (optional): Include related workflow runs (default: true)`

export const parameters = IssueStatusSchema

export async function execute(input: IssueStatusInput): Promise<IssueStatusOutput> {
  try {
    const validated = IssueStatusSchema.parse(input)

    const args: string[] = [
      'issue',
      'view',
      validated.issueNumber.toString(),
      '--json',
      'number,title,state,body,labels,assignees,author,createdAt,updatedAt,closedAt,url,milestone,comments',
    ]

    if (validated.repository) {
      args.push('--repo', validated.repository)
    }

    const result = await $`gh ${args}`.quiet()

    const issue = JSON.parse(result.stdout.toString().trim())

    const status: IssueStatus = {
      number: issue.number,
      title: issue.title,
      state: issue.state,
      body: issue.body,
      labels:
        issue.labels?.map((l: { name?: string } | string) =>
          typeof l === 'string' ? l : l.name || ''
        ) || [],
      assignees:
        issue.assignees?.map((a: { login?: string } | string) =>
          typeof a === 'string' ? a : a.login || ''
        ) || [],
      author: {
        login: issue.author?.login || 'unknown',
        type: issue.author?.type || 'User',
      },
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      closedAt: issue.closedAt,
      url: issue.url,
      milestone: issue.milestone
        ? {
            title: issue.milestone.title,
            state: issue.milestone.state,
          }
        : undefined,
      comments: issue.comments || 0,
    }

    if (validated.includePRs) {
      try {
        const prArgs: string[] = [
          'pr',
          'list',
          '--state',
          'all',
          '--search',
          `fixes #${validated.issueNumber} OR closes #${validated.issueNumber}`,
          '--json',
          'number,title,state,url,headRefName,baseRefName,isDraft,mergeable,statusCheckRollup',
          '--limit',
          '10',
        ]

        if (validated.repository) {
          prArgs.push('--repo', validated.repository)
        }

        const prResult = await $`gh ${prArgs}`.quiet()
        const prs = JSON.parse(prResult.stdout.toString().trim())

        status.pullRequests = prs.map(
          (pr: {
            number: number
            title: string
            state: string
            url: string
            headRefName: string
            baseRefName: string
            isDraft: boolean
            mergeable: string
            statusCheckRollup: unknown
          }) => ({
            number: pr.number,
            title: pr.title,
            state: pr.state,
            url: pr.url,
            headBranch: pr.headRefName,
            baseBranch: pr.baseRefName,
            isDraft: pr.isDraft,
            mergeable: pr.mergeable,
            statusCheckRollup: pr.statusCheckRollup,
          })
        )
      } catch {
        status.pullRequests = []
      }
    }

    if (validated.includeWorkflowRuns && status.pullRequests && status.pullRequests.length > 0) {
      try {
        const branchName = status.pullRequests[0].headBranch
        const workflowArgs: string[] = [
          'run',
          'list',
          '--branch',
          branchName,
          '--json',
          'id,name,status,conclusion,createdAt,updatedAt,url,headBranch,event',
          '--limit',
          '10',
        ]

        if (validated.repository) {
          workflowArgs.push('--repo', validated.repository)
        }

        const workflowResult = await $`gh ${workflowArgs}`.quiet()
        const runs = JSON.parse(workflowResult.stdout.toString().trim())

        status.workflowRuns = runs.map(
          (run: {
            id: number
            name: string
            status: string
            conclusion: string
            createdAt: string
            headBranch: string
            event: string
            updatedAt?: string
            url?: string
          }) => ({
            id: run.id,
            name: run.name,
            status: run.status,
            conclusion: run.conclusion,
            createdAt: run.createdAt,
            updatedAt: run.updatedAt,
            url: run.url,
            headBranch: run.headBranch,
            event: run.event,
          })
        )
      } catch {
        status.workflowRuns = []
      }
    }

    const aiLabels = status.labels.filter(
      (l) =>
        l.startsWith('ai-') || l === 'ai-task' || l === 'ai-in-progress' || l === 'ai-completed'
    )

    if (aiLabels.length > 0) {
      status.aiSessionStatus = {
        status: aiLabels.includes('ai-in-progress')
          ? 'in-progress'
          : aiLabels.includes('ai-completed')
            ? 'completed'
            : aiLabels.includes('ai-blocked')
              ? 'failed'
              : aiLabels.includes('ai-task')
                ? 'pending'
                : 'none',
        branch: status.pullRequests?.[0]?.headBranch,
        attemptCount: status.workflowRuns?.filter(
          (r) => r.name.includes('ai') || r.name.includes('orchestrator')
        ).length,
      }
    }

    return {
      success: true,
      status,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
      }
    }

    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      error: errorMessage,
    }
  }
}

export default { description, parameters, execute }
