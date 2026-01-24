# AnyWidgetPlugin コードレビュー修正プラン

> **作成日:** 2026-01-25
> **ステータス:** 未着手

## 概要

コードレビューで指摘された CRITICAL/HIGH の問題を修正するプラン。

## 指摘事項と修正方針

### CRITICAL-1: グローバル状態の汚染

**問題:**
- モジュールロード時に `window.onerror` を無条件で上書き
- 他のエラーハンドラと競合するリスク

**修正方針:**
エラー抑制を維持しつつ、より安全なパターンに変更。

**選択肢:**

| 選択肢 | メリット | デメリット |
|--------|----------|------------|
| A: 現状維持 + source フィルタ追加 | コンソール出力を完全抑制 | グローバル状態汚染 |
| B: addEventListener に戻す | クリーンアップ可能 | コンソールにエラー表示される |
| C: ハイブリッド | バランスが良い | 複雑さが増す |

**推奨:** 選択肢 A（現状維持 + source フィルタ追加）

理由:
- ユーザー体験を優先（コンソールエラーはユーザーに不安を与える）
- lightweight-charts 固有の問題なので、source フィルタで範囲を限定

---

### CRITICAL-2: ログファイルのコミット

**問題:**
- `browser.devtool.log` がステージングされている
- ログファイルは Git に含めるべきではない

**修正方針:**
1. ステージングから除外
2. `.gitignore` に追加

---

### HIGH-1: クリーンアップ機構の欠如

**問題:**
- IIFE にはクリーンアップがない

**修正方針:**
- モジュールレベルのエラーハンドラはクリーンアップ不要と判断
- アプリケーションのライフサイクル全体で有効であるべき
- **対応不要**（設計上の意図的な選択）

---

### HIGH-2: エラー抑制範囲が広すぎる

**問題:**
- すべての "Object is disposed" エラーをグローバルに抑制
- 他のライブラリの正当なエラーも隠れる可能性

**修正方針:**
- `source` パラメータでフィルタリングを追加
- lightweight-charts からのエラーのみ抑制

---

## 修正コード

### 1. AnyWidgetPlugin.tsx のエラーハンドラ修正

**ファイル:** `frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx`

**変更前（行38-55）:**
```typescript
(() => {
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (
      message === "Object is disposed" ||
      message === "Uncaught Object is disposed"
    ) {
      Logger.debug(
        "[AnyWidget] Suppressed 'Object is disposed' error (widget cleanup race condition)",
      );
      return true; // Suppress the error
    }
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };
})();
```

**変更後:**
```typescript
// Global error suppression for "Object is disposed" errors from lightweight-charts.
// These errors occur when requestAnimationFrame callbacks execute after chart disposal.
// Set up once at module load time to ensure it's always active.
//
// IMPORTANT: We use window.onerror because returning `true` fully suppresses the error.
// addEventListener's preventDefault() doesn't prevent console output.
//
// NOTE: We filter by source to avoid suppressing legitimate errors from other libraries.
(() => {
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    // Only suppress "Object is disposed" errors from known widget libraries
    const isDisposedError =
      message === "Object is disposed" ||
      message === "Uncaught Object is disposed";

    // Filter by source - only suppress errors from lightweight-charts or anywidget modules
    // If source is undefined, we still suppress as it's likely from minified code
    const isFromKnownSource =
      !source ||
      source.includes("lightweight-charts") ||
      source.includes("anywidget");

    if (isDisposedError && isFromKnownSource) {
      Logger.debug(
        "[AnyWidget] Suppressed 'Object is disposed' error (widget cleanup race condition)",
      );
      return true; // Suppress the error
    }
    if (originalOnError) {
      return originalOnError(message, source, lineno, colno, error);
    }
    return false;
  };
})();
```

### 2. ログファイルの除外

```bash
# ステージングから除外
git reset HEAD docs/plans/browser.devtool.log

# .gitignore に追加（オプション）
echo "docs/plans/*.log" >> .gitignore
```

---

## 実装手順

### Step 1: ログファイルをステージングから除外

```bash
cd C:\Users\sasai\Documents\marimo
git reset HEAD docs/plans/browser.devtool.log
```

### Step 2: AnyWidgetPlugin.tsx を修正

1. 行38-55 のエラーハンドラを上記の変更後コードに置換
2. source フィルタリングを追加

### Step 3: フロントエンドビルド

```bash
cd frontend
pnpm build
```

### Step 4: 検証

```bash
# marimo を起動してチャートをテスト
marimo edit fintech1.py

# ブラウザコンソールを確認:
# - lightweight-charts のエラーが抑制されていること
# - 他のエラーは正常に表示されること
```

---

## チェックリスト

- [ ] ログファイルをステージングから除外
- [ ] エラーハンドラに source フィルタを追加
- [ ] フロントエンドビルド
- [ ] 動作検証（チャート更新、エラー抑制）
- [ ] `make fe-check` でリント/型チェック通過

---

## 補足: 設計判断の記録

### なぜ window.onerror を使うのか

`addEventListener("error", ...)` では:
- `event.preventDefault()` でエラーの伝播は止められる
- しかし **コンソールへの出力は止められない**

ユーザーがブラウザコンソールを開いた時に大量のエラーが表示されると:
- 不安を与える
- 他の重要なエラーが埋もれる
- サポート問い合わせが増える

そのため `window.onerror` で `return true` して完全に抑制する。

### なぜ source フィルタを追加するのか

他のライブラリでも "Object is disposed" エラーが発生する可能性がある。
その場合は正当なバグの可能性があるため、抑制すべきではない。

lightweight-charts は内部で `requestAnimationFrame` を使用し、
コンポーネントアンマウント後もコールバックが実行されるため、
このエラーは **既知の問題** であり、抑制しても安全。
