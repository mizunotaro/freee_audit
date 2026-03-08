/**
 * OpenCode Custom Tool: github-issue-list
 * Lists GitHub Issues via gh CLI
 *
 * @see https://cli.github.com/manual/gh_issue_list
 */

import { $ } from 'bun'
import { z } from 'zod'

const ListIssuesSchema = z.object({
  state: z.enum(['open', 'closed', 'all']).default('open'),
  labels: z.array(z.string()).optional(),
  assignee: z.string().optional(),
  author: z.string().optional(),
  milestone: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  repository: z.string().optional(),
  json: z.boolean().default(true),
})

export type ListIssuesInput = z.infer<typeof ListIssuesSchema>

export interface Issue {
  number: number
  title: string
  state: string
  labels: string[]
  assignees: string[]
  createdAt: string
  updatedAt: string
  url: string
  body?: string
}

export interface ListIssuesOutput {
  success: boolean
  issues?: Issue[]
  totalCount?: number
  error?: string
}

export const description = `List GitHub Issues with optional filters.

Example usage:
- List open issues: { state: "open" }
- List AI tasks: { labels: ["ai-task"], state: "open" }
- List by assignee: { assignee: "username", state: "all" }
- List by author: { author: "username" }

Parameters:
- state (optional): Filter by state - "open", "closed", or "all" (default: "open")
- labels (optional): Array of label names to filter by
- assignee (optional): Filter by assignee username
- author (optional): Filter by author username
- milestone (optional): Filter by milestone number or title
- limit (optional): Max results, 1-100 (default: 20)
- repository (optional): Target repository in "owner/repo" format
- json (optional): Return as JSON (default: true)`

export const parameters = ListIssuesSchema

export async function execute(input: ListIssuesInput): Promise<ListIssuesOutput> {
  try {
    const validated = ListIssuesSchema.parse(input)

    const args: string[] = [
      'issue',
      'list',
      '--state',
      validated.state,
      '--limit',
      validated.limit.toString(),
      '--json',
      'number,title,state,labels,assignees,createdAt,updatedAt,url,body',
    ]

    if (validated.labels && validated.labels.length > 0) {
      args.push('--label', validated.labels.join(','))
    }

    if (validated.assignee) {
      args.push('--assignee', validated.assignee)
    }

    if (validated.author) {
      args.push('--author', validated.author)
    }

    if (validated.milestone) {
      args.push('--milestone', validated.milestone)
    }

    if (validated.repository) {
      args.push('--repo', validated.repository)
    }

    const result = await $`gh ${args}`.quiet()

    const output = result.stdout.toString().trim()
    const issues: Issue[] = JSON.parse(output)

    return {
      success: true,
      issues: issues.map((issue) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        labels:
          issue.labels?.map((l: { name?: string } | string) =>
            typeof l === 'string' ? l : l.name || ''
          ) || [],
        assignees:
          issue.assignees?.map((a: { login?: string } | string) =>
            typeof a === 'string' ? a : a.login || ''
          ) || [],
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        url: issue.url,
        body: issue.body,
      })),
      totalCount: issues.length,
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
