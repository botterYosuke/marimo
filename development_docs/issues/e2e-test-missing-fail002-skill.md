# Issue: FAIL_002 スキル（損切り判定）の E2E テストが存在しない

**作成日**: 2026-02-21
**重要度**: High
**カテゴリ**: テストカバレッジ / スキルロジック
**ステータス**: ⬜ 未対応

---

## 概要

`fail002-wrong-timing-in-sell.md` の修正（FAIL_002 損切り判定を `sell()` → `step()` 内に移動）は実装済みだが、その動作を検証する E2E テストが存在しない。

`fail002-wrong-timing-in-sell.md` に記録された修正が将来リグレッションしても、自動テストでは検出できない状態。

## 背景

`fail002-wrong-timing-in-sell.md` の修正内容:
- `_check_stop_loss()` を `sell()` から `step()` 内に移動
- `step()` ごとにポジション価値を評価し、10% 下落で FAIL_002 発火

現在の sandbox.spec.ts / z-python-e2e.spec.ts は成功系スキル（SANDBOX_001〜006 など）のみを検証しており、失敗系スキル（FAIL_002）は一切テストされていない。

## 期待される動作

以下のシナリオが E2E テストで検証されること:

1. `bt.buy()` でポジションを取得する
2. 価格が 10% 以上下落した状態で `bt.step()` を呼ぶ
3. FAIL_002 スキルが `completed` になる
4. FAIL_002 ノードが `completed` 状態に UI 反映される

## 対象ファイル

| ファイル | 対応箇所 |
|---------|---------|
| `frontend/e2e-tests/game/z-python-e2e.spec.ts` | FAIL_002 テストケース追加先（候補） |
| `frontend/e2e-tests/game/helpers.ts` | `emitSkillViaPython()` — 既存ヘルパーを活用 |
| `C:\Users\sasac\AppData\Roaming\marimo\notebooks\game_setup.py` | `_check_stop_loss()` の実装箇所 |

## 実装案

```typescript
// z-python-e2e.spec.ts に追加
test("FAIL_002: step() で損切り判定が発火する", async ({ page }) => {
  // 1. データ取得・buy()
  // 2. 価格下落をモックまたは step() を繰り返す
  // 3. FAIL_002 が completed になることを確認
  await waitForSkillStatus(page, "FAIL_002", "completed");
});
```

ただし「価格 10% 下落」を E2E テストでどう再現するか（実データ依存 vs モック）は要検討。

## 関連 Issue

- `fail002-wrong-timing-in-sell.md` — 修正済み Issue（修正内容の詳細はこちら）
