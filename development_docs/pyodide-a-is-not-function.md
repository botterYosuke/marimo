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

## 対応と設計思想
### Pyodide 環境への影響を限定する修正
この問題は Pyodide 版（Wasm版）特有のビルド制約に起因するため、修正は `isPyodide` フラグを用いて **Pyodide ビルドのみ** に適用しました。

**修正内容 (`frontend/vite.config.mts`, `frontend/islands/vite.config.mts`):**
```typescript
build: {
  // Pyodide ビルドでは TLA を es2020 向けに低下させるため target を固定
  ...(isPyodide ? { target: "es2020" } : { target: "esnext" }),
  // oxc ミニファイアで発生する可能性のある問題を避けるため、Pyodide ビルドでは安定した esbuild を使用
  minify: isPyodide ? "esbuild" : "oxc",
},
experimental: {
  // Pyodide ビルドでは enableNativePlugin: true を使用。
  // false にすると vite-plugin-top-level-await (JS プラグイン) が動作するが、
  // rolldown-vite 7.3.1 では panels.js への TLA チェーン伝播に失敗する。
  // true にすると rolldown のネイティブトランスフォームが TLA を正しく処理する。
  // (resolve.alias で @/* と zod のパスを手動設定済みのため tsconfigPaths 問題はない)
  enableNativePlugin: isPyodide ? true : "resolver",
},
```

- **設計思想**:
    - **Isolation (隔離)**: 通常の Web ビルド (`esnext`, `oxc`) は最新の機能を活用し、パフォーマンスとバンドルサイズを最適化します。Pyodide 版の修正が通常版に影響を与えないように `isPyodide` で分岐させています。
    - **Determinism (確定性)**: Pyodide 環境は Wasm の初期化と TLA が密接に絡むため、魔法のような最適化を避け、`es2020` ターゲットと `esbuild` ミニファイアで確定的な出力を得られるようにしています。
    - **Consistency (一貫性)**: Islands ビルド (`frontend/islands/vite.config.mts`) にも同様の修正を適用し、静的に書き出されたノートブックでも同様の問題が発生しないようにしました。

## Tips: 開発者向け情報
- **Minified エラーのデバッグ**: `na is not a function` のようなエラーが出た場合、それがアプリケーションコードのバグではなく、ビルドツールが生成したヘルパー関数の不整合である可能性を疑ってください。特に TLA 変換プラグインを使用している場合、`target` と `enableNativePlugin` 設定が重要です。
- **Vite と TLA**: `vite-plugin-top-level-await` は `target` がモダンすぎると動作しない（必要ないと判断される）ことがあります。意図的にプラグインを効かせたい場合は `es2020` 程度にターゲットを落とすのが定石です。
- **CI/CD の確認**: `deploy-firebase.yml` などのワークフローで `PYODIDE: "true"` が設定されているビルドが、修正後の挙動になっているか確認してください。

## 作業進捗
- [✅] エラーログの分析と根本原因の特定（`loro-crdt` の TLA + rolldown-vite での JS プラグイン伝播失敗）
- [✅] デプロイ済みファイル (`panels-DHtfoB8g.js`, `layout-CPGHYliC.js`, `cells-6eW1MVv5.js`) の解析
- [✅] `frontend/vite.config.mts` の修正 (`enableNativePlugin: isPyodide ? true : "resolver"`)
- [✅] `deploy-firebase.yml` へのデプロイ分岐（`sasa/pyodide` ブランチ）の追加
- [✅] ドキュメントへの確定原因と設計思想の反映
- [ ] デプロイして実動作確認（`enableNativePlugin: true` で TLA が正しく伝播するか）

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
