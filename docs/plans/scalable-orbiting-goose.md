# Fix: pnpm dist:electron TTY Error

## Problem
Running `pnpm dist:electron` fails with:
```
ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY  Aborted removal of modules directory due to no TTY
```

## Root Cause
The `pnpm-workspace.yaml` has `verifyDepsBeforeRun: install`, which causes pnpm to verify/install dependencies before running scripts. When turbo runs codegen tasks in parallel, pnpm can't get TTY confirmation to modify `node_modules`.

## Solution Options

### Option A: Run with CI=true (Quick Fix - No Code Changes)
On Windows PowerShell:
```powershell
$env:CI="true"; pnpm dist:electron
```

On Windows CMD:
```cmd
set CI=true && pnpm dist:electron
```

### Option B: Remove verifyDepsBeforeRun (Permanent Fix)
Edit `pnpm-workspace.yaml` to remove or disable the setting:

**Before:**
```yaml
verifyDepsBeforeRun: install
packages:
  - 'frontend'
  - 'packages/*'
```

**After:**
```yaml
packages:
  - 'frontend'
  - 'packages/*'
```

## Recommended Approach
**Option B** - Remove `verifyDepsBeforeRun: install` from `pnpm-workspace.yaml`. This setting is overly aggressive for local development and causes issues when turbo runs parallel tasks.

## Files to Modify
- [pnpm-workspace.yaml](pnpm-workspace.yaml) - Remove line 1

## Verification
After the fix, run:
```powershell
pnpm dist:electron
```
The build should complete successfully and produce an Electron app.
