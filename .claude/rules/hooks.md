# Hooks System

## Hook Types

- **PreToolUse**: Before tool execution (validation, info messages)
- **PostToolUse**: After tool execution (checks, warnings)
- **Stop**: When session ends (final verification)

## Current Hooks (in .claude/hooks/hooks.json)

### PreToolUse
- **make dev info**: Shows port information for dev server
- **test/check info**: Info message for long-running commands
- **git push reminder**: Reminds to run make check before pushing
- **doc blocker**: Blocks creation of .md files outside docs/ directories

### PostToolUse
- **PR creation**: Logs PR URL after creation
- **console.log warning**: Warns about console.log in JS/TS files
- **print() warning**: Warns about print() in Python files

### Stop
- **console.log audit**: Checks all modified files for console.log

## TodoWrite Best Practices

Use TodoWrite tool to:
- Track progress on multi-step tasks
- Verify understanding of instructions
- Enable real-time steering
- Show granular implementation steps

Todo list reveals:
- Out of order steps
- Missing items
- Extra unnecessary items
- Wrong granularity
- Misinterpreted requirements
