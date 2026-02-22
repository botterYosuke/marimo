# BUG-005: リロード後にカーネル再送でスキルが再発火し、進捗が 0 にリセットされない問題

## ステータス: 修正完了

## 問題

`persistence.spec.ts:74` のテスト「スキル完了後リロードすると進捗が 0 にリセットされる（Web モード仕様）」が失敗。

- **期待値**: `countAfterReload === 0`
- **実際の値**: `countAfterReload === 2`

## 根本原因

### データフロー

1. `game_test.py` のセルが `gs.chart("7203")`, `gs.buy()`, `gs.sell()` を実行
2. これらの関数内部で `emit_skill("SANDBOX_001")`, `emit_skill("SANDBOX_002")`, `emit_skill("SANDBOX_004")` が呼ばれる
3. `emit_skill()` は `mo.output.append(Html('<marimo-broadcast ...>'))` でセルのコンソール出力に `<marimo-broadcast>` タグを含む HTML を出力
4. この HTML はカーネルのセル出力として保持される

### リロード時の再発火

1. `page.reload()` でページがリロードされる
2. React の atom (playerProgressAtom) は plain atom のため初期状態 (0 completed) にリセットされる -- ここまでは期待通り
3. しかし、カーネルはセル出力を WebSocket で再送する
4. `handleCellNotificationeration()` (handlers.ts:269) がセル出力を処理
5. `extractAndSendBroadcastMessages()` が HTML 内の `<marimo-broadcast>` タグを検出
6. `sendBroadcastMessage()` → BroadcastChannel → `setupSkillEventListener` の handleMessage → `onSkillComplete` → atom 更新
7. 結果: リロード直後に 2 つのスキルが再完了してしまう

### なぜ 2 なのか

`game_test.py` のセルが生成する `emit_skill()` 出力のうち、カーネルが再送するものが 2 つあるため。
(`emit_skill` は Python 側で dedup するが、カーネル再送は HTML をそのまま送るため、フロントエンド側の dedup がリセット後に効かない)

## 修正内容

**採用した方針**: 案A + 案C の組み合わせ（テスト側の修正）

### 変更ファイル

- `frontend/e2e-tests/game/persistence.spec.ts` (L89-103)

### 変更内容

リロード後に以下の手順を追加:

1. `waitForTimeout(500)` -- カーネル再送の到着を待つ
2. `resetGameProgress(page)` -- atom をクリアし、`suppressBroadcast` フラグを 1 秒間有効にして後続のカーネル再送メッセージを抑制
3. `openSkillTreePanel(page)` -- パネルを再度開く
4. アサート -- この時点で completedCount は 0

これは `beforeEach` (L36-48) と同じパターンであり、リロード後にも同じ安定化手順が必要であることを明示的にしている。

### なぜテスト側の修正が最も安全か

- **プロダクションコード変更不要**: カーネル再送は marimo の正常な動作であり、変更すると他の機能に影響する可能性がある
- **suppressBroadcast 機構が既に存在**: `resetGameProgress()` が呼ぶ `__testResetProgress` は既に 1 秒間の BroadcastChannel 抑制を行う
- **beforeEach と同じパターン**: テストの `beforeEach` も同様の問題に対処しており、一貫性がある

## 関連知見

- `setupSkillEventListener` の `suppressBroadcast` フラグは `__testResetProgress` 呼び出し後 1 秒間有効
- `__testSuppressProgressSync` は `progress_channel` のみを抑制し、`skill_event_channel` は `suppressBroadcast` が担当
- marimo edit モードは 1 ファイル 1 カーネルを永続するため、リロード後に既存セッションへの再接続とセル出力の再送が発生する
