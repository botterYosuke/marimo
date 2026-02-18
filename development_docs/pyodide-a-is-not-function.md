# Pyodideビルドにおける "na is not a function" エラーの調査と対応

## 状況
`discord-release.yml` でデプロイされた Pyodide 版 marimo において、ブラウザコンソールに以下のエラーが発生し、アプリケーションが正常に起動しない問題が確認されました。

```
cells-6eW1MVv5.js:9 TypeError: na is not a function
    at panels-DHtfoB8g.js:1:35016
...
```

このエラーは `panels-*.js` や `cells-*.js` などのチャンク読み込み時、特に Top-Level Await (TLA) を含むモジュールの初期化中に発生します。ミニファイされた変数 `na`（あるいは類似の短い変数名）が関数として呼び出されていますが、実体が存在しない状態です。

## 新たな知見と原因
- **原因**: Vite のビルド設定において、Pyodide 版の `build.target` が `esnext`（またはデフォルト）になっていたことが主因です。
- **メカニズム**:
    - プロジェクトでは `vite-plugin-top-level-await` を使用して TLA をサポートしています。
    - ビルドターゲットが `esnext` の場合、Vite（および基盤となる Rollup/Rolldown）は「ターゲット環境がネイティブで TLA をサポートしている」と判断し、プラグインによるコード変換がスキップされる、あるいは競合する形で出力される場合があります。
    - その結果、Pyodide 環境でのモジュール初期化順序において、期待される変換コードが含まれず、未定義のヘルパー関数（`na` などにミニファイされたもの）を参照してエラーとなりました。

## 対応と設計思想
### Pyodide 環境への影響を限定する修正
この問題は Pyodide 版（Wasm版）特有のビルド制約に起因するため、修正は `isPyodide` フラグを用いて **Pyodide ビルドのみ** に適用しました。

**修正内容 (`frontend/vite.config.mts`):**
```typescript
build: {
  // Pyodide ビルドでは vite-plugin-top-level-await による変換を強制するため、target を es2020 に固定
  // 通常ビルドは引き続き esnext を使用
  ...(isPyodide ? { target: "es2020" } : { target: "esnext" }),
  // oxc ミニファイアで発生する CJS 系の問題を避けるため、Pyodide ビルドでは esbuild を使用
  minify: isPyodide ? "esbuild" : "oxc",
},
experimental: {
  // Rolldown のネイティブプラグインを無効化し、JSベースのプラグイン（TLA等）が確実に動作するようにする
  enableNativePlugin: isPyodide ? false : "resolver",
},
```

- **設計思想**:
    - **Isolation (隔離)**: 通常の Web ビルド (`esnext`) は最新のブラウザ機能を活用し、パフォーマンスとバンドルサイズを最適化します。Pyodide 版の修正が通常版に影響を与えないようにします。
    - **Compatibility (互換性)**: Pyodide ビルドは Wasm や Python 環境の初期化と密接に関わるため、TLA の挙動がクリティカルです。`es2020` をターゲットとすることで、プラグインによる確実なポリフィル/変換を保証します。

## Tips: 開発者向け情報
- **Minified エラーのデバッグ**: `na is not a function` のようなエラーが出た場合、それがアプリケーションコードのバグではなく、ビルドツールが生成したヘルパー関数の不整合である可能性を疑ってください。特に `vite-plugin-top-level-await` や `vite-plugin-wasm` を使用している場合、`target` 設定が重要です。
- **Vite と TLA**: `vite-plugin-top-level-await` は `target` がモダンすぎると動作しない（必要ないと判断される）ことがあります。意図的にプラグインを効かせたい場合は `es2020` 程度にターゲットを落とすのが定石です。

## 作業進捗
- [x] エラーログの分析と原因特定 (`target: esnext` と TLA プラグインの競合)
- [x] `vite.config.mts` の修正 (Pyodide ビルド時の `target` を `es2020` に変更)
- [x] Pyodide 版以外への影響がないことの確認 (条件分岐による適用)
- [x] ドキュメントへの知見の共有
