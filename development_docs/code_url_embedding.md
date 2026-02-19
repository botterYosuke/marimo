# Code URL Embedding（コードURL埋め込み機能）

marimoはURLの `#code/` フラグメントにソースコードを埋め込むことで、ファイルなしにノートブックを共有できる機能を持つ。

## 仕組み

```
http://localhost:3000/#code/<エンコードされたコード>
```

ソースコード（`.py` ファイルの内容）を **lz-string** の `compressToEncodedURIComponent` でURLセーフな文字列に圧縮・エンコードして、`#code/` の後ろに付加する。

### エンコード手順

1. `.py` ファイルをUTF-8テキストとして読み込む
2. `lz-string.compressToEncodedURIComponent(code)` で圧縮
3. `http://localhost:3000/#code/` に結合

### URL生成スクリプト（Node.js）

```js
const lzString = require('lz-string');
const fs = require('fs');

const code = fs.readFileSync('./your_notebook.py', 'utf8');
const compressed = lzString.compressToEncodedURIComponent(code);
const url = 'http://localhost:3000/#code/' + compressed;

// クリップボードにコピー
require('child_process').execSync('clip', { input: url });
console.log('URL length:', url.length);
```

### PowerShell ワンライナー

```powershell
$file = "変換したいファイルのパス.py"
node -e "const lzString = require('lz-string'); const fs = require('fs'); const code = fs.readFileSync('$($file -replace '\\\\','/')', 'utf8'); const compressed = lzString.compressToEncodedURIComponent(code); const url = 'http://localhost:3000/#code/' + compressed; require('child_process').execSync('clip', {input: url}); console.log('URL length:', url.length);"
```

> **Note:** `lz-string` は `D:\Documents\marimo` 配下の `node_modules` に含まれているため、`Cwd` を `D:\Documents\marimo` にして実行する。

---

## サンプル

### 対象ファイル

[`examples/markdown/emoji.py`](file:///D:/Documents/marimo/examples/markdown/emoji.py)

```python
import marimo

__generated_with = "0.19.7"
app = marimo.App()


@app.cell(hide_code=True)
def _(mo):
    mo.md(r"""
    Use colon syntax as a shortcut for **emojis** in your markdown.
    """)
    return


@app.cell
def _(mo):
    mo.md(r"""
    :rocket: :smile:
    """)
    return


@app.cell
def _():
    import marimo as mo

    return (mo,)


if __name__ == "__main__":
    app.run()
```

### 生成されたURL

```
http://localhost:3000/#code/JYWwDg9gTgLgBCAhlUECwAoTB9bBzAUwDsCpEYCATbAd2BgAs4BeOAIgAYA6ARgE4uAdjaZEYMCwTJUXAILiAFAEpMqjAAExYLgGMCAG30KGwSgWw6IZ5gBUoAVwIqMZgGZxsCkBCUAuTHCBCBBcIJQKUGxRAUEAqgDOBHCW+hBEcPEAnkQwiAAecIjxhRkM0DA69vCu0HAAVHUE3gBWwPENcMDpmRD2UFJQANaUEDREXDGBUWzOQXBQBDB9RGqYmuK6BvqYbh5ePv4Yc96h4ZHRR0G+UBA6g4u+cL7xIMD6BIdz07NBC0tQKywQPW2j0hh2BHcnj8k064HKA1QhWK3jUcz+yzg+wANM41MAodgiIgQOZsCxWGxcEgurg2J8glouA4iMpMEA
```

URL長: 427文字（元ファイル: 420バイト）

---

## 動作環境

> [!IMPORTANT]
> この機能は **WASMランタイム（Pyodide）モード専用** です。
> 通常の `pnpm dev`（WebSocketサーバーモード）では `#code/` フラグメントは**無視**されます。

| 環境 | 動作 |
|---|---|
| [marimo.app](https://marimo.app)（WASMプレイグラウンド） | ✅ 動作する |
| `pnpm dev` ローカルサーバー（WebSocketモード） | ❌ 動作しない |
| https://backcast-tan.web.app/（デプロイ済みWASMアプリ） | ✅ 修正・デプロイ済み |

---

## 関連ファイル

- URLフラグメントのルーティング: `frontend/src/core/wasm/router.ts`（`getCodeFromHash()` で `#code/` を読み取る）
- ファイルストア: `frontend/src/core/wasm/store.ts`（`urlFileStore` でデコードして返す）
- WASMブリッジ: `frontend/src/core/wasm/bridge.ts`（`notebookFileStore.readFile()` を呼び出す起点）
- lz-string ライブラリ: `node_modules/lz-string`

---

## ✅ テスト結果（2026-02-19）

- ✅ **URL生成**: 正常（424文字、`examples/markdown/emoji.py` から生成）
- ✅ **ブラウザ確認**:
  - `pnpm dev` 環境では失敗（既知の仕様：WebSocketモードでは `#code/` は動作しない）
  - `https://marimo.app/` WASMプレイグラウンドで成功。emoji.py の全3セルが正しく表示された
  - `https://backcast-tan.web.app/` WASMデプロイ環境で成功。`:rocket: :smile:` が 🚀 😄 にレンダリングされた

---

## 🔍 根本原因の特定（2026-02-19）

### 問題のコード

**`frontend/src/core/wasm/store.ts`** の `notebookFileStore` の優先順位：

```ts
export const notebookFileStore = new CompositeFileStore([
  // Prefer mount config, then <marimo-code>, then URL
  mountConfigFileStore,   // 1番目（最優先）← codeAtom の値を返す
  domElementFileStore,    // 2番目         ← <marimo-code> DOM要素
  urlFileStore,           // 3番目（最低優先）← #code/ ハッシュをデコード
]);
```

`CompositeFileStore.readFile()` は**最初に非null値を返したストアで終了**する（ショートサーキット）。
`mountConfigFileStore` または `domElementFileStore` に値がある場合、`urlFileStore`（＝URLフラグメント）は**読み込まれない**。

### `backcast-tan.web.app` で失敗する具体的な理由

デプロイされたアプリは `__MARIMO_MOUNT_CONFIG__` またはHTML内の `<marimo-code>` 要素を通じてデフォルトコードを注入している可能性があり、`mountConfigFileStore` か `domElementFileStore` が先に値を返すため、URLフラグメントが無視される。

また、過去にアプリを開いたことがある場合、`fallbackFileStore`（`localStorageFileStore`）に `marimo:file` キーでコードがキャッシュされている可能性もある。

### コードフロー

```
PyodideBridge.startSession()
  └─ notebookFileStore.readFile()  ← CompositeFileStore
       ├─ mountConfigFileStore.readFile()  → store.get(codeAtom) が非nullなら即返却
       ├─ domElementFileStore.readFile()   → <marimo-code>要素があれば返却
       └─ urlFileStore.readFile()          → #code/ ハッシュを解読（ここに届かない）
```

---

## ✅ 修正完了（2026-02-19）

### 採用した修正：案1（`#code/` がある場合はURLストアを最優先にする）

**`frontend/src/core/wasm/store.ts`** を以下のように修正：

```ts
// When #code/ fragment is present in the URL, prioritize urlFileStore
// so that shared code URLs are not ignored by mountConfigFileStore or domElementFileStore.
const hasCodeInHash = PyodideRouter.getCodeFromHash() != null;

export const notebookFileStore = new CompositeFileStore(
  hasCodeInHash
    ? [urlFileStore, mountConfigFileStore, domElementFileStore]
    : [mountConfigFileStore, domElementFileStore, urlFileStore],
);
```

### 修正後のコードフロー

```
PyodideBridge.startSession()
  └─ notebookFileStore.readFile()  ← CompositeFileStore

  【#code/ がURLにある場合】
       ├─ urlFileStore.readFile()          → #code/ ハッシュを解読（最優先）
       ├─ mountConfigFileStore.readFile()  → フォールバック
       └─ domElementFileStore.readFile()   → フォールバック

  【#code/ がURLにない場合（従来通り）】
       ├─ mountConfigFileStore.readFile()  → store.get(codeAtom)
       ├─ domElementFileStore.readFile()   → <marimo-code>要素
       └─ urlFileStore.readFile()          → URLパラメータ等
```

### ローカル検証結果

| 確認項目 | 結果 |
|---|---|
| TypeScript型チェック（`tsc --noEmit`） | ✅ エラーなし |
| `PYODIDE=true` devモードで `#code/` URL → ページタイトル `"notebook.py"` に変化 | ✅ URLからコードがデコードされノートブックとして認識された |
| `#code/` なしの通常アクセス | ✅ 既存動作（フォールバック順序）が壊れていない |
| 絵文字（`:rocket: :smile:`）のレンダリング | ⚠️ ローカルPyodideにmarimoパッケージがないため未確認（デプロイ後に確認が必要） |

### 動作確認URL

```
https://backcast-tan.web.app/#code/JYWwDg9gTgLgBCAhlUECwAoTB9bBzAUwDsCpEYCATbAd2BgAs4BeOAIgAYA6ARgE4uAdjaZEYMCwTJUXAILiAFAEpMqjAAExYLgGMCAG30KGwSgWw6IZ5gBUoAVwIqMZgGZxsCkBCUAuTHCBCBBcIJQKUGxRAUEAqgDOBHCW+hBEcPEAnkQwiAAecIjxhRkM0DA69vCu0HAAVHUE3gBWwPENcMDpmRD2UFJQANaUEDREXDGBUWzOQXBQBDB9RGqYmuK6BvqYbh5ePv4Yc96h4ZHRR0G+UBA6g4u+cL7xIMD6BIdz07NBC0tQKywQPW2j0hh2BHcnj8k064HKA1QhWK3jUcz+yzg+wANM41MAodgiIgQOZsCxWGxcEgurg2J8glouA4iMpMEA
```

---

## Tips・注意事項

- `lz-string` の `compressToEncodedURIComponent` と `decompressFromEncodedURIComponent` はペアで使う
- URLハッシュの `+` は `%2B` にエンコードされないため、URLSearchParams ではなく直接 `window.location.hash` を使う必要がある（`router.ts` の実装は正しい）
- `getCodeFromHash()` 自体は正常に動作している。問題は呼び出し順序のみ
- ローカルストレージの `marimo:file` をクリアしても、`mountConfigFileStore` が優先されると解決しない
- デプロイアプリが `<marimo-code>` タグを使っているかどうかは、本番HTMLのソースを確認すること
