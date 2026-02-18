# Pyodideビルドにおける "na is not a function" エラーの調査と対応

## 状況
`discord-release.yml` でデプロイされた Pyodide 版 marimo において、ブラウザコンソールに以下のエラーが発生し、アプリケーションが正常に起動しない問題が確認されました。

```
cells-6eW1MVv5.js:9 TypeError: na is not a function
    at panels-DHtfoB8g.js:1:35016
...
```

このエラーは `panels-*.js` や `cells-*.js` などのチャンク読み込み時、特に Top-Level Await (TLA) を含むモジュールの初期化中に発生します。ミニファイされた変数 `na`（あるいは類似の短い変数名）が関数として呼び出されていますが、実体が存在しない状態です。

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
- `frontend/vite.config.mts`:
  - resolve.alias に loro-crdt スタブを追加
  - enableNativePlugin を `"resolver"` に統一
  - `vite-plugin-top-level-await` の import と使用を削除

**`frontend/vite.config.mts` の最終状態:**
```typescript
// import topLevelAwait は削除済み

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
  // 残すと rolldown-vite との連携不良でエラーの原因となる
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
- [✅] 第3次修正: `topLevelAwait()` プラグインを完全除去 → TLA 完全排除
- [✅] ドキュメント更新
- [ ] デプロイして実動作確認

---

## 履歴 (History)

### 2026-02-18: 調査初期メモ
当初の調査および対応案の記録です。

- **根本原因**: Vite のビルドターゲット設定。
- **メカニズム**: `esnext` ターゲット時に `vite-plugin-top-level-await` の変換がスキップされ、Pyodide環境で未定義ヘルパー関数（ミニファイされた `na` 等）の呼び出しエラーが発生。
- **初期の対応案**: `isPyodide ? { target: "es2020" } : { target: "esnext" }` による分岐。
- **特記事項 (ディレクトリパス)**:
    - ローカル環境での検証時、以下のディレクトリパス設定の不整合が確認された。
    - 修正前: `"C:\Users\sasai\Downloads\backcast_files"`
    - 修正後: `"C:\Users\sasai\Downloads\backcast-v2_files"`
    - ファイル構成自体の差異（`index-*.js` のサイズ差など）も、ビルド設定の変更によって発生することを確認した。
