# BUG-001: SANDBOX_006 完了後 BRIDGE_001 が unlocked にならない（レースコンディション）

**優先度**: High
**発見元**: play-log-2026-02-21.md
**テスト**: frontend/e2e-tests/game/bridge.spec.ts:81
**ステータス**: ✅ 修正済み

## 再現手順
1. `npx playwright test e2e-tests/game/bridge.spec.ts --headed` を実行する
2. テスト "SANDBOX_006 完了後、BRIDGE_001 が unlocked になる" を確認する
3. `emitSkillSequence` で SANDBOX_001〜006 を連続発火する
4. SANDBOX_006 の完了を `waitForSkillStatus` で確認後、BRIDGE_001 のステータスを検証する

## 期待動作
- SANDBOX_001〜006 が全て完了した後、BRIDGE_001 のステータスが `"unlocked"` に変わる
- `waitForSkillStatus(page, "BRIDGE_001", "unlocked", SKILL_STATUS_TIMEOUT)` が成功する

## 実際の動作
- SANDBOX_006 の完了は確認されるが、BRIDGE_001 のステータスが `"locked"` のまま
- エラー: `Expected "completed" but received "locked"`（プレイログの記載。テストコード上は `"unlocked"` を期待）

## 原因推定
SANDBOX_001〜006 の連続発火（`emitSkillSequence`）において、各スキルの完了イベントが高速に連続処理される。SANDBOX_006 の完了が atom に反映された後、BRIDGE_001 の前提条件チェック（全 SANDBOX 完了）が再評価されるまでにタイムラグがある可能性:

1. **前提条件の再評価タイミング**: SANDBOX_006 の完了イベントで atom が更新されるが、BRIDGE_001 の前提条件チェーンの再評価が非同期で遅延している
2. **atom 更新のバッチ処理**: React の状態更新がバッチされ、SANDBOX_006 完了と BRIDGE_001 の unlock が同一レンダリングサイクルで処理されない
3. **`waitForSkillStatus` のポーリング間隔**: SKILL_STATUS_TIMEOUT 内に BRIDGE_001 が unlock されるタイミングを逃している

なお、`backcast-integration.spec.ts` では同じ SANDBOX→BRIDGE チェーンが正常に動作しているため、テスト間の状態やイベント発火順序の違いが影響している可能性がある。

## 影響範囲
- bridge.spec.ts の SANDBOX→BRIDGE 前提条件チェーンテスト（1件）
- integration.spec.ts の HTML 経由全スキル完了→ブリッジ解放テストにも同様のリスクあり
- ゲームプレイにおけるトラック解放の信頼性に影響

## 関連ファイル
| ファイル | 関連箇所 |
|---------|---------|
| `frontend/e2e-tests/game/bridge.spec.ts` | L81-89 — 失敗テスト |
| `frontend/e2e-tests/game/helpers.ts` | `emitSkillSequence` — スキル連続発火 |
| `frontend/e2e-tests/game/helpers.ts` | `waitForSkillStatus` — ステータス待機 |
| フロントエンドのスキルツリー atom | 前提条件チェーン再評価ロジック |
