# marimo + pyodide

## Running the frontend against the latest deploy on PyPi

```bash
cd frontend
PYODIDE=true VITE_WASM_MARIMO_PREBUILT_WHEEL=true pnpm dev
```

## Running the frontend against a local backend

```bash
# build once
hatch build
# server and watch for changes
uv run pyodide/build_and_serve.py
# in another terminal
cd frontend
PYODIDE=true pnpm dev
```

---

## Pyodide ファイル初期化（Backcast）

起動時に `frontend/public/files/` のPythonファイルを仮想ファイルシステムにコピーし、`backcast.py` をデフォルトで開く。

### 実装済みファイル

| ファイル | 変更内容 |
|---------|---------|
| `vite.config.mts` | デフォルトファイル名を `backcast.py` に変更（dev: L59, build: L225, L232） |
| `backcastpro-loader.ts` | `setupPythonFiles()` 関数追加。`/files` からPythonファイルをフェッチし `/marimo/` に書き込み |
| `bootstrap.ts` | `mountFilesystem()` 内で `setupPythonFiles` を呼び出し |
| `fs.ts` | `readIfExist()` で絶対パス `/marimo/${filename}` を使用 |
| `bridge.ts` | `filenameAtom` を優先使用（L150） |

### filename の取得元の違い

| 場所 | 取得方法 | 用途 |
|------|----------|------|
| `mount.tsx` | `mount_config.filename` → `filenameAtom` | UI表示、保存時 |
| `bridge.ts` | `PyodideRouter.getFilename()` | URLパラメータから取得 |
| `bridge.ts` (修正後) | `filenameAtom` → fallback to URL | セッション開始時 |

### Worker と Main Thread の分離

- `backcastpro-loader.ts`, `fs.ts`, `bootstrap.ts` は **Worker** で実行
- `bridge.ts`, `mount.tsx` は **Main Thread** で実行
- Worker には Jotai store へのアクセスがないため、filename は RPC 経由で渡す必要がある

### 修正前後のフロー

**修正前**:
```
mount_config (filename: "backcast.py")
  → mount.tsx → filenameAtom に設定
  → bridge.ts → PyodideRouter.getFilename() → null (URLにfilenameがない)
  → Worker → initNotebookCode({ filename: null }) → notebook.py として処理
```

**修正後**:
```
mount_config (filename: "backcast.py")
  → mount.tsx → filenameAtom に設定
  → bridge.ts → store.get(filenameAtom) → "backcast.py"
  → Worker → initNotebookCode({ filename: "backcast.py" })
  → setupPythonFiles() が先に /marimo/backcast.py に書き込み済み
  → readIfExist("backcast.py") → 日本語コンテンツを取得
```

### 処理フロー

1. `mountFilesystem()` 実行
2. `/marimo/` ディレクトリ作成
3. IndexedDB からメモリに同期
4. `setupBackcastProData()` - DuckDB ファイルロード
5. `setupPythonFiles()` - Pythonファイルコピー（`/marimo/backcast.py` に書き込み）
6. `initNotebookCode({ filename: "backcast.py" })` - 既存ファイルを読み込み

### 動作仕様

- **初回起動**: 全ファイルを `/marimo/` にコピー
- **再訪問**: IndexedDB に既存のファイルはスキップ（`backcast.py` は常に上書き）
- **ユーザー編集**: `backcast.py` 以外は保持される
- **ネットワークエラー**: 起動継続（警告ログのみ）

### デバッグ Tips

- **ブラウザコンソール**: `[BackcastPro]` ログで Python ファイルのフェッチ状況確認
- **IndexedDBクリア**: DevTools → Application → IndexedDB → `/marimo` 削除
- **開発モードテスト**: `pnpm dev:pyodide` で `http://localhost:3000`
- **ネットワーク確認**: `/files/backcast.py` が 200 OK で返ることを確認
