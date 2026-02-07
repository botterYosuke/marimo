# Pyodide版でファイルコピーと初期ファイル開きを実装

## 概要
pyodide版（Firebase デプロイ）で、起動時に `frontend/public/files/` のPythonファイルを仮想ファイルシステムにコピーし、`backcast.py` をデフォルトで開くようにする。

## 完了した作業

### ✅ vite.config.mts - デフォルトファイル名変更
- Line 59 (dev): `filename: "backcast.py"`
- Line 225 (build): `"backcast.py"`
- Line 232 (build): `filename: "backcast.py"`

### ✅ backcastpro-loader.ts - Pythonファイルローダー追加
- `FILES_BASE_URL = "/files"` （絶対パスに修正）
- `PYTHON_FILES` 配列（12ファイル）
- `setupPythonFiles()` 関数
- `backcast.py` は常に上書き（他はスキップ）

### ✅ bootstrap.ts - ローダー呼び出し追加
- `setupPythonFiles` をインポート
- `mountFilesystem()` 内で呼び出し

### ✅ fs.ts - 絶対パス使用に修正
- `readIfExist()` 内: `FS.readFile(absPath)` で `/marimo/${filename}` を使用
- `FS.writeFile()`: 絶対パス `/marimo/${filename}` を使用

### ✅ bridge.ts - filenameAtom を優先使用（重要な修正）
- Line 150: `const filename = store.get(filenameAtom) ?? PyodideRouter.getFilename();`
- mount_config の filename がセッション開始時に正しく使用されるように

---

## 新たな知見

### 1. filename の取得元の違い
| 場所 | 取得方法 | 用途 |
|------|----------|------|
| `mount.tsx` | `mount_config.filename` → `filenameAtom` | UI表示、保存時 |
| `bridge.ts` | `PyodideRouter.getFilename()` | URLパラメータから取得 |
| `bridge.ts` (修正後) | `filenameAtom` → fallback to URL | セッション開始時 |

### 2. mount_config と URL パラメータの関係
- `vite.config.mts` で `mount_config.filename = "backcast.py"` を設定
- `mount.tsx` で `filenameAtom` に設定される
- **しかし** URLには `?filename=backcast.py` は自動設定されない
- `PyodideRouter.getFilename()` は URL から取得するため `null` になる

### 3. Worker と Main Thread の分離
- `backcastpro-loader.ts`, `fs.ts`, `bootstrap.ts` は **Worker** で実行
- `bridge.ts`, `mount.tsx` は **Main Thread** で実行
- Worker には Jotai store へのアクセスがないため、filename は RPC 経由で渡す必要がある

---

## 設計変更

### 修正前の問題
```
mount_config (filename: "backcast.py")
     ↓
mount.tsx → filenameAtom に設定
     ↓
bridge.ts → PyodideRouter.getFilename() → null (URLにfilenameがない)
     ↓
Worker → initNotebookCode({ filename: null }) → notebook.py として処理
```

### 修正後のフロー
```
mount_config (filename: "backcast.py")
     ↓
mount.tsx → filenameAtom に設定
     ↓
bridge.ts → store.get(filenameAtom) → "backcast.py" ✅
     ↓
Worker → initNotebookCode({ filename: "backcast.py" })
     ↓
setupPythonFiles() が先に /marimo/backcast.py に書き込み済み
     ↓
readIfExist("backcast.py") → 日本語コンテンツを取得 ✅
```

---

## Tips

### デバッグ方法
- **ブラウザコンソール**: `[BackcastPro]` ログで Python ファイルのフェッチ状況確認
- **IndexedDBクリア**: DevTools → Application → IndexedDB → `/marimo` 削除
- **開発モードテスト**: `pnpm dev:pyodide` で `http://localhost:3000`
- **ネットワーク確認**: `/files/backcast.py` が 200 OK で返ることを確認

### ファイル配信確認
```powershell
curl -I http://localhost:3000/files/backcast.py
# Content-Type が text/html の場合は Vite SPA fallback → ファイルが見つからない
# Content-Type が空または適切な場合 → 正常
```

### Worker でのデバッグログ追加（一時的）
```typescript
import { Logger } from "../../../utils/Logger";
Logger.log(`[initNotebookCode] filename=${filename}`);
```

---

## 処理フロー（最終版）

1. `mountFilesystem()` 実行
2. `/marimo/` ディレクトリ作成
3. IndexedDB からメモリに同期
4. `setupBackcastProData()` - DuckDB ファイルロード
5. **`setupPythonFiles()`** - Pythonファイルコピー（`/marimo/backcast.py` に書き込み）
6. `initNotebookCode({ filename: "backcast.py" })` - 既存ファイルを読み込み

## 動作仕様
- **初回起動**: 全ファイルを `/marimo/` にコピー
- **再訪問**: IndexedDB に既存のファイルはスキップ（`backcast.py` は常に上書き）
- **ユーザー編集**: `backcast.py` 以外は保持される
- **ネットワークエラー**: 起動継続（警告ログのみ）

## 検証方法
1. `pnpm dev:pyodide` で起動
2. ブラウザキャッシュ/IndexedDB をクリア
3. `http://localhost:3000` にアクセス
4. `backcast.py` が日本語コンテンツで開くことを確認
5. FILES パネルに全12ファイルが表示されることを確認
