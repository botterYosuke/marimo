# AnyWidget エラー抑制機能の改修プラン

> **ステータス:** 完了
> **作成日:** 2026-01-25
> **関連ログ:** [browser.devtool.log](browser.devtool.log)

## 問題概要

ブラウザコンソールに lightweight-charts からの "Object is disposed" エラーが **3,883件** 発生している。

```
lightweight-charts.s…ne.production.mjs:7 Uncaught
```

### 原因

1. **`window.onerror` への変更が未適用** - コード変更後、ビルドが実行されていない可能性
2. **HMR時の重複設定** - 開発モードでモジュールが再読み込みされると、エラーハンドラが正しく動作しない可能性

---

## 現在の実装

[AnyWidgetPlugin.tsx:44-70](../frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx#L44-L70)

```typescript
(() => {
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const isDisposedError =
      message === "Object is disposed" ||
      message === "Uncaught Object is disposed";

    const isFromKnownSource =
      !source ||
      source.includes("lightweight-charts") ||
      source.includes("anywidget");

    if (isDisposedError && isFromKnownSource) {
      return true; // Suppress
    }
    // ...
  };
})();
```

---

## 改修内容

### 修正1: HMR対応（重複設定防止）

```typescript
// Before: 毎回上書き
(() => {
  const originalOnError = window.onerror;
  window.onerror = ...
})();

// After: 設定済みならスキップ
const HANDLER_KEY = '__marimo_anywidget_error_handler__';
if (!(window as any)[HANDLER_KEY]) {
  (window as any)[HANDLER_KEY] = true;
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    // ...
  };
}
```

### 修正2: エラー検出条件の強化

現在の条件:
```typescript
message === "Object is disposed" ||
message === "Uncaught Object is disposed"
```

ログを見ると `"Uncaught"` のみのメッセージも多い。条件を拡張:

```typescript
const isDisposedError =
  message === "Object is disposed" ||
  message === "Uncaught Object is disposed" ||
  (typeof message === "string" && message.includes("disposed"));
```

---

## 確認手順

### 1. ビルドの実行

```bash
cd frontend && pnpm build
# または開発サーバー再起動
make dev
```

### 2. 動作確認

```bash
marimo edit fintech1.py
```

ブラウザで確認:
- [ ] チャートが100msごとにスムーズに更新される
- [ ] コンソールに "Object is disposed" エラーが出ない
- [ ] チカチカ（フリッカー）しない

### 3. エラー件数の確認

ブラウザDevToolsのコンソールで:
- 操作前: 3,883件のエラー
- 操作後: 0件（目標）

---

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx` | HMR対応、エラー検出条件強化 |

---

## リスク評価

| リスク | 影響度 | 対策 |
|--------|--------|------|
| 他のエラーを誤って抑制 | 中 | source フィルタリングで軽減済み |
| HMRで動作しない | 低 | グローバルフラグで重複防止 |
| 本番環境での影響 | 低 | minifiedコードでもsource確認 |

---

## 参考

- [README.md](README.md) - プロジェクト概要
- [chart-flickering-handoff-v4.md](chart-flickering-handoff-v4.md) - 元のエラー抑制設計
