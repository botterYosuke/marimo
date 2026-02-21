---
name: game-setup
description: "Backcast ゲーム環境を整備し、サーバー起動・ファイル配置・接続確認・ゲーム状態リセットを行う"
allowed-tools:
  - Bash(cd /d/Documents/marimo && pnpm dev*)
  - Bash(ls*)
  - Bash(cp*)
  - Bash(mkdir*)
  - Bash(rm*)
  - Bash(taskkill*)
  - Bash(netstat*)
  - Bash(curl*)
  - Bash(sleep*)
  - Read
  - Glob
  - Grep
---

# ゲーム環境整備・起動・リセット

## 役割

Backcast ゲームを起動できる状態にし、後続の game-play スキルに引き渡す。
以前のプレイ状態が残っている場合はリセットする。

## 実行手順

### 1. ファイル配置確認

```bash
ls "C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py"
```

見つからない場合 → サンプルからコピー:

```bash
mkdir -p "C:\Users\sasac\AppData\Roaming\marimo\notebooks"
cp /d/Documents/marimo/src-tauri/sample-notebooks/backcast.py "C:\Users\sasac\AppData\Roaming\marimo\notebooks/"
cp /d/Documents/marimo/src-tauri/sample-notebooks/game_setup.py "C:\Users\sasac\AppData\Roaming\marimo\notebooks/"
cp /d/Documents/marimo/src-tauri/sample-notebooks/skill_events.py "C:\Users\sasac\AppData\Roaming\marimo\notebooks/"
cp /d/Documents/marimo/src-tauri/sample-notebooks/backtest_wrapper.py "C:\Users\sasac\AppData\Roaming\marimo\notebooks/"
cp /d/Documents/marimo/src-tauri/sample-notebooks/chart.py "C:\Users\sasac\AppData\Roaming\marimo\notebooks/"
cp /d/Documents/marimo/src-tauri/sample-notebooks/headless_broadcast.py "C:\Users\sasac\AppData\Roaming\marimo\notebooks/"
cp /d/Documents/marimo/src-tauri/sample-notebooks/progress_manager.py "C:\Users\sasac\AppData\Roaming\marimo\notebooks/"

# グリッドレイアウト定義も必須
mkdir -p "C:\Users\sasac\AppData\Roaming\marimo\notebooks\layouts"
cp /d/Documents/marimo/src-tauri/sample-notebooks/layouts/backcast.grid.json \
   "C:\Users\sasac\AppData\Roaming\marimo\notebooks/layouts/"
```

### 2. 既存プロセスのクリーンアップ

```bash
taskkill //F //IM marimo.exe 2>/dev/null; echo "cleanup done"
```

### 3. ゲーム状態リセット（前回プレイの状態が残っている場合）

```bash
rm -f "C:\Users\sasac\AppData\Roaming\marimo\notebooks\.backcast.progress.json"
```

### 4. marimo サーバー起動

**方法1: pnpm（推奨）**
```bash
cd /d/Documents/marimo && pnpm dev
# バックエンド: port 2718 / フロントエンド: port 3000
```

**方法2: 直接 Python**
```bash
cd /d/Documents/marimo
python -m marimo edit --no-token --port 2718 \
  "C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py"
```

### 5. E2E テスト用追加サーバーの確認（game-play で E2E テストを実行する場合）

Playwright の playwright.config.ts は port 2718 に加えて 2719〜2724 のサーバーも使用する。
`reuseExistingServer: true` のため既に起動中なら問題ないが、**port 2724 だけは手動起動が必要なことが多い**。

```bash
# 各ポートの確認
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:2724/foo 2>/dev/null
```

200 以外の場合は起動する（**`MSYS_NO_PATHCONV=1` が必須**。Git Bash が `/foo` を Windows パスに変換するバグを防ぐ）:

```bash
cd /d/Documents/marimo/frontend && MSYS_NO_PATHCONV=1 uv run marimo -q run e2e-tests/py/output.py -p 2724 --headless --no-token --base-url=/foo &
sleep 5 && curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:2724/foo
```

### 6. 起動確認

以下をすべて確認:
- http://localhost:2718 にアクセス可能（HTTP 200）
- E2E テストを行う場合は port 2724 も HTTP 200

## 出力

実行結果を以下の形式で報告:

```
## game-setup 結果
- ステータス: READY / FAILED
- 接続URL: http://localhost:XXXX
- ファイル配置: OK / コピー実行
- リセット: 実行済み / 不要
- 失敗理由: (FAILED の場合のみ)
```

## トラブルシューティング

| 症状 | 原因 | 解決策 |
|------|------|--------|
| `pixi: No such file or directory` | bash サブシェルで PATH 未設定 | `pnpm dev` を使用 |
| `Port 2718 is already in use` | 既存プロセス | `netstat -ano \| findstr :2718` → `taskkill /PID <PID> /F` |
| `backcast.py not found` | ファイル未配置 | 手順1のコピーを実行 |
| `ModuleNotFoundError: BackcastPro` | 依存未インストール | `export PYTHONPATH="/d/Documents/BackcastPro:$PYTHONPATH"` |
| `Error: Invalid value for '--base-url': Must start with /` | Git Bash が `/foo` を Windows パス（`C:\foo`）に変換する | `MSYS_NO_PATHCONV=1` を環境変数に設定して実行 |
| E2E テストで `Timed out waiting 30000ms from config.webServer` | port 2724 が未起動 | 手順5の port 2724 起動コマンドを実行 |
