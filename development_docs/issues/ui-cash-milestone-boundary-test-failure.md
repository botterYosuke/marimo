# Issue: ui.spec.ts:176 現金マイルストーン境界テストが「Expected > 50000, Received 50000」で失敗する

**作成日**: 2026-02-21
**重要度**: Medium
**カテゴリ**: UI / データ
**ステータス**: Open

---

## 概要

`ui.spec.ts` の 176 行目付近にある現金マイルストーン検証テストが失敗する。
テストは「マイルストーン到達後に現金が 50,000 円を超えている」ことを確認するが、実際には現金が 50,000 円ちょうどになっており `Expected > 50000, Received 50000` で失敗する。

初期資産 ¥100,000 → マイルストーン報酬として +X 円が付与されるはずが、現金が初期値のまま、あるいはちょうど境界値（50,000）になっている。

## 再現手順

1. `npx playwright test e2e-tests/game/ --headed --reporter=line` でフルランを実行する
2. `ui.spec.ts:176` が `Expected > 50000, Received 50000` で失敗する

## 期待される動作

マイルストーン報酬が付与された後に HUD の Cash 表示が `> 50,000` 円になっている。

## 実際の動作

Cash が 50,000 円ちょうどであり、「50,000 を超えている」アサーションが失敗する。

考えられるシナリオ:
- **シナリオ A（初期値問題）**: テスト開始時点で既に Cash が 50,000 になっている（前スペックの状態汚染 or マイルストーン境界との一致）
- **シナリオ B（マイルストーン未付与）**: スキル取得はされたがマイルストーン報酬（現金付与）が実行されていない
- **シナリオ C（初期 Cash が 50,000 設定）**: ゲームの初期資産が ¥100,000 ではなく ¥50,000 に変更されており、初期 Cash が境界値と一致している

## 関連ファイル

| ファイル | 関連箇所 |
|---------|---------|
| `frontend/e2e-tests/game/ui.spec.ts` | 176行目 — Cash マイルストーンアサーション |
| `frontend/src/components/editor/controls/backtest-hud.tsx` | HUD の Cash 表示 |
| `frontend/src/components/skill-tree/atoms.ts` | マイルストーン報酬付与ロジック（`completeSkillWithRewardAtom`） |

## 調査メモ

### 状態汚染との関係

`state-contamination-auto-instantiate-skill-leak.md` に記録された状態汚染が修正済みとされているが、フルランでは依然として発生している可能性がある。特に `ui.spec.ts` が実行される順番と前スペックの残留状態が影響している可能性がある。

### マイルストーン報酬額の確認

`skill-data.ts` の各スキルの `reward.value` と、マイルストーン報酬トリガー条件（`milestone` フィールド）を確認する必要がある。

```typescript
// 確認すべき点
// 1. 最初のマイルストーンは何スキル取得後に発動するか
// 2. マイルストーン報酬額はいくらか
// 3. 初期 Cash + 報酬額 > 50,000 が成立するか
```

### プレイログとの関係

2026-02-21 フルランの「カテゴリ E」として記録された唯一の UI 現金表示失敗（1件）。他のカテゴリ（A〜D）とは独立した原因である可能性が高い。

`ui.spec.ts` は 4 passed / 3 failed / 3 skipped（合計 10）のうちの 1 件として記録されている。

### 単体実行での確認

前回ベースライン（2026-02-21 セッション開始時）では `ui.spec.ts` は 9 passed / 3 fixme / 0 failed だった。フルラン実行時のみ 3 failed が発生していることから、フルラン固有の状態汚染による可能性がある。

## 推奨調査手順

1. `ui.spec.ts` を単体実行（`npx playwright test e2e-tests/game/ui.spec.ts`）して :176 が通過するか確認する
2. 通過する場合 → フルラン特有の状態汚染が原因（`state-contamination-auto-instantiate-skill-leak.md` の再発）
3. 通過しない場合 → `backtest-hud.tsx` または `atoms.ts` のマイルストーン報酬ロジックに問題あり
