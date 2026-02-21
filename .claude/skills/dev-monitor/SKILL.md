---
name: dev-monitor
description: Monitor the marimo dev server status, check ports, view logs, and diagnose issues
disable-model-invocation: true
allowed-tools: Bash, Read
argument-hint: "[--logs | --errors | --status]"
---

## Monitor marimo dev server

Check the health and status of the marimo development environment.

### Default behavior (no arguments): full status check

1. **Check process status**:
   ```bash
   # Backend process (port 2718)
   netstat -ano | grep ':2718' && echo "Backend: RUNNING" || echo "Backend: STOPPED"
   # Frontend process (port 3000)
   netstat -ano | grep ':3000' && echo "Frontend: RUNNING" || echo "Frontend: STOPPED"
   ```

2. **Check HTTP health** (if processes are running):
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || echo "Frontend not responding"
   curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:2718/ 2>/dev/null || echo "Backend not responding"
   ```

3. **Report summary** to the user:
   - Frontend status (port 3000)
   - Backend status (port 2718)
   - PIDs of relevant processes
   - Any issues detected

### Arguments

- `--status` (default): Show running/stopped status for both servers
- `--logs`: Tail the most recent dev server background task output (use `tail -50` on the task output file)
- `--errors`: Show only error-level output from the dev server logs

### Diagnosing common issues

- **Port already in use**: Another process is occupying port 2718 or 3000. Suggest `/dev-restart`.
- **Backend not responding**: Check if `.venv` exists and `marimo` is installed. Suggest `pnpm run setup:win`.
- **Frontend not responding**: Check if `node_modules` exists. Suggest `pnpm install`.
- **ImportError in notebooks**: The Python environment may be missing packages. Check with `pip list` in the venv.

### Notes

- Background task output files are typically at `C:\Users\sasai\AppData\Local\Temp\claude\c--Users-sasai-Documents-marimo\tasks\*.output`
- To find the latest output file: `ls -t /c/Users/sasai/AppData/Local/Temp/claude/c--Users-sasai-Documents-marimo/tasks/*.output | head -1`
