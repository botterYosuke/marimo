---
name: dev-restart
description: Restart the marimo dev server by stopping existing processes and starting fresh
disable-model-invocation: true
allowed-tools: Bash
---

## Restart marimo dev server

Restart the development environment from the project root `C:\Users\sasai\Documents\marimo`.

### Steps

1. **Stop any existing Claude background task** running the dev server:
   - Use `TaskStop` if there is a background Bash task from a previous `/dev-start` or `/dev-restart`.

2. **Kill processes on port 2718** (backend) using the cleanup script:
   ```bash
   cd /c/Users/sasai/Documents/marimo && node scripts/clean-processes.mjs
   ```

3. **Kill processes on port 3000** (frontend) — the cleanup script only handles 2718:
   ```bash
   netstat -ano | grep ':3000.*LISTENING' | awk '{print $5}' | sort -u | while read pid; do
     [ -n "$pid" ] && [ "$pid" != "0" ] && taskkill //PID $pid //F 2>/dev/null && echo "Killed frontend PID $pid"
   done
   echo "Frontend cleanup done"
   ```

4. **Verify ports are free** (poll up to 5 seconds):
   ```bash
   for i in $(seq 1 5); do
     occupied=$(netstat -ano | grep -E ':(2718|3000).*LISTENING')
     if [ -z "$occupied" ]; then echo "Ports are free"; break; fi
     echo "Waiting for ports to free... ($i/5)"
     sleep 1
   done
   ```
   If ports are still occupied after 5 seconds, report the blocking PIDs and stop.

5. **Start the dev server** (run in background):
   ```bash
   cd /c/Users/sasai/Documents/marimo && pnpm run dev
   ```
   Run with the Bash tool's `run_in_background: true` parameter.

6. **Poll for readiness** (max 30 seconds):
   ```bash
   for i in $(seq 1 30); do
     backend=$(netstat -ano | grep ':2718.*LISTENING' | head -1)
     frontend=$(netstat -ano | grep ':3000.*LISTENING' | head -1)
     if [ -n "$backend" ] && [ -n "$frontend" ]; then
       echo "Both servers ready"
       break
     fi
     echo "Waiting... ($i/30)"
     sleep 1
   done
   ```

7. **Report the result** to the user:
   - Frontend: `http://localhost:3000/`
   - Backend: `http://127.0.0.1:2718`
   - If either server failed to start, tail the background task output for error details.

### Notes

- `scripts/clean-processes.mjs` only cleans port 2718. Port 3000 must be cleaned separately (Step 3).
- `pnpm run dev` runs `scripts/dev-with-cleanup.mjs`, which uses `concurrently` to start both backend and frontend.
- On Windows, use `//PID` and `//F` (double-slash) for `taskkill` flags inside Git Bash to avoid path interpretation.
