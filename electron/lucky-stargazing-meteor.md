# Electron デスクトップアプリ起動修正プラン

## Context
Electron版marimoデスクトップアプリがビルド後に即座に終了する（ExitCode: 0）。
`pnpm install -w electron-builder` 実行時に `node_modules` の構造が変わり、Electron 39.5.1→39.5.2 にアップデートされた結果、`require('electron')` のモジュール解決が壊れた。加えて、パス解決バグとpreload.jsのコード欠落がある。

## 修正1: Electron の組み込みモジュール解決を修復【最優先】

**ファイル:** `package.json` + `node_modules/electron`

**手順:**
1. `node_modules/electron` フォルダを削除
2. `pnpm install` で再インストール
3. `node_modules/electron/dist/electron.exe -e "const {app} = require('electron'); console.log(typeof app)"` で動作確認
4. まだ壊れている場合 → `package.json` の `"electron": "^39.2.7"` を `"electron": "39.5.1"` にピン留めし、再度 `node_modules/electron` を削除して `pnpm install`

## 修正2: `getMarimoServerExecutable()` の二重resourcesパスを修正

**ファイル:** [electron/utils/paths.js](electron/utils/paths.js)

**変更内容:** `getMarimoServerExecutable()` 関数で `"resources"` セグメントを削除

```js
// Before (L74-78):
if (process.platform === "win32") {
  execPath = path.join(appRoot, "resources", "marimo-server.exe");
} else {
  execPath = path.join(appRoot, "resources", "marimo-server");
}

// After:
if (process.platform === "win32") {
  return path.join(appRoot, "marimo-server.exe");
}
return path.join(appRoot, "marimo-server");
```

**理由:** `getAppRoot()` は `app.getAppPath()` (`resources/app.asar`) の親 = `resources/` を返す。そこに `"resources"` を追加すると `resources/resources/marimo-server.exe` になる。

## 修正3: `preload.js` に `__MARIMO_MOUNT_CONFIG__` 注入コードを復元

**ファイル:** [electron/preload.js](electron/preload.js)

**変更内容:** ファイル末尾（`window.electronAPI = {...}` の後）に以下のIIFEを追加:

```js
// Inject mount configuration for the frontend
// This tells the React app where to find the marimo server
(() => {
  const params = new URLSearchParams(window.location.search);
  const port = params.get("port");
  const mountConfig = {
    filename: "",
    mode: "edit",
    version: "electron",
    config: {},
    configOverrides: {},
    appConfig: {},
    view: { showAppCode: true },
    serverToken: "",
    session: null,
    notebook: null,
    runtimeConfig: port ? [{
      url: `http://localhost:${port}`,
      lazy: false,
    }] : null,
  };
  Object.defineProperty(window, "__MARIMO_MOUNT_CONFIG__", {
    value: mountConfig,
    writable: false,
    configurable: false,
  });
})();
```

## 修正4: デバッグコードの削除

### [electron/main.js](electron/main.js)
- **L3-10 削除:** `_debugWriteFile` import + early diagnostic try/catch ブロック
- **L181 削除:** `logInfo(`[DEBUG-LOAD] Loading index.html from:...`)` 行
- **L187 削除:** `logInfo(`[DEBUG-LOAD] Loading from dev server:...`)` 行
- L15 の `existsSync` import は `startServerForWindow()` (L297) と `getDefaultNotebook()` (L227) で使用されているため残す

### [electron/utils/paths.js](electron/utils/paths.js)
- **L5 削除:** `import { existsSync } from "node:fs";` （デバッグ用チェックでのみ使用）
- **L19 削除:** `console.log(`[DEBUG-PATH] app.isPackaged=true...`)`
- **L24 削除:** `console.log(`[DEBUG-PATH] app.isPackaged=false...`)`
- **L79-84 削除:** `console.log` 2行 + `directPath` 変数の定義と console.log

## 実行順序

1. 修正1 (Electron再インストール) → 動作確認
2. 修正2 (paths.js パス修正)
3. 修正3 (preload.js マウント設定復元)
4. 修正4 (デバッグコード削除)

## 検証手順

1. `pnpm exec electron-builder --win --x64 --dir` でビルド
2. `dist-electron/win-unpacked/marimo.exe` を起動
3. ウィンドウが表示され、ノートブックがロードされることを確認
4. `C:\Users\sasai\AppData\Roaming\marimo\logs\` に新しいログファイルが作成されることを確認
