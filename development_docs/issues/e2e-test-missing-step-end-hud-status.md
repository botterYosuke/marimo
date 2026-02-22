# Issue: ゲーム終了後の HUD ステータスラベル（"Finished"）を検証する E2E テストがない

**作成日**: 2026-02-21
**重要度**: Medium
**カテゴリ**: テストカバレッジ / UI
**ステータス**: ⬜ 未対応

---

## 概要

`step-end-status-label-wrong.md` の修正（ゲーム終了後に HUD ステータスを "Trading" → "Finished" に変更）は実装済みだが、UI ラベルが正しく "Finished" になることを明示的に検証する E2E テストが存在しない。

`backcast-integration.spec.ts` の全テストは `bt.step()` の複数回実行を含むが、ゲーム終了（`step()` が `False` を返す状態）後の HUD ステータス表示を確認しているケースはない。

## 背景

`step-end-status-label-wrong.md` の修正内容:
- `step()` の戻り値が `False`（＝バックテスト終了）のとき、HUD ステータスを "Finished" に更新する
- 修正前は終了後も "Trading" のまま表示されていた

現在の `backcast-integration.spec.ts` は長期プレイフロー（ `bt.buy()` → `bt.step()` × N 回）を実行するが、**ゲーム終了（全データ消化）後に "Finished" ラベルが表示されることを assert していない**。

## 期待される動作

以下のシナリオが E2E テストで検証されること:

1. `bt.step()` を繰り返しデータ末尾まで進める（または直接終了状態にする）
2. HUD の status 要素が `"Finished"` を表示する
3. "Trading" 文字列が残っていないことを確認する

## 対象ファイル

| ファイル | 対応箇所 |
|---------|---------|
| `frontend/e2e-tests/game/backcast-integration.spec.ts` | 新規テストケース追加先 |
| `frontend/src/components/backtest-hud.tsx` | ステータスラベルの実装箇所 |
| `C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py` | `step()` 終了判定箇所 |

## 実装案

```typescript
// backcast-integration.spec.ts に追加
test("ゲーム終了後に HUD ステータスが Finished になる", async ({ page }) => {
  // データを末尾まで step() する
  // 最後の step() が False を返した後
  const statusEl = page.locator('[data-testid="hud-status"]');
  await expect(statusEl).toHaveText("Finished");
  await expect(statusEl).not.toHaveText("Trading");
});
```

`data-testid="hud-status"` が `backtest-hud.tsx` に存在しない場合は追加が必要。

## 実装試行記録

**試行日**: 2026-02-21
**ブロッカー**: `bt.step()` をデータ末尾まで進めるには backcast.py + BackcastPro エンジン + 実株価データが必要。E2E テスト環境（game_test.py）ではゲームエンジンが未初期化。backcast-integration.spec.ts は backcast.py を使うが、全データ消化（数百〜数千 step）は時間的に非現実的。
**試行内容**: data-testid="hud-status" の存在確認を試みたが、backtest-hud.tsx が game_test.py 上では render されないため検証不可。
**推奨**: backcast-integration.spec.ts で短いデータセット（10ステップ程度）を使った終了テストを追加する。要: テスト用短縮データの準備。

## 関連 Issue

- `step-end-status-label-wrong.md` — 修正済み Issue（修正内容の詳細はこちら）
