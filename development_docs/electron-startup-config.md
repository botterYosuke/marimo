# Electron 起動時のノートブック設定

> **実装日:** 2026-01-28

## 概要

Electron版marimoアプリの起動画面を `backcast.py` に設定し、BackcastProの作業フォルダを適切に構成する実装。

---

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `electron/main.js` | 起動ノートブックの設定、環境変数の設定 |
| `package.json` | 開発モード用スクリプトの更新 |
| `frontend/public/files/backcast.py` | ゲームテンプレートノートブック |

---

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
  const userNotebookDir = path.join(app.getPath("userData"), "notebooks");
  const startupNotebook = path.join(userNotebookDir, "backcast.py");

  const templateNotebook = app.isPackaged
    ? path.join(getAppRoot(), "frontend", "dist", "files", "backcast.py")
    : path.join(getAppRoot(), "frontend", "public", "files", "backcast.py");

  if (!existsSync(startupNotebook)) {
    mkdirSync(userNotebookDir, { recursive: true });
    copyFileSync(templateNotebook, startupNotebook);
  }

  return startupNotebook;
}
```

### 3. BACKCASTPRO_CACHE_DIR 環境変数

| モード | 設定方法 | 値 |
|--------|----------|-----|
| プロダクション | `electron/main.js` | `notebooks` フォルダ |
| 開発 | `package.json` | `%APPDATA%\marimo\notebooks` |

---

## 起動フロー

```
Electronアプリ起動
    ↓
getStartupNotebook() 呼び出し
- notebooks フォルダ存在確認
- backcast.py が無ければテンプレートからコピー
    ↓
marimo server 起動
- BACKCASTPRO_CACHE_DIR 環境変数設定
- backcast.py を開く
    ↓
BrowserWindow でフロントエンドを表示
```

---

## 解決済み: 左サイドバーがmarimoのルートフォルダになる問題

### 問題

開発モードでElectronを起動すると、marimoの左サイドバーがプロジェクトルートを表示していた。

### 解決策

uvの `--directory` オプションを使用して、作業ディレクトリを変更。

```json
"start:server": "pnpm setup:notebook && powershell -NoProfile -Command \"$notebookDir = $env:APPDATA + '\\marimo\\notebooks'; $projectDir = (Get-Location).Path; $env:BACKCASTPRO_CACHE_DIR = $notebookDir; & $env:USERPROFILE\\.local\\bin\\uv.exe run --directory $notebookDir --project $projectDir marimo edit --no-token --headless --port 2718 backcast.py\""
```

---

## 注意事項

- 初回起動時のみテンプレートがコピーされる
- ユーザーが `backcast.py` を編集した場合、その変更は保持される
- テンプレートを更新したい場合は、`%APPDATA%\marimo\notebooks\backcast.py` を削除して再起動
