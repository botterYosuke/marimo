# Git Workflow

## Commit Message Format

```
<type>: <description>

<optional body>
```

Types: feat, fix, refactor, docs, test, chore, perf, ci

## Pull Request Workflow

When creating PRs:
1. Ensure `make check` passes (lint, typecheck, format)
2. Analyze full commit history (not just latest commit)
3. Use `git diff main...HEAD` to see all changes
4. Draft comprehensive PR summary
5. Include test plan with TODOs
6. Sign the CLA if first-time contributor

## Pre-PR Checklist

```bash
# Run all checks
make check

# Run tests for changed areas
uvx hatch run +py=3.12 test:test tests/path/to/changed/
cd frontend && pnpm test
```

## Feature Implementation Workflow

1. **Plan First**
   - Use **planner** agent for complex features
   - Identify dependencies and risks
   - Break down into phases

2. **TDD Approach**
   - Use **tdd-guide** agent
   - Write tests first (RED)
   - Implement to pass tests (GREEN)
   - Refactor (IMPROVE)

3. **Code Review**
   - Use **code-reviewer** agent after writing code
   - Address CRITICAL and HIGH issues
   - Fix MEDIUM issues when possible

4. **Commit & Push**
   - Run `make check` before committing
   - Use conventional commits format
   - Ensure CI passes after push
