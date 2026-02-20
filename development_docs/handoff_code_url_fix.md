# 作業依頼：`#code/` URL埋め込み機能のバグ修正

## 背景・詳細仕様

[`development_docs/code_url_embedding.md`](file:///D:/Documents/marimo/development_docs/code_url_embedding.md) を参照してください。
根本原因・修正案・関連ファイルがすべて記載されています。

## 状況サマリー

- `https://backcast-tan.web.app/` にデプロイ済みのWASMアプリで `#code/` URLが**無視される**バグがある
- 根本原因：`frontend/src/core/wasm/store.ts` の `notebookFileStore` の優先順位で `urlFileStore`（URLフラグメント読み込み）が最後になっており、`mountConfigFileStore` が先に値を返すと到達しない

## 依頼内容

以下の修正を実施し、動作確認してください。

### 修正対象ファイル

`frontend/src/core/wasm/store.ts` の `notebookFileStore` 定義（125〜130行目付近）：

```ts
// 現状（問題あり）
export const notebookFileStore = new CompositeFileStore([
  mountConfigFileStore,   // 1番目
  domElementFileStore,    // 2番目
  urlFileStore,           // 3番目（URLフラグメント）← 無視される
]);
```

`#code/` フラグメントがURLにある場合は `urlFileStore` を最優先にするよう変更してください（詳細な修正案は `code_url_embedding.md` の「修正案」セクション参照）。

### 動作確認URL

修正後、以下のURLをブラウザで開き、`:rocket: :smile:` を含むセルが表示されることを確認してください：

```
https://backcast-tan.web.app/#code/JYWwDg9gTgLgBCAhlUECwAoTB9bBzAUwDsCpEYCATbAd2BgAs4BeOAIgAYA6ARgE4uAdjaZEYMCwTJUXAILiAFAEpMqjAAExYLgGMCAG30KGwSgWw6IZ5gBUoAVwIqMZgGZxsCkBCUAuTHCBCBBcIJQKUGxRAUEAqgDOBHCW+hBEcPEAnkQwiAAecIjxhRkM0DA69vCu0HAAVHUE3gBWwPENcMDpmRD2UFJQANaUEDREXDGBUWzOQXBQBDB9RGqYmuK6BvqYbh5ePv4Yc96h4ZHRR0G+UBA6g4u+cL7xIMD6BIdz07NBC0tQKywQPW2j0hh2BHcnj8k064HKA1QhWK3jUcz+yzg+wANM41MAodgiIgQOZsCxWGxcEgurg2J8glouA4iMpMEA
```

> [!NOTE]
> 確認のためには修正後に `pnpm build` + Firebase へのデプロイが必要になる場合があります。
> ローカルでは `pnpm dev` の WebSocket モードでは `#code/` は動作しないため、
> WASMモード（`pnpm dev:wasm` 等）で確認するか、デプロイして確認してください。
