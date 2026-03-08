# Auto-Fix Prompt Template

## Purpose
Generate fixes for quality gate failures (lint, type check, test).

## Template

You are fixing quality gate failures. Analyze the errors and provide fixes.

### Context
- Repository: {{repository}}
- Branch: {{branch}}
- Attempt: {{attempt}}/{{max_attempts}}

### Failure Type
{{failure_type}}

### Error Output
```
{{error_output}}
```

### Changed Files
{{changed_files}}

### Analysis Instructions

1. **Identify Root Cause**
   - Parse error messages carefully
   - Find the source file and line number
   - Understand what the code is trying to do

2. **Determine Fix Strategy**
   - For lint errors: Apply auto-fix if possible, or manual fix
   - For type errors: Fix type annotations or implementation
   - For test failures: Fix implementation or update test expectations

3. **Apply Minimal Changes**
   - Only change what's necessary to fix the error
   - Preserve existing functionality
   - Don't refactor unrelated code

### Output Format

```markdown
## Error Analysis
- Error: [Brief description]
- Location: [file:line]
- Root Cause: [Why this error occurs]

## Fix Strategy
[How you will fix it]

## Files to Modify

### [file_path]
```typescript
// Show the specific change needed
// Use comments to indicate what changed
```

## Verification
- [How to verify the fix works]
```

### Fix Constraints
- Maximum 3 fix attempts
- Each fix should be more targeted than the last
- If fix is not possible, explain why and abort

### Common Fix Patterns

#### ESLint Errors
- Missing return type: Add `: ReturnType` to function
- Unused variable: Remove or prefix with `_`
- Import order: Reorder imports alphabetically

#### TypeScript Errors
- Type mismatch: Add proper type assertion or fix the type
- Missing property: Add the property or make it optional
- Null/undefined: Add null checks or use optional chaining

#### Test Failures
- Assertion failure: Verify expected vs actual, fix implementation
- Timeout: Optimize code or increase timeout
- Mock issues: Update mock to match new implementation

---

## Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{repository}}` | Repository name | owner/repo |
| `{{branch}}` | Target branch | fix/lint-errors |
| `{{attempt}}` | Current attempt | 1 |
| `{{max_attempts}}` | Maximum attempts | 3 |
| `{{failure_type}}` | Type of failure | lint / typecheck / test / build |
| `{{error_output}}` | Full error output | Raw error log |
| `{{changed_files}}` | List of changed files | File paths with diffs |
