# Verification Loop Skill

A comprehensive verification system for marimo development.

## When to Use

Invoke this skill:
- After completing a feature or significant code change
- Before creating a PR
- When you want to ensure quality gates pass
- After refactoring

## Verification Phases

### Phase 1: Build Verification
```bash
# Build frontend
make fe

# If build fails, check for errors
```

If build fails, STOP and fix before continuing.

### Phase 2: Type/Lint Check
```bash
# All checks (lint, typecheck, format)
make check

# Or separately:
make py-check    # Python
make fe-check    # Frontend
```

Report all errors. Fix critical ones before continuing.

### Phase 3: Test Suite
```bash
# Python tests
uvx hatch run +py=3.12 test:test tests/

# Frontend tests
cd frontend && pnpm test

# E2E tests
make e2e
```

Report:
- Total tests: X
- Passed: X
- Failed: X

### Phase 4: Security Scan
```bash
# Check for secrets in Python
grep -rn "api_key\|password\|secret" --include="*.py" marimo/ 2>/dev/null | head -10

# Check for console.log in TypeScript
grep -rn "console.log" --include="*.ts" --include="*.tsx" frontend/src/ 2>/dev/null | head -10

# Check for print() in Python
grep -rn "^[[:space:]]*print(" --include="*.py" marimo/ 2>/dev/null | head -10
```

### Phase 5: Diff Review
```bash
# Show what changed
git diff --stat
git diff main...HEAD --name-only
```

Review each changed file for:
- Unintended changes
- Missing error handling
- Potential edge cases

## Output Format

After running all phases, produce a verification report:

```
VERIFICATION REPORT
==================

Build:     [PASS/FAIL]
Types:     [PASS/FAIL] (X errors)
Lint:      [PASS/FAIL] (X warnings)
Tests:     [PASS/FAIL] (X/Y passed)
Security:  [PASS/FAIL] (X issues)
Diff:      [X files changed]

Overall:   [READY/NOT READY] for PR

Issues to Fix:
1. ...
2. ...
```

## Integration with Hooks

This skill complements PostToolUse hooks but provides deeper verification.
Hooks catch issues immediately; this skill provides comprehensive review.
