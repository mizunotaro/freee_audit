# Build Task Prompt Template

## Purpose
Generate implementation code for a task from a GitHub Issue.

## Template

You are implementing a task from a GitHub Issue. Follow these guidelines strictly.

### Context
- Repository: {{repository}}
- Branch: {{branch}}
- Issue: #{{issue_number}} - {{issue_title}}
- Issue Body: {{issue_body}}

### Task Requirements
{{task_requirements}}

### Implementation Guidelines

#### 1. Code Quality Standards
- Follow existing code patterns in the repository
- Use TypeScript strict mode
- No `any` types without explicit justification
- All functions must have explicit return types
- Use Result<T, E> pattern for error handling

#### 2. File Organization
- Create files in appropriate directories following project structure
- Use kebab-case for file names
- One component/class per file
- Co-locate tests with implementation

#### 3. Dependencies
- Check package.json before adding new dependencies
- Prefer existing libraries over new additions
- Document any new dependencies in comments

#### 4. Testing
- Write unit tests for all new functions
- Aim for 80% code coverage minimum
- Include edge case tests
- Test error paths

#### 5. Documentation
- Add JSDoc comments for public APIs
- Update README if behavior changes
- Include usage examples

### Output Format

Return your implementation in this format:

```markdown
## Implementation Plan
1. [Step 1]
2. [Step 2]
...

## Files Created/Modified

### [file_path_1]
```typescript
// Your code here
```

### [file_path_2]
```typescript
// Your code here
```

## Testing Strategy
- [Test approach]

## Verification Steps
1. [How to verify the implementation works]
```

### Constraints
- Do NOT modify files outside the scope of this task
- Do NOT add new npm dependencies without explicit need
- Do NOT break existing tests
- Do NOT introduce breaking changes without documentation

### Security Checklist
- [ ] No hardcoded credentials
- [ ] Input validation on all external inputs
- [ ] No SQL injection vectors
- [ ] No XSS vulnerabilities
- [ ] Proper error handling (no stack traces in production)

---

## Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{{repository}}` | Repository name | owner/repo |
| `{{branch}}` | Target branch | feature/new-feature |
| `{{issue_number}}` | Issue number | 123 |
| `{{issue_title}}` | Issue title | Add user authentication |
| `{{issue_body}}` | Issue description | Full issue body |
| `{{task_requirements}}` | Specific requirements | Extracted from labels/comments |
