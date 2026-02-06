# Steam 統合 HIGH 優先度修正

> **ステータス:** 完了 (2026-01-28)

## 概要

3件のHIGH優先度修正を実施:
1. ネイティブライブラリのランタイムパス検証
2. macOS Universal Binary対応の確認
3. App IDの環境変数化

---

## 修正対象ファイル

| ファイル | 変更内容 |
|----------|----------|
| `electron/main.js` | App ID 環境変数化、ログ追加 |
| `package.json` | `asarUnpack` 追加、`extraResources` からSteamファイル削除 |

---

## Issue 1: ネイティブライブラリのランタイムパス検証

### 問題の根本原因

steamworks.js は内部で相対パス (`./dist/win64/` 等) を使用してネイティブモジュールをロードする。

### 解決策: asarUnpack を使用

```json
"build": {
  "asarUnpack": [
    "node_modules/steamworks.js/**/*"
  ]
}
```

**なぜ extraResources ではなく asarUnpack を選択したか:**
- 相対パス構造の維持
- メンテナンス性
- クロスプラットフォーム対応

### 検証結果

```
dist-electron/win-unpacked/resources/app.asar.unpacked/
└── node_modules/
    └── steamworks.js/
        └── dist/
            └── win64/
                ├── steam_api64.dll         (300 KB)
                ├── steam_api64.lib         (374 KB)
                └── steamworksjs.win32-x64-msvc.node (1.7 MB)
```

---

## Issue 2: macOS Universal Binary対応

**対応不要** - steamworks.js は既にアーキテクチャを正しく検出している。

```javascript
// node_modules/steamworks.js/index.js より
if (platform === 'darwin') {
    if (arch === 'x64') {
        nativeBinding = require('./dist/osx/steamworksjs.darwin-x64.node')
    } else if (arch === 'arm64') {
        nativeBinding = require('./dist/osx/steamworksjs.darwin-arm64.node')
    }
}
```

---

## Issue 3: App IDの環境変数化

### 変更内容

```javascript
// 変更前
const STEAM_APP_ID = 4228740;

// 変更後
const STEAM_APP_ID = parseInt(process.env.STEAM_APP_ID, 10) || 4228740;
```

### 使用方法

```bash
# 開発テスト（Spacewar）
set STEAM_APP_ID=480
pnpm start

# 本番（環境変数なし = デフォルト 4228740）
pnpm start
```

---

## ビルド検証

### 実行環境
- OS: Windows 10/11 x64
- Node.js: 20+
- pnpm: 10.27.0
- electron-builder: 26.4.0

### ビルドコマンド

```bash
# 依存関係のインストール
CI=true pnpm install

# ビルド（並列度を下げてファイルロック問題を回避）
CI=true pnpm turbo build --concurrency=1

# Electron パッケージング
CI=true pnpm exec electron-builder
```

---

## トラブルシューティング

### Steam 初期化失敗時
1. Steam クライアントが起動しているか確認
2. ログファイル確認
3. `steam_appid.txt` がプロジェクトルートにあるか確認（開発時）

### ネイティブモジュールロード失敗時
1. `app.asar.unpacked/node_modules/steamworks.js/dist/{platform}/` の存在確認
2. Visual C++ 再頒布可能パッケージがインストールされているか確認（Windows）
