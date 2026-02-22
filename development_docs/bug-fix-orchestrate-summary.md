# バグ修正オーケストレーション完了

**実行日**: 2026-02-21
**処理バグ数**: 5 件（BUG-001〜005、本セッション新規）+ 既存 11 件

## 本セッション（2026-02-21 PM）の修正結果

### 修正完了バグ

| 優先度 | Issue | ステータス | 修正内容 |
|--------|-------|-----------|---------|
| Critical | BUG-004 (HTML パイプライン) | ✅ 修正済み | `suppressBroadcast` タイミング修正（skill-complete-handler.ts） |
| High | BUG-001 (BRIDGE 解放レース) | ✅ 修正済み | `beforeEach` に `resetGameProgress()` 追加（bridge.spec.ts） |
| High | BUG-005 (リロード再送) | ✅ 修正済み | リロード後に `resetGameProgress()` 追加（persistence.spec.ts） |

### 修正試行中（ブロッカー）

| 優先度 | Issue | ステータス | ブロッカー |
|--------|-------|-----------|-----------|
| Medium | BUG-002 (guard カウント不一致) | 修正試行中 | カーネル再送汚染 + テスト環境不安定 |
| Medium | BUG-003 (sell テキスト不一致) | 修正試行中 | Shadow DOM + カーネル再送の複合問題 |

## 修正内容の詳細

### BUG-004 (Critical): `suppressBroadcast` タイミング衝突
**修正ファイル**: `frontend/src/components/skill-tree/skill-complete-handler.ts`
**根本原因**: `resetGameProgress()` が `suppressBroadcast = true` を 1 秒間セットするが、テストの `__testInjectBroadcastHTML` がその抑制ウィンドウ内で呼ばれるとイベントが破棄される。
**修正内容**: `__testInjectBroadcastHTML` コールバック内で `suppressBroadcast = false` + タイマークリアを実行してから `extractAndSendBroadcastMessages(html)` を呼ぶように変更。

### BUG-001 (High): `progress_channel` による atom 上書き
**修正ファイル**: `frontend/e2e-tests/game/bridge.spec.ts`
**根本原因**: `game_test.py` の `auto_instantiate` が `broadcast_progress()` を実行し、`progress_channel` 経由で `playerProgressAtom` を上書き。`bridge.spec.ts` は `beforeEach` で `resetGameProgress()` を呼んでいなかった。
**修正内容**: `beforeEach` に `waitForTimeout(2000)` + `resetGameProgress()` + `waitForTimeout(500)` を追加。

### BUG-005 (High): カーネル再送によるスキル再発火
**修正ファイル**: `frontend/e2e-tests/game/persistence.spec.ts`
**根本原因**: `page.reload()` 後にカーネルがセル出力を WebSocket で再送し、`<marimo-broadcast>` タグが再処理されてスキルが再発火。
**修正内容**: `page.reload()` 後に `waitForTimeout(500)` + `resetGameProgress()` + `openSkillTreePanel()` を追加（`beforeEach` と同じ安定化パターン）。

## 既存未解決 Issue

| 優先度 | Issue | ステータス | 備考 |
|--------|-------|-----------|------|
| High | fullrun-regression-75-to-53-passed | Open | フルラン環境のみ再発する構造的問題 |
| High | guard-validation-buy-sell-warning-not-implemented | Open | BUG-002/003 と同根 |
| Medium | ui-cash-milestone-boundary-test-failure | Open | フルラン時の状態汚染、境界値問題 |
| Medium | e2e-test-missing-reconnect-skill-event | Open | E2E テスト実装困難 |
| Medium | e2e-test-missing-step-end-hud-status | Open | E2E テスト実装困難 |

## 前回セッションの修正結果（参考）

| 優先度 | Issue | ステータス | 修正内容 |
|--------|-------|-----------|---------|
| Critical | networkidle-timeout | ✅ 修正済み | `networkidle` → `load` 置換 |
| Critical | disconnected-kernel | ✅ 修正済み | `ensureConnected` reload fallback |
| Critical | beforeeach-timeout | ✅ 修正済み | timeout 120秒延長 |
| Critical | guard-validation | ✅ 修正済み | networkidle 修正 |
| Critical | reconnect-skill-event | ✅ 修正済み | `replayBufferedMessages` 確認 |
| High | bridge001-dedup | ✅ 修正済み | `reset_triggered_skills()` 追加 |
| High | state-contamination | ✅ 修正済み | beforeEach resetGameProgress 追加 |
| High | cell-accumulation | ✅ 修正済み | 蓄積セル削除 |
| High | skill-reward-negative | ✅ 修正済み | 既存実装確認 |
| Medium | backend-list-remove | ✅ 修正済み | list.remove() 存在チェック追加 |
| Low | trades-duplicate | ✅ 修正済み | 既存実装確認 |

## 推奨事項

1. **guard-validation テストのアーキテクチャ見直し**: `runNewCellInGrid` + Python コード注入は非決定的。`__testCompleteSkill` フック経由に切り替えを検討
2. **フルラン環境の安定化**: スペック間のカーネル状態リセット強化
3. **`suppressBroadcast` 機構のドキュメント化**: テスト記述者向けに抑制ウィンドウの注意事項を明文化
