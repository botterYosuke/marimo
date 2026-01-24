# Security Guidelines

## Mandatory Security Checks

Before ANY commit:
- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user inputs validated
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitized HTML)
- [ ] Authentication/authorization verified
- [ ] Error messages don't leak sensitive data

## Secret Management

**Python:**
```python
import os

# NEVER: Hardcoded secrets
api_key = "sk-xxx"

# ALWAYS: Environment variables
api_key = os.environ.get("API_KEY")
if not api_key:
    raise ValueError("API_KEY not configured")
```

**TypeScript:**
```typescript
// NEVER: Hardcoded secrets
const apiKey = "sk-xxx"

// ALWAYS: Environment variables or runtime config
const apiKey = import.meta.env.VITE_API_KEY
```

## Security Response Protocol

If security issue found:
1. STOP immediately
2. Use **security-reviewer** agent
3. Fix CRITICAL issues before continuing
4. Rotate any exposed secrets
5. Review entire codebase for similar issues

## marimo-Specific Security

- Server endpoints in `marimo/_server/api/` need proper auth checks
- WebSocket messages should be validated
- User-provided code executes in notebook runtime - be careful with file access
- Use `HTTPException` with appropriate status codes for API errors
