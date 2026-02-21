---
name: dev-start
description: Start the marimo dev server (frontend on port 3000, backend on port 2718)
disable-model-invocation: false
allowed-tools: Bash
argument-hint: "[--frontend-only | --backend-only]"
---

## Start marimo dev server

Start the development environment from the project root `C:\Users\sasai\Documents\marimo`.

### Steps

1. **Check if ports are already in use**:
   ```bash
   # Check port 2718 (backend) and 3000 (frontend)
   netstat -ano | grep -E ':(2718|3000)\s' || echo "Ports are free"
   ```
   - If ports are occupied, warn the user and suggest using `/dev-restart` instead.

2. **Start the dev server** (run in background):
   ```bash
   cd /c/Users/sasai/Documents/marimo && pnpm run dev
   ```
   - This uses `scripts/dev-with-cleanup.mjs` which runs `concurrently`:
     - **Backend**: `.venv\Scripts\python.exe -m marimo edit --no-token --headless %APPDATA%\marimo\notebooks --port 2718`
     - **Frontend**: Vite dev server on port 3000 (proxies API to backend 2718)
   - Run the command in the background using the Bash tool's `run_in_background` parameter.

3. **Wait for servers to be ready** (about 10 seconds):
   ```bash
   sleep 10
   ```
   Then tail the background task output to confirm both servers started.

4. **Report the result** to the user:
   - Frontend: `http://localhost:3000/`
   - Backend: `http://127.0.0.1:2718`

### Arguments

- No argument: start both frontend and backend (default)
- `--frontend-only`: run only `pnpm run dev:frontend`
- `--backend-only`: run only `pnpm run dev:backend`

### Notes

- The backend uses the Python venv at `.venv\Scripts\python.exe`
- The `PYTHONPATH` is set to `%APPDATA%\marimo\notebooks`
- Notebooks directory: `C:\Users\sasai\AppData\Roaming\marimo\notebooks`
