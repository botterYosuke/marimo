---
name: generate-code-url
description: Generate a shareable marimo URL with code embedded in #code/ fragment
disable-model-invocation: false
allowed-tools: Bash
argument-hint: "<file-path> [--base-url URL]"
---

## Generate Shareable marimo Code URL

Converts a Python file into a shareable marimo URL with code embedded in the `#code/` fragment.

This is useful for sharing marimo notebooks without requiring users to host files.

### Steps

1. **Validate the file path**:
   - Check if the file exists
   - Verify it's a `.py` file
   - Read the file content

2. **Generate the shareable URL**:
   ```bash
   node -e "
   const lzString = require('lz-string');
   const fs = require('fs');
   const path = process.argv[1];
   const baseUrl = process.argv[2] || 'https://marimo.app';

   if (!fs.existsSync(path)) {
     console.error('Error: File not found: ' + path);
     process.exit(1);
   }

   const code = fs.readFileSync(path, 'utf8');
   const compressed = lzString.compressToEncodedURIComponent(code);
   const url = baseUrl + '#code/' + compressed;

   console.log(url);
   " <file-path> <base-url>
   ```

3. **Copy to clipboard** (Windows):
   - Use PowerShell to copy the URL to clipboard
   - Display the URL and its length to the user

### Arguments

- `<file-path>`: Path to the Python file (required)
  - Can be absolute or relative to the marimo project root
  - Examples: `examples/markdown/emoji.py`, `./my_notebook.py`

- `--base-url URL`: Base URL for the shareable link (optional)
  - Default: `https://marimo.app`
  - Examples: `http://localhost:3000`, `https://backcast-tan.web.app`

### Examples

```bash
# Generate URL for local example with default marimo.app
/generate-code-url examples/markdown/emoji.py

# Generate URL for a custom base URL
/generate-code-url ./my_notebook.py --base-url http://localhost:3000

# Generate URL for a file in current directory
/generate-code-url notebook.py
```

### Environment

- **Working directory**: `C:\Users\sasai\Documents\marimo`
- **Dependencies**: `lz-string` npm package (included in `node_modules`)
- **Node.js**: Required for running the compression script

### Output

- Displays the generated URL
- Shows URL length (useful for checking if it's too long)
- Copies URL to clipboard automatically (Windows)

### Notes

- This feature requires WASM runtime (Pyodide) mode
- Works with `https://marimo.app` (default marimo.app WASM playground)
- Works with custom WASM deployments (e.g., `https://backcast-tan.web.app`)
- Does NOT work with local WebSocket mode (`pnpm dev`)
- lz-string uses `compressToEncodedURIComponent` for URL-safe encoding
- URL length depends on code size (compression ratio typically 50-60%)
