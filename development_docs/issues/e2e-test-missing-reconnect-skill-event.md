# Issue: 再接続時のスキルイベント消失シナリオの E2E テストがない

**作成日**: 2026-02-21
**重要度**: Medium
**カテゴリ**: テストカバレッジ / 接続・安定性
**ステータス**: ⬜ 未対応

---

## 概要

`reconnect-skill-event-lost.md` の修正（`replayBufferedMessages()` によるバッファ再生）は実装済みだが、「再接続後にスキルイベントが正しく受信できること」を検証する E2E テストが存在しない。

`persistence.spec.ts` は「リロード後に進捗が 0 にリセットされる（正常動作）」を検証しているが、「再接続後に Python 側から送られたスキルイベントが消失せずフロントエンドに届く」シナリオは未検証。

## 背景

`reconnect-skill-event-lost.md` の修正内容:
- `skill-complete-handler.ts` に `replayBufferedMessages()` を追加
- `BroadcastChannel` のバッファメカニズム実装
- 再接続タイミングでバッファされたメッセージを再生し、スキルイベントの消失を防止

UX プレイテストレポート（`ux-playtest-report.md`）では **P1 問題** として記録されており、「進捗 0/59 のまま動かない」という最も深刻なユーザー体験の問題。

## 再現シナリオ

1. Python セルを実行してスキルイベントを発火する
2. 同時にブラウザが WebSocket 再接続中（"Reconnected" バナー表示中）である
3. 再接続完了後にスキルが "completed" になっていない（イベント消失）

## 期待される動作

以下のシナリオが E2E テストで検証されること:

1. marimo カーネルに接続した状態でスキルイベントを発火する
2. WebSocket 接続を意図的に切断する（またはページリロードで再接続を発生させる）
3. 再接続後にスキルが `completed` になっている（バッファ再生が機能している）

## 対象ファイル

| ファイル | 対応箇所 |
|---------|---------|
| `frontend/e2e-tests/game/persistence.spec.ts` | 新規テストケース追加先（候補） |
| `frontend/src/components/skill-tree/skill-complete-handler.ts` | `replayBufferedMessages()` 実装箇所 |
| `frontend/e2e-tests/game/helpers.ts` | `ensureConnected()` — 接続状態の制御に使用 |

## 実装案

```typescript
// persistence.spec.ts に追加
test("再接続後もスキルイベントが消失せず反映される", async ({ page }) => {
  // 1. スキルイベントを発火する（バッファに蓄積される状態をシミュレート）
  // 2. ページをリロードして再接続を発生させる
  await page.reload();
  await ensureConnected(page);
  // 3. バッファ再生によりスキルが completed になっていることを確認
  await waitForSkillStatus(page, "SANDBOX_001", "completed");
});
```

**課題**: 再接続タイミングとイベント発火の競合状態を E2E テストで制御するのが難しい。`waitForTimeout` 依存にならないよう状態ベース待機を使う必要がある。

## 関連 Issue

- `reconnect-skill-event-lost.md` — 修正済み Issue（修正内容の詳細はこちら）

## 備考

UX プレイテストレポート（`ux-playtest-report.md`）では P1 問題として記録されているが、「まだ未解決」とも記載されている（`development_docs/game/game-e2e-review-system.md` の未完了セクション参照）。修正実装の有効性を E2E テストで確認することが重要。
