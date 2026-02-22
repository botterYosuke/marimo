# BUG-001: SANDBOX_006 完了後 BRIDGE_001 が unlocked にならない問題

## ステータス: 修正完了

## 問題

`bridge.spec.ts:81` のテスト「SANDBOX_006 完了後、BRIDGE_001 が unlocked になる」で、
`emitSkillSequence` で SANDBOX_001-006 を連続発火した後、BRIDGE_001 が `locked` のまま
`unlocked` に遷移しない。

## 根本原因

### progress_channel による playerProgressAtom の上書き

`useProgressSync.ts` が `progress_channel` BroadcastChannel を監視しており、
Python バックエンドの `broadcast_progress()` (auto_instantiate 経由) が送信する
`progress_init` メッセージを受け取ると、`initProgressFromFileAtom` 経由で
`playerProgressAtom` を **完全に上書き** する。

テストでは `__testCompleteSkill` を使ってフロントエンド側のみでスキルを完了させるが、
Python バックエンドはそれらの完了を知らない。そのため:

1. テストが `emitSkillSequence` で SANDBOX_001-006 をフロントエンドで完了
2. auto_instantiate の `broadcast_progress()` が遅延して progress_channel 経由で到着
3. `useProgressSync` がメッセージを受信し、Python バックエンドの状態（空または部分的）で `playerProgressAtom` を上書き
4. SANDBOX_006 の完了情報が消え、BRIDGE_001 が `locked` に戻る

### backcast-integration.spec.ts で成功する理由

`backcast-integration.spec.ts` は `beforeEach` で `resetGameProgress()` を呼び出しており、
この関数が `__testSuppressProgressSync = true` フラグを設定する。
このフラグが `useProgressSync` の `handleMessage` で参照され、
`progress_channel` のメッセージが無視される（知見 39）。

### bridge.spec.ts で失敗する理由

`bridge.spec.ts` は `resetGameProgress()` を `afterEach` でのみ呼び出し、
`beforeEach` では呼び出していなかった。そのため:

- 初回テスト実行時: `__testSuppressProgressSync` が未設定（フラグなし）
- 2回目以降: 前テストの `afterEach` で設定されるが、次テストの `beforeEach` で
  `page.goto()` により新しいページが読み込まれ、フラグがリセットされる

いずれの場合も、`progress_channel` のメッセージが処理されてしまう。

## 修正内容

`bridge.spec.ts` の `beforeEach` に以下を追加:

```typescript
// auto_instantiate イベントを受け取ってからリセット
await page.waitForTimeout(2000);
await resetGameProgress(page);

// リセット後の安定化
await page.waitForTimeout(500);
```

これにより:
1. `page.waitForTimeout(2000)`: auto_instantiate の broadcast イベントが到着するのを待つ
2. `resetGameProgress()`: playerProgressAtom をリセットし、`__testSuppressProgressSync = true` を設定
3. `page.waitForTimeout(500)`: 残留イベントの処理を待つ

この順序は `backcast-integration.spec.ts` の `beforeEach` と同じパターン。

## 修正ファイル

- `frontend/e2e-tests/game/bridge.spec.ts` (beforeEach に wait + resetGameProgress を追加)

## 関連知見

- 知見 38: emitSkillSequence（300ms間隔）ではなく各スキルを emit 後に waitForSkillStatus で確認する方式
- 知見 39: `__testSuppressProgressSync` フラグで auto_instantiate の broadcast_progress() を抑制
- 知見 41: while ループで新着トーストも含めて完全に除去する

## 影響範囲

bridge.spec.ts 内の全テストに影響。特に `emitSkillSequence` 後に状態を検証するテストが安定する:
- 「SANDBOX_006 完了後、BRIDGE_001 が unlocked になる」(L94)
- 「BRIDGE_001 完了で BRIDGE_002 が unlocked になる」(L125)
- 「BRIDGE_001 完了後に現金が増える」(L133)
- 「BRIDGE_002 完了で BRIDGE_003 が unlocked になる」(L162)
- 「BRIDGE_003 完了でブリッジトラック全完了」(L177)
- 「BRIDGE_003 完了後の現金は全スキル報酬の合計以上」(L194)
