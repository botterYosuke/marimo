# Electron版 デバッグ引き継ぎドキュメント

## 現在のステータス

- ビルドコマンド: `pnpm exec electron-builder --win --x64 --dir`
- ビルドは成功する
- **✅ 起動問題は解決済み** — パッケージ版が正常に起動する
- ログファイル作成・ウィンドウ生成・サーバー起動すべて確認済み

---

## 完了した作業

- ✅ Electron バージョンを 39.5.1 にピン留め（`package.json`: `"electron": "39.5.1"`）
- ✅ `node_modules/electron` を削除して `pnpm install` で再インストール
- ✅ `getMarimoServerExecutable()` の二重 `resources` パスを修正（`paths.js`）
- ✅ `preload.js` に `__MARIMO_MOUNT_CONFIG__` 注入コードを復元
- ✅ デバッグコード（`[DEBUG-*]` ログ、`_debugWriteFile`）をすべて削除
- ✅ ビルド出力の確認 (`dist-electron/win-unpacked/`) - 正常に生成
- ✅ asar 内のファイル構成確認 - `electron/main.js`, `utils/*`, `frontend/dist/*` すべて含まれている
- ✅ asar 内に `node_modules/electron`（npm パッケージ）が含まれていないことを確認
- ✅ **根本原因特定: `ELECTRON_RUN_AS_NODE=1` 環境変数**
- ✅ **`electron/entry.cjs` 作成 — 起動時に `ELECTRON_RUN_AS_NODE` を除去してプロセス再起動**
- ✅ **`package.json` のエントリポイントを `electron/entry.cjs` に変更**
- ✅ **`.md` ファイルを asar から除外（`"!electron/**/*.md"` を files に追加）**
- ✅ パッケージ版の起動テスト完了（`ELECTRON_RUN_AS_NODE=1` 環境でも正常動作）

## 未完了の作業

- [ ] エンドユーザー環境での最終テスト（Explorer からのダブルクリック起動）
- [ ] フロントエンドの表示・サーバー接続の確認（marimo-server.exe が必要）
- [ ] Steam 連携のテスト（Steam 起動状態で）

---

## 根本原因と修正（2026-02-12 解決）

### 根本原因: `ELECTRON_RUN_AS_NODE=1` 環境変数

**症状:** パッケージ版 `marimo.exe` が ExitCode 0 で即座に終了。stdout/stderr ともに空。ログファイルすら作成されない。

**原因:** VS Code の統合ターミナル（Claude Code 等の拡張機能）が `ELECTRON_RUN_AS_NODE=1` を環境変数に設定していた。この変数が設定されていると Electron バイナリは **GUI アプリではなく Node.js ランタイムとして動作** し、以下が起きる:

1. `process.type` が `undefined` になる（正常時は `'browser'`）
2. 組み込み `electron` モジュール（`app`, `BrowserWindow` 等）が利用不可
3. ESM `import { app } from "electron"` が失敗 → モジュールグラフ全体がロードされない
4. プロセスが何も実行せずに終了（ExitCode: 0）

**検証方法:**
```bash
# 環境変数の確認
node -e "console.log('ELECTRON_RUN_AS_NODE:', process.env.ELECTRON_RUN_AS_NODE)"
# → "1" が出力される場合、この問題が発生する

# ELECTRON_RUN_AS_NODE を除去して起動するとウィンドウが表示される
node -e "
const env = {...process.env};
delete env.ELECTRON_RUN_AS_NODE;
require('child_process').spawn('dist-electron/win-unpacked/marimo.exe', [], {env, stdio:'inherit'});
"
```

**なぜ発見が困難だったか:**
- エラーメッセージが一切出力されない（サイレント終了）
- `electron.exe -e "..."` テストは `RunAsNode` モードで実行されるため、バイナリ自体は正常に見える
- asar integrity、署名、ESM/CJS 問題など他の仮説が多数あった
- VS Code ターミナル固有の環境変数であるため、エクスプローラーからのダブルクリックでは再現しない可能性がある

### 修正内容

**新規ファイル: `electron/entry.cjs`**

CJS エントリポイント。`ELECTRON_RUN_AS_NODE` をチェックし、設定されている場合はプロセスを再起動する:

```js
if (process.env.ELECTRON_RUN_AS_NODE) {
  const { spawn } = require("node:child_process");
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(process.execPath, process.argv.slice(1), {
    env, stdio: "ignore", detached: true,
  });
  child.unref();
  process.exit(0);
}
import("./main.js");
```

**なぜ ESM の `main.js` 内で処理できないか:**
- ESM では全ての `import` 文がホイストされ、モジュール本体のコードより先に実行される
- `import { app } from "electron"` が最初に評価されるが、`ELECTRON_RUN_AS_NODE=1` のせいで失敗する
- CJS（`.cjs`）ならコードは上から順に同期実行されるため、`import` の前に環境変数を処理できる

**`package.json` の変更:**
- `"main": "electron/main.js"` → `"main": "electron/entry.cjs"`
- `"files"` に `"!electron/**/*.md"` を追加（ドキュメントファイルを asar から除外）

---

## 修正済みの問題詳細

### 問題0: `ELECTRON_RUN_AS_NODE=1` による即座終了 ✅修正済み

**対応:** `electron/entry.cjs` を新規作成。環境変数が設定されていればプロセスを再起動。`package.json` のエントリポイントを変更。

### 問題1: Electron バージョン ✅修正済み

**対応:** `package.json` で `"electron": "^39.2.7"` → `"electron": "39.5.1"` にピン留め。

### 問題2: サーバー実行ファイルの二重 `resources` パス ✅修正済み

**ファイル:** `electron/utils/paths.js`

```js
// Before:
path.join(appRoot, "resources", "marimo-server.exe")
// After:
path.join(appRoot, "marimo-server.exe")
```

### 問題3: `preload.js` の `__MARIMO_MOUNT_CONFIG__` 注入 ✅修正済み

**ファイル:** `electron/preload.js` — `window.electronAPI = {...}` の後に IIFE を追加。

### 問題4: デバッグコードの削除 ✅完了

---

## レビュアーへ: 不採用になった調査・修正方針

> **重要:** 以下のアプローチはすべて検証済みで、根本原因ではないことが確認されています。
> 同じ調査を繰り返さないでください。根本原因は `ELECTRON_RUN_AS_NODE=1` 環境変数です。

### 不採用1: `asar: false` ビルド

| 項目 | 内容 |
|------|------|
| **仮説** | asar パッケージングが壊れている、または asar 内のファイル読み込みに問題がある |
| **検証** | `electron-builder` の設定で `asar: false` にしてビルド。app ディレクトリが展開された状態で生成 |
| **結果** | ExitCode 0 で即座に終了。asar 有り版と全く同じ症状 |
| **結論** | **asar は無関係。** 問題はアプリコードが読み込まれる以前の段階で発生している |

### 不採用2: electron.exe のバイナリ差し替え

| 項目 | 内容 |
|------|------|
| **仮説** | electron-builder がバイナリを rcedit で編集する過程で破損している |
| **検証** | `node_modules/electron/dist/electron.exe`（未編集の素の Electron バイナリ）を `dist-electron/win-unpacked/` にコピーして実行 |
| **結果** | 同一サイズ（210,925,056 bytes）。ExitCode 0 で即座に終了 |
| **結論** | **バイナリ編集・rcedit は無関係。** 素の Electron バイナリでも同じ症状 |

### 不採用3: `signAndEditExecutable: false`（コード署名の無効化）

| 項目 | 内容 |
|------|------|
| **仮説** | signtool.exe による署名処理がバイナリを壊している |
| **検証** | electron-builder 設定に `"signAndEditExecutable": false` を追加してビルド |
| **結果** | ExitCode 0 で即座に終了。署名なしでも同じ症状 |
| **結論** | **コード署名は無関係。** なお `"sign": false` は無効なオプション名でビルドエラーになる（正しくは `"signAndEditExecutable"`） |

### 不採用4: Electron Fuses の検査

| 項目 | 内容 |
|------|------|
| **仮説** | Electron Fuses（コンパイル時設定）が不正に設定されている。`OnlyLoadAppFromAsar` が有効だとディレクトリからの読み込みが無効になる |
| **検証** | `@electron/fuses` パッケージの `read` コマンドで全 Fuse を確認 |
| **結果** | `OnlyLoadAppFromAsar=Disabled`, `EnableEmbeddedAsarIntegrityValidation=Disabled`, `RunAsNode=Enabled` — すべて正常 |
| **結論** | **Fuses は無関係。** Fuse 設定は正常値であり、制限は一切かかっていない |

### 不採用5: ESM vs CJS の問題

| 項目 | 内容 |
|------|------|
| **仮説** | `package.json` の `"type": "module"` により ESM として読み込まれることでパッケージ版で問題が起きている |
| **検証** | main.js を最小の CJS コード（`const { app } = require("electron"); ...`）に差し替え。`"type": "module"` も削除 |
| **結果** | CJS でも全く同じ。main.js 自体がロードされていない |
| **結論** | **ESM/CJS は無関係。** 問題はモジュールシステムより前の段階（Electron の初期化自体）で発生している |

### 不採用6: 最小限の main.js テスト

| 項目 | 内容 |
|------|------|
| **仮説** | main.js 内のコード（Steam 連携、ロガー初期化等）がクラッシュを引き起こしている |
| **検証** | main.js を `fs.writeFileSync("/tmp/test.txt", "loaded")` だけの1行に差し替え |
| **結果** | ファイルが作成されない。main.js が一切実行されていない |
| **結論** | **main.js の中身は無関係。** Electron がエントリポイントを読み込む段階まで到達していない |

### 不採用7: asar integrity（整合性チェック）の問題

| 項目 | 内容 |
|------|------|
| **仮説** | asar のハッシュ値が不一致で、整合性チェックに失敗してサイレントに終了している |
| **検証** | Fuses で `EnableEmbeddedAsarIntegrityValidation=Disabled` を確認済み。加えて `asar: false` でも同じ症状 |
| **結論** | **asar integrity は無関係。** 整合性チェック自体が無効化されており、asar を使わなくても再現する |

### 不採用8: `ELECTRON_ENABLE_LOGGING=1` によるデバッグ

| 項目 | 内容 |
|------|------|
| **仮説** | Electron 内部ログを有効にすれば起動失敗の原因がわかる |
| **検証** | 環境変数 `ELECTRON_ENABLE_LOGGING=1` を設定して実行 |
| **結果** | ログ出力なし。stdout/stderr ともに空 |
| **結論** | **ログが出ない理由がそもそもの根本原因。** `ELECTRON_RUN_AS_NODE=1` のせいで Electron が Node.js モードで動作しており、Electron のロギングシステム自体が初期化されない |

### 根本原因発見に至った突破口

上記すべての仮説を棄却した後、以下の手順で根本原因を特定:

1. **明示的パス指定テスト**: `electron.exe /path/to/app` で明示的にアプリを指定したところ、ESM エラーが出た（= アプリ自体は読み込まれている）
2. **`process.type` の確認**: 診断コードで `process.type` を調べたところ `undefined`（正常時は `'browser'`）
3. **環境変数の確認**: `process.env.ELECTRON_RUN_AS_NODE` を調べたところ `"1"` が設定されていた
4. **環境変数の除去テスト**: `ELECTRON_RUN_AS_NODE` を除去して起動 → **正常にウィンドウが表示された**

**教訓:**
- VS Code の統合ターミナルは `ELECTRON_RUN_AS_NODE=1` を環境変数に持つことがある
- この環境変数が設定されていると Electron は **一切のエラーなしに** Node.js モードで動作し、GUIコードが読み込まれずに即座に終了する
- エクスプローラーからのダブルクリックでは環境変数が継承されないため、開発環境でのみ再現する可能性が高い
- ビルド・パッケージング・署名・asar・Fuses など、Electron のビルドパイプラインに問題があるように見えるが、実際にはビルド成果物には一切問題がない

---

## 設計思想と背景

### アーキテクチャ
```
marimo.exe (Electron main process)
  ├── electron/entry.cjs - CJS エントリ（ELECTRON_RUN_AS_NODE 対策）
  ├── electron/main.js - メインプロセス (ESM)
  │     ├── utils/logger.js - ファイルログ
  │     ├── utils/paths.js - パス解決
  │     ├── utils/recent-files.js - 最近のファイル管理
  │     └── utils/notebook-injector.js - ノートブック操作
  ├── electron/preload.js - IPC ブリッジ (ESM)
  ├── frontend/dist/ - React フロントエンド (Vite ビルド)
  └── resources/marimo-server.exe - Python サーバー (PyInstaller)
```

### 動作フロー
1. `entry.cjs` → `ELECTRON_RUN_AS_NODE` チェック → `import("./main.js")`
2. `main.js` → `initLogger()` → `initSteam()` (steamworks.js)
3. `app.whenReady()` → `connectSteam()` → `createWindow()`
4. `createNotebookWindow()` → ポート確保 → `BrowserWindow` 作成
5. `app.isPackaged` なら `loadFile(index.html)` + `startServerForWindow()`
6. `preload.js` が `__MARIMO_MOUNT_CONFIG__` を注入
7. フロントエンドが `http://localhost:{port}` のサーバーに接続

### マルチウィンドウ
- 各ウィンドウが独立したサーバープロセスとポートを持つ
- `windows` Map で管理（windowId → WindowInfo）
- ウィンドウ閉じ時にサーバーも終了

### Steam 統合
- `steamworks.js` で Steam Overlay と Steam API を使用
- `asarUnpack` で native モジュールを asar 外に展開
- Steam 未起動時は graceful に non-Steam モードで動作
- `electronEnableSteamOverlay()` は `app.whenReady()` の前に呼ぶ必要がある

---

## Tips

### ビルドコマンド
```bash
# フル build（installer + portable）
pnpm exec electron-builder --win --x64

# dir のみ（高速、テスト用）
pnpm exec electron-builder --win --x64 --dir

# 開発モード（Vite dev server + Electron）
pnpm start
```

### ログファイルの場所
```
C:\Users\sasai\AppData\Roaming\marimo\logs\backcast-*.log
```

### asar の中身確認
```bash
npx asar list dist-electron/win-unpacked/resources/app.asar
npx asar extract dist-electron/win-unpacked/resources/app.asar ./extracted
```

### パッケージ版のパス構造
```
dist-electron/win-unpacked/
  ├── marimo.exe                    # Electron バイナリ
  ├── resources/
  │     ├── app.asar                 # アプリコード
  │     ├── app.asar.unpacked/       # native modules
  │     │     └── node_modules/steamworks.js/
  │     └── marimo-server.exe        # Python サーバー
  └── (DLLs, locales, etc.)
```

### asar 内の構成（確認済み）
```
\electron\entry.cjs                  # CJS エントリポイント（NEW）
\electron\main.js
\electron\preload.js
\electron\utils\logger.js
\electron\utils\notebook-injector.js
\electron\utils\paths.js
\electron\utils\recent-files.js
\frontend\dist\...
\node_modules\steamworks.js\...       # runtime dependency
\node_modules\@types\node\...         # type definitions
\node_modules\undici-types\...
\package.json
```
**注意:** `node_modules/electron`（npm パッケージ）は含まれない（devDependency）。`.md` ファイルは `"!electron/**/*.md"` で除外。

### `app.getAppPath()` の挙動
- 開発時: プロジェクトルート
- パッケージ時: `<install-dir>/resources/app.asar`
- `getAppRoot()` = `path.join(app.getAppPath(), "..")` = `<install-dir>/resources/`

### パッケージ版の起動テスト方法
```bash
# ELECTRON_RUN_AS_NODE を除去して起動（VS Code ターミナルから）
node -e "
const env = {...process.env};
delete env.ELECTRON_RUN_AS_NODE;
const {spawn} = require('child_process');
const p = spawn('dist-electron/win-unpacked/marimo.exe', [], {
  env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: false
});
p.stdout.on('data', d => process.stdout.write(d));
p.stderr.on('data', d => process.stderr.write(d));
p.on('close', code => console.log('EXIT:', code));
setTimeout(() => { p.kill(); process.exit(); }, 10000);
"

# entry.cjs が対策済みなので、以下でもOK（再起動される）
node -e "
const {spawn} = require('child_process');
spawn('dist-electron/win-unpacked/marimo.exe', [], {stdio: 'ignore', detached: true}).unref();
"
```

### 重要な注意: `ELECTRON_RUN_AS_NODE` 環境変数

VS Code の統合ターミナル（特に Claude Code 等の拡張機能経由）では `ELECTRON_RUN_AS_NODE=1` が設定されていることがある。これが設定されていると Electron は Node.js モードで動作し、GUI が一切表示されない。

`electron/entry.cjs` がこの問題を自動的に処理するが、テスト時にこの環境変数の存在を認識しておくことが重要。

---

## 直近の環境変更履歴
1. `pnpm install -w electron-builder` を実行 → `package.json` の `dependencies` が壊れた
2. `git checkout -- package.json && pnpm install` で復元
3. Electron が 39.5.1 → 39.5.2 にアップデートされた
4. `node_modules` の再構築により Electron のモジュール解決が影響を受けた
5. **2026-02-12:** Electron を 39.5.1 にピン留め、`node_modules/electron` を再インストール
6. **2026-02-12:** 3つのバグ修正（paths.js, preload.js, デバッグコード削除）
7. **2026-02-12:** ビルド成功するが起動テストで ExitCode 0 即終了が継続
8. **2026-02-12:** 根本原因特定 — `ELECTRON_RUN_AS_NODE=1` 環境変数
9. **2026-02-12:** `electron/entry.cjs` 作成、`package.json` エントリポイント変更
10. **2026-02-12:** パッケージ版の起動テスト成功（ウィンドウ生成・ログ作成確認）
