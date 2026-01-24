# Agent Orchestration

## Available Agents

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| planner | Implementation planning | Complex features, refactoring |
| architect | System design | Architectural decisions |
| tdd-guide | Test-driven development | New features, bug fixes |
| code-reviewer | Code review | After writing code |
| security-reviewer | Security analysis | Before commits |
| build-error-resolver | Fix build errors | When build/typecheck fails |
| e2e-runner | E2E testing | Critical user flows (Playwright) |
| refactor-cleaner | Dead code cleanup | Code maintenance |
| doc-updater | Documentation | Updating docs |

## Immediate Agent Usage

No user prompt needed:
1. Complex feature requests - Use **planner** agent
2. Code just written/modified - Use **code-reviewer** agent
3. Bug fix or new feature - Use **tdd-guide** agent
4. Architectural decision - Use **architect** agent

## Parallel Task Execution

ALWAYS use parallel Task execution for independent operations:

```markdown
# GOOD: Parallel execution
Launch 3 agents in parallel:
1. Agent 1: Security analysis of _server/auth.py
2. Agent 2: Performance review of _runtime/
3. Agent 3: Type checking of frontend/src/

# BAD: Sequential when unnecessary
First agent 1, then agent 2, then agent 3
```

## marimo-Specific Considerations

- **Python backend** (`marimo/`): Follow PEP 8, use type hints, msgspec for API models
- **React frontend** (`frontend/src/`): TypeScript, Jotai for state, Radix UI components
- **Tests**: pytest for Python, pnpm test for frontend, Playwright for E2E
