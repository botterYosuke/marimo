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

---

## Firebase デプロイ（Pyodide ビルド）

### ビルドコマンド

```bash
cd frontend
PYODIDE=true VITE_MARIMO_VERSION=0.19.2 VITE_USE_CUSTOM_WHEEL=true pnpm build
```

### 既知の問題と対処

#### 問題1: `/wasm/controller.js` の MIME タイプエラー

```
Failed to load module script: Expected a JavaScript-or-Wasm module script
but the server responded with a MIME type of "text/html".
```

**原因**: Firebase の `rewrites: ["**" → "/index.html"]` が catch-all のため、`dist/` に存在しないファイルへのリクエストを `index.html`（HTML）として返す。ブラウザは JS MIME type を期待するため失敗する。

**対処**: `frontend/public/wasm/controller.js` に placeholder ES module を置く。Vite ビルド時に `public/` の内容が `dist/` にコピーされるため、Firebase が静的ファイルとして正しい MIME type で配信できる。

- 対象ファイル: `frontend/public/wasm/controller.js`
- Firebase は静的ファイルを rewrite より優先するため、`firebase.json` の変更は不要

#### 問題2: `TypeError: sa is not a function`（panels チャンク）

```
TypeError: sa is not a function
    at panels-Cx_inYbb.js:1:34411
```

**原因**: `vite.config.mts` の vega-lite resolve aliases がPyodide ビルドのモジュールグラフを破壊する。これらの aliases は rolldown-vite 7.3.1 の型解決バグ回避のために追加されたが、`.d.ts` ファイルを `.js` として解決するため、`panels` チャンクが `layout.js` の Top-Level Await 完了前に factory 関数を呼び出してしまう。

**対処**: `vite.config.mts` で `alias` を `isPyodide` で条件分岐し、Pyodide ビルドでは aliases を無効化する。

```typescript
// frontend/vite.config.mts
alias: isPyodide ? {} : {
  'vega-lite/types_unstable/channeldef.js': 'vega-lite/build/channeldef.d.ts',
  // ...
},
```

- 非 Pyodide ビルド（Tauri/Electron）は aliases を維持し、rolldown-vite のバグ回避を継続

### wasm/controller.js の動作

`frontend/src/core/wasm/worker/getController.ts` がランタイムに `/wasm/controller.js?version=X.Y.Z` を動的 import する。失敗した場合は `DefaultWasmController` にフォールバックする（`backcastpro-loader.ts` で拡張）。

`frontend/public/wasm/controller.js` は空の ES module（`export {}`）で、ファイルの存在を保証するだけの placeholder。実際のコントローラは `backcastpro-loader.ts` の `BackcastProWasmController` が担う。
