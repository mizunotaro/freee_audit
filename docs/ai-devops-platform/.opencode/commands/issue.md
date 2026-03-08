# /issue Command

Create or manage GitHub Issues for AI automation.

## Usage

```
/issue create <title> [--body <body>] [--labels <labels>] [--priority <priority>]
/issue list [--status <open|closed>] [--label <label>]
/issue status <issue-number>
/issue comment <issue-number> <comment>
```

## Commands

### create
Create a new issue for AI to implement.

```bash
/issue create "Add user authentication" --body "Implement JWT-based auth" --labels "ai-task,priority-high"
```

Options:
- `--body`: Issue description (supports markdown)
- `--labels`: Comma-separated labels
- `--priority`: Priority level (critical, high, medium, low)
- `--assignee`: GitHub username to assign

### list
List issues with optional filters.

```bash
/issue list --status open --label ai-task
```

Options:
- `--status`: Filter by status (open, closed, all)
- `--label`: Filter by label
- `--limit`: Max results (default: 20)

### status
Get detailed status of an issue.

```bash
/issue status 123
```

Shows:
- Issue details
- Linked PRs
- Workflow runs
- AI session status

### comment
Add a comment to an issue.

```bash
/issue comment 123 "Updated requirements: ..."
```

## Labels

The following labels are recognized by the automation:

| Label | Description |
|-------|-------------|
| `ai-task` | Task ready for AI implementation |
| `ai-in-progress` | AI is currently working on this |
| `ai-blocked` | AI blocked, needs human intervention |
| `ai-completed` | AI completed the task |
| `priority-critical` | Immediate attention required |
| `priority-high` | High priority |
| `priority-medium` | Medium priority (default) |
| `priority-low` | Low priority |

## Examples

```bash
# Create a new feature task
/issue create "Add password reset" --body "Users should be able to reset their password via email" --labels "ai-task,priority-high"

# List all AI tasks
/issue list --label ai-task

# Check status of issue 42
/issue status 42

# Trigger instant processing
/issue comment 42 "/opencode"
```

## Instant Trigger

Add `/opencode` to any comment to trigger immediate AI processing:

```bash
/issue comment 42 "Ready to implement /opencode"
```

## Workflow

1. Create issue with `ai-task` label
2. AI picks up issue within 15 minutes (or instantly with `/opencode`)
3. AI creates branch, implements, runs quality gates
4. AI creates PR
5. If quality gates pass and `auto-merge` label exists, AI auto-merges
6. AI updates issue status with results
