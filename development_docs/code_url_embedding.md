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
http://localhost:3000/#code/JYWwDg9gTgLgBCAhlUECwAoTB9bBzAUwDsCpEYCATbAd2BgAs4BeOAIgAYA6ARgE4uAdjaZEYMCwTJUXAILiAFAEpMqjAAExYLgGMCAG30KGwSgWw6IZ5gBUoAVwIqMZgGZxsCkBCUAuTHCBCBBcIJQKUGxRAUEAqgDOBHCW+hBEcPEAnkQwiAAecIjxhRkM0DA69vCu0HAAVHUE3gBWwPENcMDpmRD2UFJQM41MAodgiIgQOZsCxWGxcEgurg2J8glouA4iMpMEA64HKA1QhWK3jUcz+yzg+wANM
```

URL長: 424文字（元ファイル: 420バイト）

---

## 動作環境

> [!IMPORTANT]
> この機能は **WASMランタイム（Pyodide）モード専用** です。
> 通常の `pnpm dev`（WebSocketサーバーモード）では `#code/` フラグメントは**無視**されます。

| 環境 | 動作 |
|---|---|
| [marimo.app](https://marimo.app)（WASMプレイグラウンド） | ✅ 動作する |
| `pnpm dev` ローカルサーバー（WebSocketモード） | ❌ 動作しない |
| https://backcast-tan.web.app/（デプロイ済みWASMアプリ） | ❌ **バグ：動作しない（後述）** |

---

## 関連ファイル

- URLフラグメントのルーティング: `frontend/src/core/wasm/router.ts`（`getCodeFromHash()` で `#code/` を読み取る）
- ファイルストア: `frontend/src/core/wasm/store.ts`（`urlFileStore` でデコードして返す）
- WASMブリッジ: `frontend/src/core/wasm/bridge.ts`（`notebookFileStore.readFile()` を呼び出す起点）
- lz-string ライブラリ: `node_modules/lz-string`

---

## ✅ テスト結果（2026-02-19）

- ✅ **URL生成**: 正常（424文字、`examples/markdown/emoji.py` から生成）
- ❌ **ブラウザ確認**:
  - `pnpm dev` 環境では失敗。ホーム画面が表示され `emoji.py` の内容は展開されなかった（既知の仕様）
  - `https://backcast-tan.web.app/` WASMデプロイ環境でも失敗。`import marimo as mo` の1セルのみのデフォルト状態が表示された

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

## 🔧 修正案

### 案1：`#code/` がある場合はURLストアを最優先にする（推奨）

**`frontend/src/core/wasm/store.ts`** を修正：

```ts
// #code/ フラグメントがURLに存在する場合、URLストアを最優先にする
const hasCodeInHash = PyodideRouter.getCodeFromHash() != null;

export const notebookFileStore = new CompositeFileStore(
  hasCodeInHash
    ? [urlFileStore, mountConfigFileStore, domElementFileStore]
    : [mountConfigFileStore, domElementFileStore, urlFileStore]
);
```

### 案2：`startSession` で明示的に `#code/` を優先チェック

**`frontend/src/core/wasm/bridge.ts`** の `startSession()` を修正：

```ts
private async startSession() {
  // #code/ URLが存在する場合は最優先で使用
  const urlCode = urlFileStore.readFile();
  const code = urlCode
    ? (typeof urlCode === 'string' ? urlCode : await urlCode)
    : await notebookFileStore.readFile();
  const fallbackCode = await fallbackFileStore.readFile();
  // ...
}
```

### 案3：`CompositeFileStore` に優先度逆転オプションを追加

柔軟性が高いが実装量が多い。

### 推奨修正ファイル

| ファイル | 変更内容 |
|---|---|
| `frontend/src/core/wasm/store.ts` | `notebookFileStore` の優先順位を動的に切り替え |
| `frontend/src/core/wasm/bridge.ts` | `startSession` でURLフラグメントを優先チェック |

---

## Tips・注意事項

- `lz-string` の `compressToEncodedURIComponent` と `decompressFromEncodedURIComponent` はペアで使う
- URLハッシュの `+` は `%2B` にエンコードされないため、URLSearchParams ではなく直接 `window.location.hash` を使う必要がある（`router.ts` の実装は正しい）
- `getCodeFromHash()` 自体は正常に動作している。問題は呼び出し順序のみ
- ローカルストレージの `marimo:file` をクリアしても、`mountConfigFileStore` が優先されると解決しない
- デプロイアプリが `<marimo-code>` タグを使っているかどうかは、本番HTMLのソースを確認すること
