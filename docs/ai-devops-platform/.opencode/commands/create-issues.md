---
description: Create GitHub Issues from proposed tasks
agent: plan
---

## Task: Create GitHub Issues

You are tasked with creating GitHub Issues from the following tasks.

### Target Repository
- Repository: mizunotaro/freee_audit

### Tasks to Register
$ARGUMENTS

### Requirements

For each task, create a GitHub Issue with the following:

1. **Title**: Clear, concise title prefixed with type (e.g., "[Feature]", "[Bug]", "[Refactor]")

2. **Body**:
   - Description of the task
   - Acceptance criteria (if applicable)
   - Technical details (if applicable)

3. **Labels**:
   - Always add: `ai:ready`
   - Add type label: `ai:feature`, `ai:bug`, `ai:refactor`, `ai:test`, or `ai:docs`
   - Add priority label if specified: `ai:p1`, `ai:p2`, or `ai:p3`

### Label Reference

| Label | Usage |
|-------|-------|
| `ai:ready` | Task ready for AI processing (REQUIRED) |
| `ai:feature` | New feature |
| `ai:bug` | Bug fix |
| `ai:refactor` | Code refactoring |
| `ai:test` | Test-related |
| `ai:docs` | Documentation |
| `ai:p1` | High priority |
| `ai:p2` | Medium priority |
| `ai:p3` | Low priority |

### Instructions

1. Parse the tasks from $ARGUMENTS
2. For each task, use the `gh issue create` command to create an issue
3. Return a summary of created issues with their URLs

### Example Command

```bash
gh issue create --repo mizunotaro/freee_audit \
  --title "[Feature] Task title" \
  --body "Task description" \
  --label "ai:ready,ai:feature"
```

Create the issues now.
