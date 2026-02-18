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

### 根本解決: loro-crdt をスタブに置き換え（2026-02-18 確定）

`enableNativePlugin: true` による修正は失敗した（実デプロイで `panels-g80ohNGS.js` の同エラーを確認）。rolldown-vite 7.3.1 では **JS プラグインでもネイティブプラグインでも** TLA チェーン伝播が失敗するため、バンドラー側での修正は不可能。

**根本解決**: Pyodide ビルドで `loro-crdt` を TLA なしのスタブにエイリアス。

**修正ファイル一覧:**
- `frontend/src/stubs/loro-crdt.ts` (新規): TLA なしのスタブクラス群
- `frontend/vite.config.mts`: resolve.alias に loro-crdt スタブを追加、enableNativePlugin を `"resolver"` に統一

**`frontend/vite.config.mts` の変更:**
```typescript
resolve: {
  alias: isPyodide ? {
    "@": path.resolve(__dirname, "src"),
    zod: path.resolve(__dirname, "node_modules/zod"),
    // loro-crdt の TLA を依存グラフから完全除去
    "loro-crdt": path.resolve(__dirname, "src/stubs/loro-crdt.ts"),
  } : { /* vega-lite aliases */ },
},
experimental: {
  // TLA の根本原因を解消したので両ビルドで "resolver" を使用
  enableNativePlugin: "resolver",
},
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
- **Simplicity (単純性)**: バンドラーのバグ回避策（enableNativePlugin の調整など）より、依存グラフからの除去が確実。

## Tips: 開発者向け情報
- **Minified エラーのデバッグ**: `na is not a function` のようなエラーが出た場合、それがアプリケーションコードのバグではなく、ビルドツールが生成したヘルパー関数の不整合である可能性を疑ってください。特に TLA 変換プラグインを使用している場合、`target` と `enableNativePlugin` 設定が重要です。
- **Vite と TLA**: `vite-plugin-top-level-await` は `target` がモダンすぎると動作しない（必要ないと判断される）ことがあります。意図的にプラグインを効かせたい場合は `es2020` 程度にターゲットを落とすのが定石です。
- **CI/CD の確認**: `deploy-firebase.yml` などのワークフローで `PYODIDE: "true"` が設定されているビルドが、修正後の挙動になっているか確認してください。

## 作業進捗
- [✅] エラーログの分析と根本原因の特定（`loro-crdt` の TLA + rolldown-vite での JS プラグイン伝播失敗）
- [✅] デプロイ済みファイル (`panels-DHtfoB8g.js`, `layout-CPGHYliC.js`, `cells-6eW1MVv5.js`) の解析
- [✅] 第1次修正: `enableNativePlugin: true` → **失敗**（`panels-g80ohNGS.js` で同エラー継続）
- [✅] 根本解決: `frontend/src/stubs/loro-crdt.ts` 作成 + `resolve.alias` でスタブに置き換え
- [✅] `enableNativePlugin` を `"resolver"` に統一
- [✅] ドキュメント更新
- [ ] デプロイして実動作確認（`loro-crdt` スタブで TLA が依存グラフから除去されるか）

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
