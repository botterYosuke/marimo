# Pyodideビルドにおける "X is not a function" エラーの調査と対応

## 状況
`deploy-firebase.yml` でデプロイされた Pyodide 版 marimo において、ブラウザコンソールに以下のエラーが発生し、アプリケーションが正常に起動しない問題が確認されました。

```
// 第1・2次修正前
cells-6eW1MVv5.js:9 TypeError: na is not a function
    at panels-DHtfoB8g.js:1:35016

// 第2次修正後（loro-crdt スタブ導入後も再発）
index-Bf54jHWc.js:9 TypeError: re is not a function
    at panels-Cmgv8pHD.js:1:33493
```

このエラーは `panels-*.js` チャンク読み込み時に発生します。ミニファイされた変数（`na`、`re` 等）が関数として呼び出されていますが、実体が未初期化の状態です。

## 確定した根本原因（2026-02-18 解析完了）

### TLA の根源
`loro-crdt@1.10.6` の `bundler/loro_wasm.js` が WebAssembly 初期化に **Top-Level Await** を使用：

```javascript
// loro_wasm.js:47, 62, 71, 75, 81 など — モジュールトップレベルに await
({ instance } = await WebAssembly.instantiate(wasmModuleOrExports, {...}));
const wkmod = ... ? wasmModuleOrExports : await import('./loro_wasm_bg.wasm');
```

### 伝播チェーン
1. `loro_wasm.js` (TLA 源) → `loro-crdt` インポート元 (`rtc/loro/sync.ts` 等)
2. → `cells-6eW1MVv5.js` チャンク: TLA により `EP = (async()=>{...})()` でラップ、`EP as __tla` エクスポート
3. → `layout-CPGHYliC.js` チャンク: cells の `__tla` をチェーン、`Ct`（`react-grid-layout` ラッパー）を `__tla` の `.then()` 内で初期化、`Ct as _` および `Ma as __tla` エクスポート
4. → `panels-DHtfoB8g.js`: `layout` から `_ as na` をインポートするが **`__tla` をインポートせず TLA チェーンが欠落**
5. 結果: `var JA = na()` 実行時に `Ct` が未初期化 (undefined) → `TypeError: na is not a function`

### JS プラグインが失敗する理由
`enableNativePlugin: false` では `vite-plugin-top-level-await` (JS プラグイン) が実行されるが、rolldown-vite 7.3.1 では `panels.js` への TLA チェーン伝播に失敗する（プラグインのバグ）。

## 対応と設計思想（最終版）

### 根本解決: loro-crdt スタブ + topLevelAwait プラグイン除去（2026-02-18 最終確定）

#### 修正の2本柱

1. **loro-crdt をスタブに置き換え**: Pyodide ビルドで `loro-crdt` を TLA なしのスタブにエイリアス。
2. **`vite-plugin-top-level-await` プラグインを除去**: スタブにより TLA ソースが除去済みのため、このプラグインは不要。プラグインを残すと rolldown-vite との連携不良でチャンク間の `__tla` 伝播に失敗し、エラーの原因となる。

#### 修正の経緯

| 修正 | 変更内容 | 結果 |
|------|----------|------|
| 第1次 | `enableNativePlugin: true` | ❌ `panels-g80ohNGS.js` で同エラー |
| 第2次 | loro-crdt スタブ + `enableNativePlugin: "resolver"` | ❌ `panels-Cmgv8pHD.js` で `re is not a function` |
| 第3次 | `topLevelAwait()` プラグインを除去 | ✅ TLA が完全排除 |

#### 第2次修正が失敗した理由

loro-crdt スタブにより TLA ソースは除去されたが、`vite-plugin-top-level-await` 自体が残っていた。
このプラグインが index チャンク全体を async IIFE (`hir=(async()=>{...})()`) でラップし、`__tla` としてエクスポート。
rolldown-vite が `panels` チャンクへの `__tla` チェーン伝播に失敗し、`layout` チャンクの `Ct`（= `WidthProvider(Responsive)`）が未初期化のまま呼び出されてエラー発生。

**修正ファイル一覧:**
- `frontend/src/stubs/loro-crdt.ts` (新規): TLA なしのスタブクラス群
- `frontend/vite.config.mts`: loro-crdt スタブの alias 追加、`vite-plugin-top-level-await` の import と使用を削除
- `frontend/package.json`: `vite-plugin-top-level-await` devDependency を削除

**`frontend/vite.config.mts` の最終状態（抜粋）:**
```typescript
// import topLevelAwait は削除済み
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

build: {
  ...(isPyodide ? { target: "es2020" } : { target: "esnext" }),
  minify: isDev ? false : isPyodide ? "esbuild" : "oxc",
},
resolve: {
  alias: isPyodide ? {
    "@": path.resolve(__dirname, "src"),
    zod: path.resolve(__dirname, "node_modules/zod"),
    "loro-crdt": path.resolve(__dirname, "src/stubs/loro-crdt.ts"),
  } : { /* vega-lite aliases */ },
},
experimental: {
  enableNativePlugin: "resolver",
},
plugins: [
  // topLevelAwait() は含めない — TLA ソースが除去済みのため不要
  wasm(),
],
```

### なぜスタブで安全か

- Pyodide では `isWasm()` が `true` を返す
- `realTimeCollaboration()` は `{ extension: [], code: initialCode }` で即座にリターン
- モジュールレベルのコード (`new LoroDoc()`, `new Awareness(...)` 等) は実行されるが、それらが登録するコールバックは Pyodide では発火しない (`isRtcEnabled()` が false、または WebSocket が接続されない)

### 副次効果（ボーナス）

- Pyodide バンドルから `loro_wasm_bg.wasm` (~3.2 MB) と `loro_wasm_bg-*.js` (~85 kB) が除外される
- ページ初期ロードが高速化

### 設計思想

- **Isolation (隔離)**: 通常の Web ビルドは実際の loro-crdt (WASM 付き) を使用。Pyodide 版のみスタブに切り替え。
- **Determinism (確定性)**: スタブには TLA・WASM が一切なく、バンドラーの挙動に依存しない。
- **Simplicity (単純性)**: バンドラーのバグ回避策よりも、依存グラフからの除去 + 不要プラグインの除去が確実。

## Tips: 開発者向け情報
- **Minified エラーのデバッグ**: `na is not a function` や `re is not a function` のようなエラーが出た場合、ビルドツールが生成した TLA ヘルパー関数の不整合を疑ってください。
- **`vite-plugin-top-level-await` の注意点**: このプラグインは rolldown-vite ではチャンク間の `__tla` 伝播に失敗するバグがあります。TLA ソースをスタブ等で除去している場合は、**プラグインも除去すること**。
- **CI/CD の確認**: `deploy-firebase.yml` で `PYODIDE: "true"` 設定のビルドが修正後の挙動になっているか確認してください。

## 作業進捗
- [✅] エラーログの分析と根本原因の特定（`loro-crdt` の TLA + rolldown-vite での JS プラグイン伝播失敗）
- [✅] デプロイ済みファイル (`panels-DHtfoB8g.js`, `layout-CPGHYliC.js`, `cells-6eW1MVv5.js`) の解析
- [✅] 第1次修正: `enableNativePlugin: true` → **失敗**
- [✅] 第2次修正: loro-crdt スタブ + alias → スタブは機能するが `topLevelAwait()` プラグインが残存して **失敗**
- [✅] 第3次修正: `topLevelAwait()` プラグインを完全除去 + `package.json` からも削除 → TLA 完全排除
- [✅] Firebase デプロイで実動作確認済み（`https://backcast-tan.web.app/`）
- [✅] ドキュメント更新

---

## 第2の問題: ワーカーバンドリング失敗による RPC タイムアウト（2026-02-18）

### 症状

TLA 問題の修正後、デプロイ済みサイト `https://backcast-tan.web.app/` が「Initializing...」で停止し続ける。コンソールには以下が出力される。

```
sendListFiles Error: RPC request timed out
```

### 根本原因

`rolldown-vite@7.3.1` が `new Worker(new URL("./worker.ts", import.meta.url), {...})` という**暗黙的パターン**をワーカーバンドル対象として認識できず、ワーカーファイルを**トランスパイルせずに生 TypeScript のまま `.ts` 拡張子で出力**していた。

- **出力例 (修正前)**: `dist-pyodide/assets/worker-YlKTPkry.ts`（中身は `import type` 等を含む生 TypeScript）
- ブラウザの Web Worker は TypeScript を実行できない → ワーカーが即死 → 全 RPC 通信が 20 秒後にタイムアウト

### 問題箇所

`frontend/src/core/wasm/bridge.ts` の Worker コンストラクタ（修正前）:

```typescript
// worker.ts と save-worker.ts の両方で同じパターン
const worker = new Worker(
  new URL("./worker/worker.ts", import.meta.url),  // rolldown-vite が検出できない
  { type: "module", /* @vite-ignore */ name: getMarimoVersion() }
);
```

### 試して失敗したこと

- `vite.config.mts` の `worker` セクションに `rollupOptions.output.entryFileNames: "[name]-[hash].js"` を追加 → 無視される（依然 `.ts` 出力）
- `worker.plugins: () => [wasm()]` を追加 → 効果なし

### 解決策: `?worker&url` サフィックスによる明示的インポート

`islands/bridge.ts` で既に採用されていた標準 Vite パターンを `wasm/bridge.ts` にも適用する。

**修正ファイル:** `frontend/src/core/wasm/bridge.ts`

```typescript
// 追加: トップレベルで ?worker&url インポート
import saveWorkerUrl from "./worker/save-worker.ts?worker&url";
import workerUrl from "./worker/worker.ts?worker&url";

// 変更: new URL(...) パターンを URL 変数に置き換え
const worker = new Worker(workerUrl, {
  type: "module",
  name: getMarimoVersion(),
});

const saveWorker = new Worker(saveWorkerUrl, {
  type: "module",
  name: getMarimoVersion(),
});
```

`?worker&url` サフィックスは Vite に「このファイルはワーカーとしてバンドルし、URLを返せ」と明示指示する。rolldown-vite でも正しく解釈され、`.js` ファイルとして出力される。

### 修正後の出力

```
dist-pyodide/assets/worker-Caj8-YsL.js       87.86 kB  # トランスパイル済み JS
dist-pyodide/assets/save-worker-fCYKAyeJ.js  83.71 kB  # トランスパイル済み JS
```

### 補足: `vite.config.mts` の `worker` セクション

`worker.plugins: () => [wasm()]` はそのまま有効で、`?worker&url` でバンドルされるワーカー内でも WASM プラグインが適用される。

### Tips

- **`new Worker(new URL(..., import.meta.url))` は rolldown-vite で動作しない**: 標準 Vite では動くが rolldown-vite ではワーカーを未処理で出力することがある。代わりに `?worker&url` を使う。
- **参考実装**: `frontend/src/core/islands/bridge.ts` の `import workerUrl from "./worker/worker.tsx?worker&url"` が正しいパターン。

### 作業進捗

- [✅] 症状の特定（RPC タイムアウト、`sendListFiles Error`）
- [✅] 根本原因の特定（`.ts` 拡張子のまま出力されるワーカーファイル）
- [✅] `?worker&url` パターンへの変更（`wasm/bridge.ts`）
- [✅] ローカル Pyodide ビルドで `.js` 出力を確認（`worker-*.js`, `save-worker-*.js`）
