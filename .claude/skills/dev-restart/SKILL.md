---
name: dev-restart
description: Restart the marimo dev server by stopping existing processes and starting fresh
disable-model-invocation: true
allowed-tools: Bash
---

## Restart marimo dev server

Restart the development environment from the project root `C:\Users\sasai\Documents\marimo`.

### Steps

1. **Stop existing processes** on ports 2718 and 3000:
   ```bash
   cd /c/Users/sasai/Documents/marimo && node scripts/clean-processes.mjs
   ```
   If `clean-processes.mjs` is unavailable, manually kill processes:
   ```bash
   # Find and kill backend (port 2718)
   netstat -ano | grep ':2718' | awk '{print $5}' | sort -u | xargs -I{} taskkill /PID {} /F 2>/dev/null
   # Find and kill frontend (port 3000)
   netstat -ano | grep ':3000' | awk '{print $5}' | sort -u | xargs -I{} taskkill /PID {} /F 2>/dev/null
   ```

2. **Verify ports are free**:
   ```bash
   netstat -ano | grep -E ':(2718|3000)\s' || echo "Ports are free"
   ```
   Wait and retry if ports are still occupied (up to 5 seconds).

3. **Start the dev server** (run in background):
   ```bash
   cd /c/Users/sasai/Documents/marimo && pnpm run dev
   ```
   Run in background using the Bash tool's `run_in_background` parameter.

4. **Wait for servers to be ready** (about 10 seconds), then tail background output to confirm.

5. **Report the result** to the user:
   - Frontend: `http://localhost:3000/`
   - Backend: `http://127.0.0.1:2718`

### Notes

- This always kills both frontend and backend, then restarts both.
- The cleanup script `scripts/clean-processes.mjs` handles Windows-specific process killing.
- If there is an active background task running the previous dev server, stop it first using TaskStop.
