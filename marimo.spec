# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for marimo Electron app
This spec file is used to build a standalone executable for the marimo Python server
that will be bundled with the Electron app.

Usage:
    pyinstaller marimo.spec
"""

import os
import sys
from pathlib import Path

# Get the project root directory
project_root = Path(SPECPATH)

# Block cipher key for Python bytecode obfuscation (optional)
block_cipher = None

# Collect data files, only including directories/files that exist
datas = []
# Include static files (frontend assets)
static_dir = project_root / 'marimo' / '_static'
if static_dir.exists():
    datas.append((str(static_dir), 'marimo/_static'))

# Include LSP files (may not exist if frontend hasn't been built)
lsp_dir = project_root / 'marimo' / '_lsp'
if lsp_dir.exists():
    datas.append((str(lsp_dir), 'marimo/_lsp'))

# Include tutorial files
tutorials_dir = project_root / 'marimo' / '_tutorials'
if tutorials_dir.exists():
    datas.append((str(tutorials_dir), 'marimo/_tutorials'))

# Include third-party licenses
third_party_txt = project_root / 'third_party.txt'
if third_party_txt.exists():
    datas.append((str(third_party_txt), '.'))

third_party_licenses = project_root / 'third_party_licenses.txt'
if third_party_licenses.exists():
    datas.append((str(third_party_licenses), '.'))

# Analysis: Analyze Python dependencies and collect necessary files
a = Analysis(
    ['marimo/__main__.py'],
    pathex=[str(project_root)],
    binaries=[],
    datas=datas,
    hiddenimports=[
        # Core marimo modules
        'marimo._cli',
        'marimo._cli.cli',
        'marimo._cli.cli_validators',
        'marimo._cli.config',
        'marimo._cli.config.commands',
        'marimo._cli.convert',
        'marimo._cli.convert.commands',
        'marimo._cli.development',
        'marimo._cli.development.commands',
        'marimo._cli.export',
        'marimo._cli.export.commands',
        'marimo._cli.sandbox',
        # Runtime modules
        'marimo._runtime',
        'marimo._server',
        # Output and plugins
        'marimo._output',
        'marimo._plugins',
        # SQL support (optional dependency)
        'marimo._sql',
        # Serialization (used throughout marimo._messaging, _server, _ast, etc.)
        'msgspec',
        'msgspec.json',
        'msgspec.msgpack',
        'msgspec.structs',
        # pymdownx — all submodules (dynamically loaded by markdown library in marimo/_output/md.py)
        'pymdownx',
        'pymdownx.__meta__',
        'pymdownx._bypassnorm',
        'pymdownx.arithmatex',
        'pymdownx.b64',
        'pymdownx.betterem',
        'pymdownx.caret',
        'pymdownx.critic',
        'pymdownx.details',
        'pymdownx.emoji',
        'pymdownx.emoji1_db',
        'pymdownx.escapeall',
        'pymdownx.extra',
        'pymdownx.fancylists',
        'pymdownx.gemoji_db',
        'pymdownx.highlight',
        'pymdownx.inlinehilite',
        'pymdownx.keymap_db',
        'pymdownx.keys',
        'pymdownx.magiclink',
        'pymdownx.mark',
        'pymdownx.pathconverter',
        'pymdownx.progressbar',
        'pymdownx.quotes',
        'pymdownx.saneheaders',
        'pymdownx.slugs',
        'pymdownx.smartsymbols',
        'pymdownx.snippets',
        'pymdownx.striphtml',
        'pymdownx.superfences',
        'pymdownx.tabbed',
        'pymdownx.tasklist',
        'pymdownx.tilde',
        'pymdownx.twemoji_db',
        'pymdownx.util',
        'pymdownx.blocks',
        'pymdownx.blocks.admonition',
        'pymdownx.blocks.block',
        'pymdownx.blocks.caption',
        'pymdownx.blocks.definition',
        'pymdownx.blocks.details',
        'pymdownx.blocks.html',
        'pymdownx.blocks.tab',
        # Markdown core
        'markdown',
        'markdown.preprocessors',
        'markdown.extensions',
        'markdown.extensions.md_in_html',
        # BackcastPro for trading strategy backtesting
        'BackcastPro',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude unnecessary modules to reduce size
        'tkinter',
        'matplotlib.tests',
        'numpy.tests',
        'pytest',
        'IPython',
        'jupyter',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# PyInstaller: Remove duplicate files from dependencies
pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# Executable: Create the final executable
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='marimo-server',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Console mode for server
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,  # Can be set to icon path if needed
)
