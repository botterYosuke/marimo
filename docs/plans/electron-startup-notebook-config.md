# Electron起動時のノートブック設定

## 概要

Electron版marimoアプリの起動画面を `backcast.py` に設定し、BackcastProの作業フォルダを適切に構成する実装を行った。

## 実装日

2026-01-28

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `electron/main.js` | 起動ノートブックの設定、環境変数の設定 |
| `package.json` | 開発モード用スクリプトの更新 |
| `frontend/public/files/backcast.py` | ゲームテンプレートノートブック |

## 実装詳細

### 1. ノートブック保存場所の設定

ノートブックは以下の場所にコピー・保存される：

```
Windows: C:\Users\{ユーザー名}\AppData\Roaming\marimo\notebooks\backcast.py
```

**理由:**
- `app.getPath("userData")` を使用（アプリ専用の隠しフォルダ）
- パッケージ化されたアプリ内のファイルは読み取り専用のため、書き込み可能な場所にコピーが必要

### 2. getStartupNotebook() ヘルパー関数

```javascript
function getStartupNotebook() {
  // Destination: user's app data folder (writable)
  const userNotebookDir = path.join(app.getPath("userData"), "notebooks");
  const startupNotebook = path.join(userNotebookDir, "backcast.py");

  // Source: template location differs between dev and production
  const templateNotebook = app.isPackaged
    ? path.join(getAppRoot(), "frontend", "dist", "files", "backcast.py")
    : path.join(getAppRoot(), "frontend", "public", "files", "backcast.py");

  // Copy template to writable location if not exists
  if (!existsSync(startupNotebook)) {
    logInfo(`Copying template notebook to ${startupNotebook}`);
    mkdirSync(userNotebookDir, { recursive: true });
    copyFileSync(templateNotebook, startupNotebook);
  }

  return startupNotebook;
}
```

### 3. BACKCASTPRO_CACHE_DIR 環境変数

BackcastProがキャッシュ・作業ファイルを保存するディレクトリを設定：

**プロダクションモード (electron/main.js):**
```javascript
env: {
  ...process.env,
  PATH: process.env.PATH || "",
  BACKCASTPRO_CACHE_DIR: notebookDir,  // notebooks フォルダ
},
```

**開発モード (package.json):**
```json
"start:server": "... cross-env BACKCASTPRO_CACHE_DIR=%APPDATA%\\marimo\\notebooks uv run marimo ..."
```

### 4. 開発モードと本番モードの統一

両モードで同じ動作を実現：

| 項目 | 開発モード | プロダクションモード |
|------|-----------|---------------------|
| テンプレート場所 | `frontend/public/files/backcast.py` | `frontend/dist/files/backcast.py` |
| 保存場所 | `%APPDATA%\marimo\notebooks\` | `%APPDATA%\marimo\notebooks\` |
| BACKCASTPRO_CACHE_DIR | `%APPDATA%\marimo\notebooks` | `%APPDATA%\marimo\notebooks` |

## 起動フロー

```
┌─────────────────────────────────────────────────────┐
│ Electronアプリ起動                                   │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│ getStartupNotebook() 呼び出し                        │
│ - notebooks フォルダ存在確認                         │
│ - backcast.py が無ければテンプレートからコピー        │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│ marimo server 起動                                   │
│ - BACKCASTPRO_CACHE_DIR 環境変数設定                 │
│ - backcast.py を開く                                 │
└─────────────────────┬───────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│ BrowserWindow でフロントエンドを表示                  │
└─────────────────────────────────────────────────────┘
```

## 使用方法

### 開発モード
```bash
pnpm start
```

### プロダクションビルド
```bash
pnpm dist:electron
```

## 注意事項

- 初回起動時のみテンプレートがコピーされる
- ユーザーが `backcast.py` を編集した場合、その変更は保持される
- テンプレートを更新したい場合は、`%APPDATA%\marimo\notebooks\backcast.py` を削除して再起動

---

## 解決済み: 左サイドバーがmarimoのルートフォルダになる問題

### 問題

開発モード（`pnpm start`）でElectronを起動すると、marimoの左サイドバー（ファイルブラウザ）が `C:\Users\sasai\Documents\marimo`（プロジェクトルート）を表示していた。

**期待する動作:** サイドバーは `%APPDATA%\marimo\notebooks\` を表示すべき

### 原因

marimoのファイルブラウザは、サーバープロセスの作業ディレクトリ（`os.getcwd()`）をルートとして使用する。`uv run --project .` を使用すると、作業ディレクトリはプロジェクトルートのままになっていた。

### 解決策

uvの `--directory` オプションを使用して、作業ディレクトリを変更しつつ、`--project` でプロジェクトを参照する。

**最終的な `start:server` スクリプト:**

```json
"start:server": "pnpm setup:notebook && powershell -NoProfile -Command \"$notebookDir = $env:APPDATA + '\\marimo\\notebooks'; $projectDir = (Get-Location).Path; $env:BACKCASTPRO_CACHE_DIR = $notebookDir; & $env:USERPROFILE\\.local\\bin\\uv.exe run --directory $notebookDir --project $projectDir marimo edit --no-token --headless --port 2718 backcast.py\""
```

**ポイント:**
- `--directory $notebookDir` - uvが作業ディレクトリを `%APPDATA%\marimo\notebooks` に変更
- `--project $projectDir` - marimoプロジェクトを参照（依存関係解決用）
- `backcast.py` - 作業ディレクトリが変更されているので相対パスで指定

### 試した解決策（失敗）

1. **PowerShellの`Set-Location`で作業ディレクトリを変更**
   - **結果:** `uv run marimo` が `pyproject.toml` を見つけられず失敗
   - エラー: `Failed to spawn: marimo - program not found`

2. **`--project .` オプションのみ追加**
   - 作業ディレクトリを変更せず、`uv run --project .` でプロジェクトを明示
   - **結果:** marimoは起動するが、サイドバーは依然としてプロジェクトルートを表示

### 技術的詳細

marimoのファイルブラウザのルート決定ロジック（`marimo/_server/files/os_file_system.py`）:

```python
class OSFileSystem(FileSystem):
    def get_root(self) -> str:
        return os.getcwd()  # サーバープロセスのcwdを返す
```

uvの`--directory`オプションにより、marimoサーバー起動前に作業ディレクトリが変更され、`os.getcwd()` が正しいパスを返すようになった。
