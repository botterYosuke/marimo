---
name: dev-monitor
description: Monitor the marimo dev server status, check ports, view logs, and diagnose issues
disable-model-invocation: true
allowed-tools: Bash, Read
argument-hint: "[--logs | --errors | --status]"
---

## Monitor marimo dev server

Check the health and status of the marimo development environment.

Project root: `C:\Users\sasai\Documents\marimo`

### Default behavior (no arguments): full status check

Run all checks in a single command:

```bash
echo "=== Port Status ===" && \
backend_pid=$(netstat -ano | grep ':2718.*LISTENING' | awk '{print $5}' | sort -u | head -1) && \
frontend_pid=$(netstat -ano | grep ':3000.*LISTENING' | awk '{print $5}' | sort -u | head -1) && \
echo "Backend  (2718): ${backend_pid:+RUNNING (PID $backend_pid)}${backend_pid:-STOPPED}" && \
echo "Frontend (3000): ${frontend_pid:+RUNNING (PID $frontend_pid)}${frontend_pid:-STOPPED}" && \
echo "" && \
echo "=== HTTP Health ===" && \
if [ -n "$backend_pid" ]; then
  curl -s -o /dev/null -w "Backend  HTTP: %{http_code}\n" http://127.0.0.1:2718/ 2>/dev/null || echo "Backend  HTTP: not responding"
fi && \
if [ -n "$frontend_pid" ]; then
  curl -s -o /dev/null -w "Frontend HTTP: %{http_code}\n" http://localhost:3000/ 2>/dev/null || echo "Frontend HTTP: not responding"
fi
```

Report to the user as a concise table:

| Component | Port | PID | HTTP |
|-----------|------|-----|------|
| Backend   | 2718 | ... | ...  |
| Frontend  | 3000 | ... | ...  |

### Arguments

- `--status` (default): Show running/stopped status for both servers
- `--logs`: Show the last 50 lines of the dev server background task output:
  ```bash
  latest=$(ls -t /c/Users/sasai/AppData/Local/Temp/claude/c--Users-sasai-Documents-marimo/tasks/*.output 2>/dev/null | head -1)
  if [ -n "$latest" ]; then tail -50 "$latest"; else echo "No task output files found"; fi
  ```
- `--errors`: Show only error lines from the dev server logs:
  ```bash
  latest=$(ls -t /c/Users/sasai/AppData/Local/Temp/claude/c--Users-sasai-Documents-marimo/tasks/*.output 2>/dev/null | head -1)
  if [ -n "$latest" ]; then grep -i -E 'error|fail|exception|traceback' "$latest" | tail -30; else echo "No task output files found"; fi
  ```

### Diagnosing common issues

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| Port already in use | Stale process on 2718/3000 | `/dev-restart` |
| Backend not responding | `.venv` missing or `marimo` not installed | `cd /c/Users/sasai/Documents/marimo && pnpm run setup:win` |
| Frontend not responding | `node_modules` missing | `cd /c/Users/sasai/Documents/marimo && pnpm install` |
| ImportError in notebooks | Package missing from venv | `/c/Users/sasai/Documents/marimo/.venv/Scripts/pip.exe list \| grep <package>` |
| Only one port running | Partial startup or crash | `/dev-restart` |
