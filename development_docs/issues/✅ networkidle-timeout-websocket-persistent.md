# Issue: `waitForLoadState("networkidle")` が marimo の永続 WebSocket により到達不能でタイムアウトする

**作成日**: 2026-02-21
**重要度**: High
**カテゴリ**: テスト / 接続
**ステータス**: ✅ 修正済み

---

## 概要

複数の e2e テストスペックで `page.waitForLoadState("networkidle")` を `beforeEach` に使用しているが、marimo は WebSocket 接続を常時保持するため `"networkidle"` 状態に到達しない。その結果、該当テストがタイムアウトで失敗する。

## 再現手順

1. `npx playwright test e2e-tests/game/ --headed --reporter=line` を全スイート実行する
2. `bridge.spec.ts:227`、`persistence.spec.ts:53,98,153,180`、`ui.spec.ts:54,204`、`z-python-e2e.spec.ts:80,91` が失敗する
3. エラーメッセージ: `Timeout waiting for load state "networkidle"`

## 期待される動作

ページロード後に `beforeEach` が完了し、テスト本体が実行される。

## 実際の動作

`waitForLoadState("networkidle")` が Playwright のデフォルトタイムアウト（30 秒）まで待機し続け、タイムアウトエラーで `beforeEach` が失敗する。テスト本体は実行されない。

## 関連ファイル

| ファイル | 関連箇所 |
|---------|---------|
| `frontend/e2e-tests/game/bridge.spec.ts` | 227行目付近の `beforeEach` 内 `waitForLoadState("networkidle")` |
| `frontend/e2e-tests/game/persistence.spec.ts` | 53, 98, 153, 180行目付近の `beforeEach` 内 |
| `frontend/e2e-tests/game/ui.spec.ts` | 37, 54, 204行目付近の `beforeEach` 内 |
| `frontend/e2e-tests/game/z-python-e2e.spec.ts` | 80, 91行目付近の `beforeEach` 内 |
| `frontend/e2e-tests/game/helpers.ts` | `ensureConnected()` — 接続確認の代替パターン |

## 調査メモ

### 原因

marimo は編集モードで WebSocket（`/ws` エンドポイント）を常時保持し、カーネルとの双方向通信を維持する（ReconnectingWebSocket / partysocket を使用）。Playwright の `"networkidle"` 判定は「500ms 以上ネットワークリクエストが発生しない」を条件とするため、WebSocket 接続が存在する限り永遠に達成されない。

### 影響範囲

フルラン（2026-02-21 実施）では 25 件の失敗のうち 9 件がこのカテゴリに分類された（カテゴリ A）。

### 修正方針

該当ファイルの `waitForLoadState("networkidle")` を `waitForLoadState("load")` または `waitForLoadState("domcontentloaded")` に置き換える。

接続の安定確認には `helpers.ts` の `ensureConnected()` を使用する（カーネルの緑チェックマーク確認 + Reconnected バナー安定化を行う）。

```typescript
// 変更前（問題あり）
await page.waitForLoadState("networkidle");

// 変更後（推奨）
await page.waitForLoadState("load");
await ensureConnected(page);
```

### 知見35a との関係

`development_docs/game/game-e2e-review-system.md` の知見 35a に記載されているルールに違反している。`"networkidle"` は使用禁止であり、`"load"` を使用する。今回の全スイートで再度この違反が確認された。

## 修正内容

**修正日**: 2026-02-21
**コミット**: bug-fix-orchestrate + バグ修正オーケストレーション

`bridge.spec.ts`, `persistence.spec.ts`, `ui.spec.ts`, `z-python-e2e.spec.ts`, `guard-validation.spec.ts`, `integration.spec.ts` の全 `waitForLoadState("networkidle")` を `waitForLoadState("load")` に置換し、各箇所に `await ensureConnected(page)` を追加した。
