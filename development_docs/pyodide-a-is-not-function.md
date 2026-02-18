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
- **原因**: Vite (Rolldown) のビルド設定において、以下の複合要因により TLA のコード変換が正しく行われなかったことが主因です。
    1. `build.target` が `esnext` であったため、ビルドツールが「変換不要（ブラウザがネイティブ対応）」と判断した。
    2. `experimental.enableNativePlugin` が有効（デフォルト等）であったため、Rolldown のネイティブ実装が JS ベースのプラグイン（`vite-plugin-top-level-await`）をスキップしていた。
- **メカニズム**:
    - プロジェクトでは `vite-plugin-top-level-await` を使用して TLA をサポートしています。
    - Rolldown のネイティブ最適化と衝突すると、期待される `__tla` ヘルパー関数の定義や初期化順序が崩れ、実行時に未定義の変数を呼び出そうとしてエラー（`na is not a function`）が発生します。
    - また、新しいミニファイア（`oxc`）が特定の条件（CJS/ESM混在環境など）で正しく動作しないケースがあることも判明しました。

## 対応と設計思想
### Pyodide 環境への影響を限定する修正
この問題は Pyodide 版（Wasm版）特有のビルド制約に起因するため、修正は `isPyodide` フラグを用いて **Pyodide ビルドのみ** に適用しました。

**修正内容 (`frontend/vite.config.mts`, `frontend/islands/vite.config.mts`):**
```typescript
build: {
  // Pyodide ビルドでは vite-plugin-top-level-await による変換を強制するため、target を es2020 に固定
  // 通常ビルドは引き続き esnext を使用
  ...(isPyodide ? { target: "es2020" } : { target: "esnext" }),
  // oxc ミニファイアで発生する可能性のある問題を避けるため、Pyodide ビルドでは安定した esbuild を使用
  minify: isPyodide ? "esbuild" : "oxc",
},
experimental: {
  // Rolldown のネイティブプラグインを無効化し、JSベースのプラグイン（TLA等）が確実に動作するようにする
  enableNativePlugin: isPyodide ? false : "resolver",
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
- [✅] エラーログの分析と原因特定 (`target: esnext` と TLA プラグイン、ネイティブプラグインの競合)
- [✅] `frontend/vite.config.mts` の修正 (Pyodide ビルド時の `target`, `minify`, `enableNativePlugin` の調整)
- [✅] `frontend/islands/vite.config.mts` への修正展開 (アイランドコンポーネント用)
- [✅] `deploy-firebase.yml` へのデプロイ分岐（`sasa/pyodide` ブランチ）の追加 (USER側で実施)
- [✅] ドキュメントへの最新の知見と設計思想の反映
- [✅] Pyodide 版以外（通常ビルド）への影響がないことの確認

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
