# backcast.py 多言語対応

## Context

デフォルトのノートブック `backcast.py` は日本語のみ。ブラウザの言語設定(en/zh)に応じて、英語・中国語版を表示するようにする。

## 方針

ロケール別のファイルバリアント(`backcast_en.py`, `backcast_zh.py`)を作成し、ローダーがロケールに応じて適切なファイルを取得→常に `backcast.py` として書き込む。

- `backcast.py`（ja）はそのまま維持（ソースオブトゥルース）
- Pyodide FS 上のパスは常に `backcast.py`（他のシステムに影響なし）
- 2段階フォールバック:
  1. `normalizeLocale` が未対応ロケール（ko, fr 等）を `"en"` にマップ（`null`/`undefined` のみ `"ja"`）
  2. ロケール別ファイルの fetch 失敗時は `backcast.py`（日本語）にフォールバック

## 新規ファイル（2件）

### 1. `frontend/public/files/backcast_en.py`
backcast.py の英語版。構造・コードは同一、`mo.md()` とコメントのみ英語化。

### 2. `frontend/public/files/backcast_zh.py`
backcast.py の中国語版。構造・コードは同一、`mo.md()` とコメントのみ中国語化。

## 変更ファイル（4件）

### 3. `frontend/src/core/wasm/worker/backcastpro-loader.ts`
- `setupPythonFiles` に `locale?: SupportedLocale` パラメータを追加（正規化済みの値を受け取る）
- ロケール別ファイル名を決定する `getBackcastFilename()` を追加
- `backcast.py` のfetch時にロケール別ファイルを取得、失敗時は `backcast.py` にフォールバック
- **`normalizeLocale` は import しない**（`bootstrap.ts` で正規化済みの値を受け取る）

```typescript
import type { SupportedLocale } from "@/components/skill-tree/i18n";

function getBackcastFilename(locale?: SupportedLocale): string {
  if (!locale || locale === "ja") {
    return "backcast.py";
  }
  return `backcast_${locale}.py`;
}

async function setupPythonFiles(
  pyodide: PyodideInterface,
  locale?: SupportedLocale,  // 正規化済みロケール
): Promise<void> {
  // ...
  const backcastSourceFile = getBackcastFilename(locale);
  // backcast.py のfetch時に backcastSourceFile を使用
  // 失敗時は backcast.py にフォールバック
  // 書き込み先は常に backcast.py
}
```

### 4. `frontend/src/core/wasm/worker/bootstrap.ts` (L125, L136)
- `mountFilesystem` の引数に `locale?: string | null` を追加
- **`normalizeLocale` を bootstrap.ts で呼び出し**、正規化済みロケールを `setupPythonFiles` に渡す

```typescript
import { normalizeLocale } from "@/components/skill-tree/i18n";

// mountFilesystem 内:
const normalizedLocale = normalizeLocale(opts.locale);
await setupPythonFiles(this.requirePyodide, normalizedLocale);
```

### 5. `frontend/src/core/wasm/worker/worker.ts` (L100-103)
- `mountFilesystem` 呼び出しに `locale` を追加

```typescript
await self.controller.mountFilesystem?.({
  code: opts.code,
  filename: opts.filename,
  locale: opts.userConfig?.display?.locale,  // 追加
});
```

### 6. `frontend/src/core/wasm/worker/types.ts` (L49-52)
- `WasmController.mountFilesystem` の型に `locale?: string | null` を追加

## 変更不要

| ファイル | 理由 |
|---------|------|
| `save-worker.ts` | `locale` 未指定 → `undefined` → `"ja"` フォールバック。save-worker は独立した Pyodide インスタンスを持ち、save 操作は backcast.py テンプレートの言語に依存しないため問題なし |
| `islands/worker/controller.ts` | `mountFilesystem` を override しているが `setupPythonFiles` を呼ばない。`locale` は optional なので型互換 |
| `manifest.json` | ロケール別ファイルはオンデマンド取得。manifest に含めない |
| `FALLBACK_PYTHON_FILES` | 同上。フォールバックリストに追加不要 |

## 実装順

1. `backcast_en.py` 作成
2. `backcast_zh.py` 作成
3. `types.ts` の interface を更新
4. `worker.ts` で locale を渡す
5. `bootstrap.ts` で locale を受け取り `setupPythonFiles` に渡す
6. `backcastpro-loader.ts` で locale 対応ロジックを追加

## 検証

1. ブラウザ言語を `en` に設定 → リロード → backcast.py の markdown が英語で表示されること
2. ブラウザ言語を `zh` に設定 → リロード → backcast.py の markdown が中国語で表示されること
3. ブラウザ言語を `ja`（またはデフォルト）→ 従来通り日本語表示
4. `backcast_en.py` を一時的に削除 → en ロケールでもフォールバックで日本語版が表示されること
5. DevTools Console に `[BackcastPro] Using locale file for backcast:` ログが出ること
6. ブラウザ言語を `ko`（韓国語等の未対応ロケール）に設定 → **英語版** が表示されること（`normalizeLocale("ko")` → `"en"`）
