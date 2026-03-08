/**
 * OpenCode Custom Tool: github-issue
 * Creates GitHub Issues via gh CLI
 *
 * @see https://cli.github.com/manual/gh_issue_create
 */

import { $ } from 'bun'
import { z } from 'zod'

const CreateIssueSchema = z.object({
  title: z.string().min(1).max(256),
  body: z.string().max(65536).optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  milestone: z.string().optional(),
  project: z.string().optional(),
  repository: z.string().optional(),
})

export type CreateIssueInput = z.infer<typeof CreateIssueSchema>

export interface CreateIssueOutput {
  success: boolean
  issueNumber?: number
  issueUrl?: string
  error?: string
}

export const description = `Create a GitHub Issue with specified title, body, and labels.

Example usage:
- Create a feature request: { title: "Add dark mode", labels: ["enhancement"] }
- Create a bug report: { title: "Login fails on Safari", labels: ["bug", "ai-task"] }
- Create with body: { title: "Add API endpoint", body: "Create REST API for user management", labels: ["ai-task"] }

Parameters:
- title (required): Issue title, max 256 characters
- body (optional): Issue description in markdown, max 65536 characters  
- labels (optional): Array of label names to apply
- assignees (optional): Array of GitHub usernames to assign
- repository (optional): Target repository in "owner/repo" format (defaults to current)`

export const parameters = CreateIssueSchema

export async function execute(input: CreateIssueInput): Promise<CreateIssueOutput> {
  try {
    const validated = CreateIssueSchema.parse(input)

    const args: string[] = ['issue', 'create', '--title', validated.title]

    if (validated.body) {
      args.push('--body', validated.body)
    }

    if (validated.labels && validated.labels.length > 0) {
      args.push('--label', validated.labels.join(','))
    }

    if (validated.assignees && validated.assignees.length > 0) {
      args.push('--assignee', validated.assignees.join(','))
    }

    if (validated.milestone) {
      args.push('--milestone', validated.milestone)
    }

    if (validated.project) {
      args.push('--project', validated.project)
    }

    if (validated.repository) {
      args.push('--repo', validated.repository)
    }

    const result = await $`gh ${args}`.quiet()

    const output = result.stdout.toString().trim()
    const urlMatch = output.match(/https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)/)

    if (urlMatch) {
      return {
        success: true,
        issueNumber: parseInt(urlMatch[2], 10),
        issueUrl: output,
      }
    }

    return {
      success: true,
      issueUrl: output,
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
