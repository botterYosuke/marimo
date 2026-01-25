# Performance Optimization

## Model Selection Strategy

**Haiku** (lightweight tasks):
- Lightweight agents with frequent invocation
- Simple code generation
- Worker agents in multi-agent systems

**Sonnet** (default coding model):
- Main development work
- Orchestrating multi-agent workflows
- Complex coding tasks

**Opus** (deepest reasoning):
- Complex architectural decisions
- Maximum reasoning requirements
- Research and analysis tasks

## Context Window Management

Avoid last 20% of context window for:
- Large-scale refactoring
- Feature implementation spanning multiple files
- Debugging complex interactions

Lower context sensitivity tasks:
- Single-file edits
- Independent utility creation
- Documentation updates
- Simple bug fixes

## Plan Mode

For complex tasks requiring deep reasoning:
1. Enable **Plan Mode** for structured approach
2. Use multiple critique rounds
3. Use split role sub-agents for diverse analysis

## Build Troubleshooting

If build fails:
1. Use **build-error-resolver** agent
2. Run `make py-check` or `make fe-check` to identify issues
3. Fix incrementally
4. Verify after each fix

## marimo-Specific

- Heavy Python dependencies (pandas, numpy, etc.) must be lazily imported
- Use `React.lazy()` for heavy frontend components
- Frontend uses Jotai for efficient state management
