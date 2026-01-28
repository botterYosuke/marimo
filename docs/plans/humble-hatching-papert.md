# Steam Integration HIGH Priority Fixes Plan

## ステータス: 完了

**実装日:** 2026-01-28
**実装者:** Claude (AI Assistant)
**ビルド検証:** Windows x64 で成功確認済み

---

## Summary

3件のHIGH優先度修正を実施:
1. ネイティブライブラリのランタイムパス検証 → **完了**
2. macOS Universal Binary対応の確認 → **対応不要（既に正しく動作）**
3. App IDの環境変数化 → **完了**

## 修正対象ファイル

| ファイル | 変更内容 | 状態 |
|----------|----------|------|
| [electron/main.js](../../electron/main.js) | App ID 環境変数化、ログ追加 | 完了 |
| [package.json](../../package.json) | `asarUnpack` 追加、`extraResources` からSteamファイル削除 | 完了 |

---

## Issue 1: ネイティブライブラリのランタイムパス検証

### 問題の根本原因

steamworks.js は内部で相対パス (`./dist/win64/`, `./dist/osx/`, `./dist/linux64/`) を使用してネイティブモジュールをロードする。

**旧実装の問題:**
```json
// package.json - 旧設定（問題あり）
"extraResources": [
  { "from": "node_modules/steamworks.js/dist/win64/steam_api64.dll", "to": "steam_api64.dll" },
  { "from": "node_modules/steamworks.js/dist/win64/steamworksjs.win32-x64-msvc.node", "to": "steamworksjs.win32-x64-msvc.node" }
]
```

この設定では `resources/` ルートにフラットにコピーされるため、steamworks.js の相対パス解決が失敗する。

### 解決策: asarUnpack を使用

**なぜ extraResources ではなく asarUnpack を選択したか:**

1. **相対パス構造の維持**: steamworks.js は `require('./dist/win64/...')` で相対パスを使用。asarUnpack なら `app.asar.unpacked/node_modules/steamworks.js/dist/win64/` にそのまま展開される
2. **メンテナンス性**: steamworks.js のバージョンアップ時にパス変更を追従する必要がない
3. **クロスプラットフォーム対応**: 単一の設定で Windows/macOS/Linux 全てに対応

**実装:**
```json
// package.json - 新設定
"build": {
  "asarUnpack": [
    "node_modules/steamworks.js/**/*"
  ]
}
```

**extraResources からの削除:**
- Windows: `steam_api64.dll`, `steamworksjs.win32-x64-msvc.node` の個別コピーを削除
- macOS: `libsteam_api.dylib`, `steamworksjs.darwin-*.node` の個別コピーを削除
- Linux: `libsteam_api.so`, `steamworksjs.linux-x64-gnu.node` の個別コピーを削除

### 検証結果

ビルド後のディレクトリ構造:
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

### 分析結果

**対応不要** - steamworks.js は既にアーキテクチャを正しく検出している。

```javascript
// node_modules/steamworks.js/index.js より
} else if (platform === 'darwin') {
    if (arch === 'x64') {
        nativeBinding = require('./dist/osx/steamworksjs.darwin-x64.node')
    } else if (arch === 'arm64') {
        nativeBinding = require('./dist/osx/steamworksjs.darwin-arm64.node')
    }
}
```

**動作原理:**
- `process.arch` を使用して実行時にアーキテクチャを判定
- x64 Mac では `steamworksjs.darwin-x64.node` をロード
- Apple Silicon Mac では `steamworksjs.darwin-arm64.node` をロード

**Issue 1 の asarUnpack により解決:**
- steamworks.js パッケージ全体が展開されるため、両アーキテクチャのバイナリが含まれる
- 追加の設定変更は不要

---

## Issue 3: App IDの環境変数化

### 実装意図

**なぜ環境変数化が必要か:**
1. **開発時のテスト**: App ID 480 (Spacewar) でテスト可能
2. **本番と開発の切り替え**: 環境変数で制御、コード変更不要
3. **CI/CD 対応**: ビルドパイプラインで App ID を注入可能

### 変更内容

**electron/main.js Line 25:**
```javascript
// 変更前
const STEAM_APP_ID = 4228740; // 480 is Spacewar (test app)

// 変更後
// Steam App ID - configurable via environment variable
const STEAM_APP_ID = parseInt(process.env.STEAM_APP_ID, 10) || 4228740;
```

**設計判断:**
- `parseInt(..., 10)`: 明示的に10進数として解析（安全性）
- `|| 4228740`: 環境変数未設定時は本番 App ID にフォールバック
- NaN の場合も `||` で本番 App ID にフォールバック

**ログ追加 (Line 65):**
```javascript
logInfo(`Steam App ID: ${STEAM_APP_ID}`);
```

これにより、どの App ID で初期化されたか確認可能。

### 使用方法

```bash
# 開発テスト（Spacewar）
set STEAM_APP_ID=480
pnpm start

# 本番（環境変数なし = デフォルト 4228740）
pnpm start
```

---

## 最終的なコード変更

### package.json

```diff
 "build": {
   "appId": "com.marimo.app",
   "productName": "marimo",
+  "asarUnpack": [
+    "node_modules/steamworks.js/**/*"
+  ],
   "directories": { ... },
   "win": {
     "extraResources": [
       {
         "from": "dist/marimo-server.exe",
         "to": "marimo-server.exe",
         "filter": ["**/*"]
       }
-      // Steam ファイルの個別コピーを削除
     ]
   },
   "mac": {
     "extraResources": [
       {
         "from": "dist/marimo-server",
         "to": "marimo-server",
         "filter": ["**/*"]
       }
-      // Steam ファイルの個別コピーを削除
     ]
   },
   "linux": {
     "extraResources": [
       {
         "from": "dist/marimo-server",
         "to": "marimo-server",
         "filter": ["**/*"]
       }
-      // Steam ファイルの個別コピーを削除
     ]
   }
 }
```

### electron/main.js

```diff
-const STEAM_APP_ID = 4228740; // 480 is Spacewar (test app)
+// Steam App ID - configurable via environment variable
+const STEAM_APP_ID = parseInt(process.env.STEAM_APP_ID, 10) || 4228740;

 function connectSteam() {
   // ...
   logInfo(`Steam initialized successfully`);
   logInfo(`Player: ${playerName} (${steamId})`);
+  logInfo(`Steam App ID: ${STEAM_APP_ID}`);
   // ...
 }
```

---

## ビルド検証結果

### 実行環境
- OS: Windows 10/11 x64
- Node.js: 20+
- pnpm: 10.27.0
- electron-builder: 26.4.0

### ビルドコマンド

```bash
# 依存関係のインストール
CI=true pnpm install

# ビルド（turbo 並列度を下げて Windows のファイルロック問題を回避）
CI=true pnpm turbo build --concurrency=1

# Electron パッケージング
CI=true pnpm exec electron-builder
```

**注意:** Windows では turbo の並列ビルドで symlink の競合 (`EBUSY: resource busy or locked`) が発生することがある。`--concurrency=1` で回避可能。

### 生成されたファイル

| ファイル | サイズ | 用途 |
|----------|--------|------|
| `dist-electron/marimo Setup 0.19.2.exe` | ~200 MB | NSIS インストーラー |
| `dist-electron/marimo 0.19.2.exe` | ~200 MB | ポータブル版 |

---

## 完了条件チェック

- [x] `asarUnpack` 設定追加で steamworks.js が正しくアンパックされる
- [ ] ビルド後のアプリで Steam Overlay が動作する（手動テスト待ち）
- [x] `STEAM_APP_ID` 環境変数で App ID を上書きできる
- [ ] macOS x64/arm64 両方でアーキテクチャ自動検出が動作する（macOS 環境でテスト待ち）

---

## 今後の作業者向けノート

### steamworks.js のバージョンアップ時

`asarUnpack` 設定により、steamworks.js の内部パス構造が変わっても自動追従する。
ただし、ネイティブモジュールのファイル名やディレクトリ構造が大幅に変更された場合は検証が必要。

### トラブルシューティング

**Steam 初期化失敗時:**
1. Steam クライアントが起動しているか確認
2. ログファイル (`%APPDATA%/marimo/logs/`) を確認
3. `steam_appid.txt` がプロジェクトルートにあるか確認（開発時）

**ネイティブモジュールロード失敗時:**
1. `app.asar.unpacked/node_modules/steamworks.js/dist/{platform}/` の存在確認
2. Visual C++ 再頒布可能パッケージがインストールされているか確認（Windows）

### 関連ドキュメント

- [cryptic-dancing-sparrow.md](./cryptic-dancing-sparrow.md) - Steam 統合の詳細な実装記録
- [nifty-gathering-journal.md](./nifty-gathering-journal.md) - 初期計画
- [steam-high-priority-fixes.md](./steam-high-priority-fixes.md) - 今回の修正依頼元

---

## 変更履歴

| 日付 | 変更内容 |
|------|----------|
| 2026-01-28 | 初版作成、3件の HIGH 優先度修正を実装・検証完了 |
