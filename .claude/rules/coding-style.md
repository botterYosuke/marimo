# Coding Style

## Python Backend

Follow guidelines in `marimo/AGENTS.md`:

- PEP 8 style (79 char line limit)
- Type hints consistently (`list[str]` not `List[str]`, `str | None` not `Optional[str]`)
- Use `Final` for constants: `_name: Final[str] = "marimo-tabs"`
- Private modules use `_` prefix
- msgspec.Struct for API models, dataclasses for internal structures
- Lazy import heavy dependencies (pandas, numpy, etc.)
- Use marimo logger: `LOGGER = _loggers.marimo_logger()`

## TypeScript Frontend

Follow guidelines in `frontend/AGENTS.md`:

- Functional programming patterns, avoid classes
- PascalCase for components, lowercase-dashes for directories
- Path aliases: `@/components/`, `@/utils/`
- Jotai for state management
- Tailwind with `cn` utility for styling
- React Hook Form + Zod for forms

## Immutability (CRITICAL)

ALWAYS create new objects, NEVER mutate:

```typescript
// WRONG: Mutation
function updateUser(user, name) {
  user.name = name  // MUTATION!
  return user
}

// CORRECT: Immutability
function updateUser(user, name) {
  return { ...user, name }
}
```

## File Organization

- High cohesion, low coupling
- 200-400 lines typical, 800 max
- Extract utilities from large components
- Organize by feature/domain

## Code Quality Checklist

Before marking work complete:
- [ ] Code follows marimo/frontend AGENTS.md guidelines
- [ ] Functions are small (<50 lines)
- [ ] Files are focused (<800 lines)
- [ ] No deep nesting (>4 levels)
- [ ] Proper error handling
- [ ] No console.log (JS) or print() (Python)
- [ ] No hardcoded values
- [ ] Comments explain "why", not "what"
