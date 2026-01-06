# URL埋め込みコード読み込み機能

> **概要**: このドキュメントは、BackcastアプリケーションにおけるURLに直接埋め込まれた圧縮データ（ノートブックコード）を読み込む機能について説明します。

---

## 1. 機能概要

Backcastアプリケーションは、ノートブックのコードをURLに直接埋め込むことで、コードを共有したり、外部ページに埋め込んだりすることができます。この機能により、サーバーサイドのストレージを必要とせずに、URLだけでノートブックを配布・共有できます。

### 1.1 主な用途

- **ノートブックの共有**: URLを共有するだけで、コードを含むノートブックを開くことができる
- **Webページへの埋め込み**: iframeを使用して、他のWebページにノートブックを埋め込むことができる
- **一時的なコード配布**: サーバーに保存せずに、コードを配布できる

### 1.2 対応する形式

この機能は2つの形式をサポートしています：

1. **クエリパラメータ形式** (`?code=...`): 小容量のノートブック用（14KB以下）
2. **URLハッシュ形式** (`#code/...`): 大容量のノートブック用（14KB以上、圧縮必須）

---

## 2. 実装の詳細

### 2.1 アーキテクチャ

URLからのコード読み込みは、`FileStore`インターフェースを通じて実装されています。`urlFileStore`がURLからの読み込みを担当し、`CompositeFileStore`によって複数のストアを優先順位付きで統合しています。

#### ファイルストアの優先順位

`notebookFileStore`は以下の順序でコードを読み込みます：

1. **DOM要素** (`domElementFileStore`): `<marimo-code>`要素から読み込み
2. **URL** (`urlFileStore`): URLハッシュまたはクエリパラメータから読み込み

```typescript
export const notebookFileStore = new CompositeFileStore([
  // Prefer <marimo-code>, then URL
  domElementFileStore,
  urlFileStore,
]);
```

### 2.2 コア実装

#### urlFileStore

`frontend/src/core/wasm/store.ts`で定義されている`urlFileStore`が、URLからのコード読み込みを担当します：

```typescript
const urlFileStore: FileStore = {
  saveFile(contents: string) {
    // Set the code in the URL
    PyodideRouter.setCodeForHash(compressToEncodedURIComponent(contents));
  },
  readFile() {
    const code =
      PyodideRouter.getCodeFromHash() || PyodideRouter.getCodeFromSearchParam();
    if (!code) {
      return null;
    }
    return decompressFromEncodedURIComponent(code);
  },
};
```

**動作の流れ**:

1. **読み込み時** (`readFile()`):
   - まずURLハッシュ（`#code/...`）からコードを取得を試みる
   - ハッシュにコードがない場合、クエリパラメータ（`?code=...`）から取得を試みる
   - 取得したコードを`lz-string`で展開（圧縮されている場合）

2. **保存時** (`saveFile()`):
   - コードを`lz-string`で圧縮
   - URLハッシュ（`#code/圧縮データ`）に設定

#### PyodideRouter

`frontend/src/core/wasm/router.ts`で定義されている`PyodideRouter`が、URLの操作を担当します：

```typescript
class URLPyodideRouter {
  getCodeFromSearchParam(): string | null {
    return this.getSearchParam("code");
  }

  getCodeFromHash(): string | null {
    const hash = window.location.hash;
    const prefix = "#code/";
    if (!hash.startsWith(prefix)) {
      return null;
    }
    return hash.slice(prefix.length);
  }

  setCodeForHash(code: string) {
    window.location.hash = `#code/${code}`;
  }
}
```

### 2.3 圧縮方式

大容量のノートブックを扱うため、`lz-string`ライブラリを使用してコードを圧縮します：

- **圧縮**: `compressToEncodedURIComponent()` - コードを圧縮してURIエンコード
- **展開**: `decompressFromEncodedURIComponent()` - URIエンコードされた圧縮データを展開

この圧縮により、URLの長さ制限を回避しつつ、大きなノートブックもURLに埋め込むことができます。

---

## 3. 使用方法

### 3.1 小容量ノートブック（14KB以下）

14KB以下のノートブックは、クエリパラメータ形式で直接埋め込むことができます。圧縮は不要です。

#### JavaScriptでの実装例

```javascript
const notebookCode = `
import marimo
app = marimo.App()

@app.cell
def _():
    import marimo as mo
    mo.md("Hello, world!")
    return
`;

// URIエンコードしてクエリパラメータに設定
const encodedCode = encodeURIComponent(notebookCode);
// 注意: 以下のURLは例です。実際のBackcastアプリケーションのURLに置き換えてください
const url = `https://example.com?code=${encodedCode}`;
```

#### 完全なURL例（注意: 以下のURLは例です）

```
https://example.com?code=import%20marimo%0Aapp%20%3D%20marimo.App()%0A%0A%40app.cell%0Adef%20_()%3A%0A%20%20%20%20import%20marimo%20as%20mo%0A%20%20%20%20mo.md(%22Hello%2C%20world!%22)%0A%20%20%20%20return
```

### 3.2 大容量ノートブック（14KB以上）

14KBを超えるノートブックは、`lz-string`を使用して圧縮し、URLハッシュ形式で埋め込む必要があります。

#### JavaScriptでの実装例

```javascript
import { compressToEncodedURIComponent } from "lz-string";

const notebookCode = `
// ... 大きなノートブックコード ...
`;

// 圧縮してURLハッシュに設定
const compressed = compressToEncodedURIComponent(notebookCode);
// 注意: 以下のURLは例です。実際のBackcastアプリケーションのURLに置き換えてください
const url = `https://example.com/#code/${compressed}`;
```

#### 完全なURL例（注意: 以下のURLは例です）

```
https://example.com/#code/N4IgdghgtgpiBcIDqA...
```

### 3.3 共有リンクの生成

`frontend/src/core/wasm/share.ts`の`createShareableLink()`関数を使用して、共有可能なリンクを生成できます：

```typescript
import { createShareableLink } from "./core/wasm/share";

const code = `
import marimo
app = marimo.App()
// ... ノートブックコード ...
`;

// 共有リンクを生成（自動的に圧縮される）
// 注意: baseUrlは実際のBackcastアプリケーションのURLに置き換えてください
const shareableUrl = createShareableLink({
  code: code,
  baseUrl: "https://example.com"
});
```

### 3.4 Webページへの埋め込み

#### iframeでの埋め込み

```html
<!-- 注意: 以下のURLは例です。実際のBackcastアプリケーションのURLに置き換えてください -->
<iframe
  src="https://example.com?code=<encoded-uri-component>&embed=true&show-chrome=false"
  width="100%"
  height="500"
  frameborder="0"
  sandbox="allow-scripts allow-same-origin"
></iframe>
```

#### React/JSXでの実装例

```jsx
import { compressToEncodedURIComponent } from "lz-string";

const NotebookEmbed = ({ code }: { code: string }) => {
  // 大容量の場合は圧縮、小容量の場合はエンコードのみ
  const isLarge = code.length > 14 * 1024;
  const encoded = isLarge
    ? compressToEncodedURIComponent(code)
    : encodeURIComponent(code);
  
  // 注意: 以下のURLは例です。実際のBackcastアプリケーションのURLに置き換えてください
  const url = isLarge
    ? `https://example.com/#code/${encoded}`
    : `https://example.com?code=${encoded}`;

  return (
    <iframe
      src={`${url}&embed=true&show-chrome=false`}
      width="100%"
      height="500"
      frameBorder="0"
      sandbox="allow-scripts allow-same-origin"
    />
  );
};
```

---

## 4. 読み込みのタイミング

URLからのコード読み込みは、アプリケーションの起動時（セッション開始時）に実行されます。

### 4.1 読み込み処理の流れ

`frontend/src/core/wasm/bridge.ts`の`startSession()`メソッドで、以下の順序でコードを読み込みます：

```typescript
const code = await notebookFileStore.readFile();
const fallbackCode = await fallbackFileStore.readFile();
const filename = PyodideRouter.getFilename();

await this.rpc.proxy.request.startSession({
  queryParameters: queryParameters,
  code: code || fallbackCode || "",
  filename,
  // ...
});
```

**処理の順序**:

1. `notebookFileStore.readFile()`を実行
   - `<marimo-code>`要素から読み込みを試みる
   - 見つからない場合、URLハッシュ/クエリパラメータから読み込みを試みる
2. コードが見つからない場合、`fallbackFileStore.readFile()`を実行
   - ローカルストレージから読み込みを試みる
   - 見つからない場合、リモートデフォルトファイルを読み込みを試みる
   - それでも見つからない場合、空のテンプレートを返す

### 4.2 ファイル名の取得

URLクエリパラメータからファイル名を取得することもできます：

```typescript
const filename = PyodideRouter.getFilename();
// URL: https://example.com?filename=my_notebook.py
// filename = "my_notebook.py"
// 注意: 上記のURLは例です。実際のBackcastアプリケーションのURLに置き換えてください
```

---

## 5. 技術的な制約と注意事項

### 5.1 URLの長さ制限

- **ブラウザの制限**: 多くのブラウザはURLの長さに制限があります（一般的に2,000〜8,000文字程度）
- **推奨**: 14KBを超えるノートブックは必ず圧縮形式（URLハッシュ）を使用すること

### 5.2 圧縮の必要性

- **14KB以下**: クエリパラメータ形式で直接埋め込み可能（圧縮不要）
- **14KB以上**: URLハッシュ形式で圧縮して埋め込む必要がある

### 5.3 セキュリティに関する注意

- URLに埋め込まれたコードは、URLを共有するすべてのユーザーが閲覧可能です
- 機密情報や認証情報を含むコードをURLに埋め込まないでください
- パブリックに共有されることを前提として使用してください

### 5.4 パフォーマンス

- 大きなノートブックを圧縮する場合、圧縮/展開処理に時間がかかる場合があります
- 圧縮データのサイズは、元のコードサイズによって大きく異なります

---

## 6. 実装ファイル一覧

この機能に関連する主要なファイル：

- **`frontend/src/core/wasm/store.ts`**: `urlFileStore`の実装、`FileStore`インターフェース
- **`frontend/src/core/wasm/router.ts`**: `PyodideRouter`の実装、URL操作
- **`frontend/src/core/wasm/share.ts`**: 共有リンク生成ユーティリティ
- **`frontend/src/core/wasm/bridge.ts`**: セッション開始時のコード読み込み処理

---

## 7. テスト

この機能のテストは以下のファイルで実装されています：

- **`frontend/src/core/wasm/__tests__/router.test.ts`**: `PyodideRouter`のテスト
- **`frontend/src/core/wasm/__tests__/share.test.ts`**: 共有リンク生成のテスト

### テストの実行方法

```bash
cd frontend
pnpm test src/core/wasm/__tests__/router.test.ts
pnpm test src/core/wasm/__tests__/share.test.ts
```

---

## 8. 参考資料

- [lz-string ライブラリ](https://www.npmjs.com/package/lz-string): 圧縮ライブラリのドキュメント
- [MDN: URL API](https://developer.mozilla.org/ja/docs/Web/API/URL): URL操作のリファレンス
- [MDN: History API](https://developer.mozilla.org/ja/docs/Web/API/History_API): ブラウザ履歴の操作

---

## 9. まとめ

URL埋め込みコード読み込み機能により、Backcastアプリケーションは以下のことが可能になります：

- ✅ サーバーサイドのストレージを必要とせずにノートブックを共有
- ✅ Webページにノートブックを埋め込む
- ✅ URLだけでノートブックを配布・共有
- ✅ 小容量・大容量の両方のノートブックに対応

この機能は、Backcastアプリケーションの柔軟性と共有性を大幅に向上させる重要な機能です。

