# Issue: フルラン時のスペック間カーネル汚染を検出する E2E テストがない

**作成日**: 2026-02-21
**重要度**: Medium
**カテゴリ**: テストカバレッジ / テスト信頼性
**ステータス**: ⬜ 未対応

---

## 概要

以下 2 件の修正済み Issue はいずれも「フルラン（全スペック連続実行）時の汚染」を防ぐ修正だが、汚染が発生していないことを検証するテストが存在しない。

| 修正済み Issue | 概要 |
|---|---|
| `disconnected-kernel-cross-spec-contamination.md` | 前スペック終了後にカーネルが disconnected になり後スペックが失敗 |
| `state-contamination-auto-instantiate-skill-leak.md` | auto_instantiate でスキル状態がスペック間に漏洩し進捗が汚染される |

現在の修正（`ensureConnected()` 強化・`resetGameProgress()` 追加・セル蓄積対策）は「汚染を防ぐ」実装だが、「汚染が実際に起きていないこと」を CI で継続的に検証する仕組みがない。

## 問題の詳細

### disconnected-kernel-cross-spec-contamination

フルラン実行時に `sandbox.spec.ts` → `persistence.spec.ts` → `bridge.spec.ts` ... の順で実行されると、前スペックが残したカーネル状態（蓄積されたセル・WebSocket 再接続バーストなど）により、後スペックの `beforeEach` でカーネルが "disconnected" になる。

### state-contamination-auto-instantiate-skill-leak

`game_test.py` に `emitSkillViaPython()` が追加したセルが auto_instantiate で再実行され、次のスペックの初期状態でスキルが意図せず "completed" になる（例: `persistence.spec.ts:58` で SANDBOX_001 が completed）。

## 期待される動作

以下を検証するテストがあること:

1. 全スペック実行後も各スペックの先頭テストで `completedSkills` が `0` であること
2. フルラン後に次の sandbox.spec.ts を実行したとき `SANDBOX_001` が初期状態（`unlocked`）であること
3. スペック間でカーネルが健全（`[data-testid="backend-status"]` が緑）であること

## 対象ファイル

| ファイル | 対応箇所 |
|---------|---------|
| `frontend/e2e-tests/game/helpers.ts` | `ensureConnected()` / `resetGameProgress()` |
| `frontend/playwright.config.ts` | `globalSetup` / `globalTeardown` |
| `frontend/e2e-tests/game/global-setup.ts` | フルラン前のクリーンアップ確認ポイント |
| `frontend/e2e-tests/game/global-teardown.ts` | フルラン後の復元確認ポイント |

## 実装案

### 案 A: `global-setup.ts` にアサーション追加

```typescript
// global-setup.ts
// 全スペック開始前に game_test.py のセル数が想定値であることを確認
const cell_count = await page.evaluate(() => window.__cellCount);
expect(cell_count).toBeLessThanOrEqual(EXPECTED_CELL_COUNT);
```

### 案 B: `persistence.spec.ts` の最初のテストに追加アサーション

```typescript
// persistence.spec.ts - 最初のテスト
// 他スペック実行後でも completedSkills が 0 であることを確認（汚染検出）
test("スペック開始時点で completedSkills は 0（他スペックからの汚染なし）", async ({ page }) => {
  const count = await getCompletedSkillCount(page);
  expect(count).toBe(0);
});
```

### 案 C: CI 専用フルランテスト

```bash
# CI で全スペックを実行し、最後に状態検証スペックを実行
npx playwright test e2e-tests/game/ --reporter=line
npx playwright test e2e-tests/game/contamination-check.spec.ts
```

## 推奨アクション

- **短期**: 案 B（`persistence.spec.ts` の先頭テストを汚染検出テストとして位置付ける）
- **長期**: 案 C（フルラン後専用の contamination-check.spec.ts 新規作成）

## 関連 Issue

- `disconnected-kernel-cross-spec-contamination.md` — 修正済み Issue
- `state-contamination-auto-instantiate-skill-leak.md` — 修正済み Issue
