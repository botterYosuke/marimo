#!/bin/bash
# Build mkDocs documentation for Vercel deployment

set -e

# プロジェクトルートに移動
cd "$(dirname "$0")/.."

pip install --break-system-packages -r requirements-docs.txt
pip install --break-system-packages -e ./docs
pip install --break-system-packages -e .
python -m mkdocs build
