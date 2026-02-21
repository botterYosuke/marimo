# Issue: フルラン結果が 75 passed → 53 passed に退行（修正済み Issue が再発）

**作成日**: 2026-02-21
**重要度**: High
**カテゴリ**: テスト信頼性 / 接続 / UI
**ステータス**: Open

---

## 概要

2026-02-21 のフルラン（全スイート）の結果、前回ベースライン 75 passed / 0 failed から **53 passed / 25 failed** に退行していることを確認した（83 テスト実行）。

`✅ 修正済み` とされていた複数の Issue が実際には解消されておらず、フルラン環境では依然として失敗している。

## 前回ベースラインとの比較

| 指標 | 前回ベースライン（2026-02-21 AM） | 今回フルラン（2026-02-21 PM） |
|------|--------------------------------|------------------------------|
| passed | 75 | 53 |
| failed | 0 | 25 |
| skipped | 5 | 5 |
| 合計 | 80 | 83 |

テスト数が 80 → 83 に増加（新規テスト追加）した一方で、通過数が 75 → 53 に減少（22 件の退行）。

## スイート別詳細

| スイート | 前回 passed | 今回 passed | 今回 failed | 主な失敗原因 |
|---------|------------|------------|------------|------------|
| backcast-integration.spec.ts | 4 | 6 | 0 | ✅ 改善（全 6 PASS） |
| bridge.spec.ts | 10 | 9 | 1 | networkidle タイムアウト（再発） |
| data.spec.ts | - | 9 | 1 | kernel disconnected（再発） |
| guard-validation.spec.ts | - | 0 | 3 | ガード警告未表示（再発） |
| integration.spec.ts | 9 | 3 | 5 | networkidle / 状態汚染（再発） |
| persistence.spec.ts | 8 | 4 | 6 | networkidle / スキル状態汚染（再発） |
| sandbox.spec.ts | 10 | 8 | 1 | kernel disconnected（新規退行） |
| setup.spec.ts | 10 | 9 | 2 | kernel disconnected（新規退行） |
| ui.spec.ts | 9 | 4 | 3 | networkidle / Cash 境界値（再発） |
| z-python-e2e.spec.ts | 4 | 1 | 3 | networkidle / browserContext（再発） |

## 再発している修正済み Issue

### カテゴリ A: networkidle タイムアウト（9 件）

`networkidle-timeout-websocket-persistent.md` が `✅ 修正済み` とされているが、以下のスペックで再発:
- `bridge.spec.ts:227`
- `persistence.spec.ts:53,98,153,180`
- `ui.spec.ts:54,204`
- `z-python-e2e.spec.ts:80,91`

`waitForLoadState("networkidle")` → `waitForLoadState("load")` への置換が一部のファイルに対してのみ適用された可能性がある。または修正後に新規テストが追加され、そこで `"networkidle"` が使われている可能性がある。

### カテゴリ B: kernel disconnected（9 件）

`disconnected-kernel-cross-spec-contamination.md` が `✅ 修正済み` とされているが、以下のスペックで再発:
- `data.spec.ts:94`
- `integration.spec.ts:51,131,154,177`
- `sandbox.spec.ts:78`
- `setup.spec.ts:247,281`
- `z-python-e2e.spec.ts:136`

特に `sandbox.spec.ts:78` と `setup.spec.ts:247,281` は前回ベースラインで通過していたスペック（10/10 pass）からの退行であり、修正の副作用か新規テスト追加の影響が疑われる。

### カテゴリ C: 状態汚染（3 件）

`state-contamination-auto-instantiate-skill-leak.md` が `✅ 修正済み` とされているが、以下で再発:
- `integration.spec.ts:118` (Expected 0, Received 2)
- `persistence.spec.ts:58` (Expected "unlocked", Received "completed")
- `persistence.spec.ts:69` (Expected 0, Received 2)

### カテゴリ D: ガード機能テスト失敗（3 件）

`guard-validation-warning-not-visible.md` が `✅ 修正済み` とされているが、全 3 テストが引き続き失敗:
- `guard-validation.spec.ts:50,82,126`

### カテゴリ E: UI 現金表示（1 件）

`ui.spec.ts:176`: Cash が 50,000 ちょうどで `Expected > 50000` が失敗（詳細は `ui-cash-milestone-boundary-test-failure.md` 参照）。

## 良好な点

- **backcast-integration.spec.ts 全 6 件 PASS**: BRIDGE_001 カウント修正・Position 表示修正・SANDBOX_005 dedup が全て正常動作を確認
- **sandbox.spec.ts 単体実行は 10/10 PASS**: フルラン時の干渉が原因であり、sandbox 機能自体は正常

## 根本問題の仮説

修正がコミットされたが、以下の可能性がある:

1. **修正が部分的に適用された**: 全対象ファイルへの変更が漏れていた
2. **新規テストが修正ルール（知見35a 等）に違反して追加された**: 新たに追加された `guard-validation.spec.ts` が `"networkidle"` を使用している可能性
3. **修正の効果がフルラン環境でのみ消える**: 単体実行では通過するがフルランでは状態汚染が完全に解消されていない
4. **`game_test.py` のセル蓄積が再発**: `global-teardown.ts` の復元が機能していないか、teardown が実行されていない

## 調査手順

1. `guard-validation.spec.ts` を単体実行して networkidle が使われているか確認する
2. `persistence.spec.ts` を単体実行して状態汚染なしに通過するか確認する
3. `game_test.py` のセル数をフルラン前後で比較する
4. `global-teardown.ts` が正常に実行されているか確認する（ログ確認）

## 関連 Issue

- `networkidle-timeout-websocket-persistent.md` — 修正済みとされているが再発
- `disconnected-kernel-cross-spec-contamination.md` — 修正済みとされているが再発
- `state-contamination-auto-instantiate-skill-leak.md` — 修正済みとされているが再発
- `guard-validation-warning-not-visible.md` — 修正済みとされているが再発
- `ui-cash-milestone-boundary-test-failure.md` — 新規 Issue
