# Fix: スキル完了のフィードバックが無い / 進捗ゼロのまま

## Context

UXレポート Issue #1: セッション再接続後、スキルツリーが 0/59 のまま表示される致命的バグ。
`bt.chart("7203")` で `emit_skill("SANDBOX_001")` が発火しても、フロントエンドに反映されない。

### 根本原因

`emit_skill()` は `mo.output.append()` で `<marimo-broadcast>` タグを送信する。
初回実行時は `handleCellNotificationeration()` が cell-op の `data.output` からタグを抽出し BroadcastChannel に送信する。

**再接続時の問題**: BroadcastChannel はリアルタイムのみ（fire-and-forget）。
SessionView の再生時に `extractAndSendBroadcastMessages()` → `sendBroadcastMessage()` が呼ばれるが、
React コンポーネント（`useProgressSync`, `setupSkillEventListener`）のマウント前に送信されたメッセージは消失する。

## 変更内容（フロントエンド 3ファイルのみ）

### 1. `broadcastChannel.ts` — ラストバリューキャッシュ追加

**ファイル**: `frontend/src/utils/broadcastChannel.ts`

`BroadcastChannelManager` に channel+type をキーとした最新値キャッシュを追加:

```typescript
// channel → Map<type, message>
private lastMessages = new Map<string, Map<string, { type: string; data: unknown }>>();
```

- `sendBroadcastMessage()` 呼出時、BroadcastChannel 送信に加えてキャッシュにも保存
- `consumeLastMessage(channelName, type)` で最新メッセージを取得し **自動クリア**（取得と同時に削除）
- `replayBufferedMessages(channelName, handler)` ヘルパーで、指定チャネルの全キャッシュメッセージをハンドラに渡して消費

**設計判断**:
- `progress_init` は全進捗状態を含むため最新1件あれば十分 → 汎用バッファ不要
- `skill_complete` も `completeSkillWithRewardAtom` が冪等なので最新値で十分
- `consumeLastMessage` で自動クリアするため、ライフサイクル管理が不要

### 2. `useProgressSync.ts` — マウント時にキャッシュを再生

**ファイル**: `frontend/src/hooks/useProgressSync.ts`

`useEffect` 内で BroadcastChannel リスナー設定後、`replayBufferedMessages("progress_channel", handler)` で
キャッシュ済みの `progress_init` メッセージを処理。`__testSuppressProgressSync` フラグも考慮。

### 3. `skill-complete-handler.ts` — マウント時にキャッシュを再生

**ファイル**: `frontend/src/components/skill-tree/skill-complete-handler.ts`

`setupSkillEventListener()` 内で BroadcastChannel リスナー設定後、`replayBufferedMessages("skill_event_channel", handler)` で
キャッシュ済みの `skill_complete` メッセージを処理。`suppressBroadcast` フラグも考慮。

### テスト

- `frontend/src/utils/__tests__/broadcastChannel.test.ts` — キャッシュとヘルパーのユニットテスト

## 全体フロー（修正後）

```
[再接続時]
1. カーネルが SessionView.notifications を再生
2. Cell の cell-op が到着 (output に <marimo-broadcast> タグ含む)
3. handleCellNotificationeration() → extractAndSendBroadcastMessages()
4. sendBroadcastMessage() → BroadcastChannel に送信 + キャッシュに保存  ← NEW
5. (React マウント中のためリスナーは未接続 → BroadcastChannel メッセージは消失)
6. useProgressSync マウント → replayBufferedMessages() でキャッシュから再生  ← NEW
7. setupSkillEventListener マウント → replayBufferedMessages() でキャッシュから再生  ← NEW
8. playerProgressAtom が更新 → スキルツリー UI に反映
```

## 修正ファイル一覧

| ファイル | 変更内容 | 状態 |
|---------|---------|------|
| `frontend/src/utils/broadcastChannel.ts` | ラストバリューキャッシュ + `replayBufferedMessages` ヘルパー | ✅ |
| `frontend/src/hooks/useProgressSync.ts` | マウント時にキャッシュ再生 | ✅ |
| `frontend/src/components/skill-tree/skill-complete-handler.ts` | マウント時にキャッシュ再生 | ✅ |
| `frontend/src/utils/__tests__/broadcastChannel.test.ts` | 新規テスト（13件全てパス） | ✅ |

## ✅ 実装完了（2026-02-20）

### テスト結果

```bash
# ユニットテスト - 全てパス
✓ src/utils/__tests__/broadcastChannel.test.ts (13 tests) 19ms
  Test Files  1 passed (1)
  Tests  13 passed (13)
```

### 実装の詳細

#### 1. ✅ `broadcastChannel.ts` - キャッシュ機構の追加

**変更内容**:
- `CachedMessage` インターフェース追加（`{ type: string; data: unknown }`）
- `BroadcastChannelManager.lastMessages` - `Map<channelName, Map<type, message>>` の2段階Map
- `cacheMessage(channelName, type, data)` - 送信時に自動キャッシュ
- `consumeMessages(channelName)` - 全タイプのメッセージを配列で返し、自動クリア
- `replayBufferedMessages(channelName, handler)` - ヘルパー関数で共通化

**設計判断**:
- 汎用バッファ（MAX_SIZE=200）ではなく、channel+type をキーとした**最新値キャッシュ**を採用
  - `progress_init` は全進捗を含むため、最新1件のみで十分
  - `skill_complete` も `completeSkillWithRewardAtom` が冪等（`progress.completedSkills.includes(sid)` で早期リターン）
- `consumeMessages()` で自動クリア → 明示的なライフサイクル管理不要
- `closeAll()` でチャネルとキャッシュを同時クリア

#### 2. ✅ `useProgressSync.ts` - 進捗同期のリプレイ対応

**変更内容**:
- `channel.onmessage` を `handleMessage` 関数として定義
- `replayBufferedMessages(PROGRESS_CHANNEL, handleMessage)` でキャッシュ再生
- `__testSuppressProgressSync` フラグは `handleMessage` 内で統一してチェック

**動作**:
1. リスナー登録（ライブメッセージ受信用）
2. キャッシュ再生（マウント前の見逃しメッセージ）
3. 両方とも同じ `handleMessage` を使用 → フラグ・パース処理の統一

#### 3. ✅ `skill-complete-handler.ts` - スキルイベントのリプレイ対応

**変更内容**:
- `handleMessage` を既存コードから抽出（変更なし）
- `replayBufferedMessages("skill_event_channel", handleMessage)` でキャッシュ再生
- `suppressBroadcast` フラグは `handleMessage` 内で統一してチェック

**動作**:
1. リスナー登録（ライブメッセージ受信用）
2. キャッシュ再生（マウント前の見逃しメッセージ）
3. 両方とも同じ `handleMessage` を使用 → フラグ・エラーハンドリングの統一

#### 4. ✅ `broadcastChannel.test.ts` - 新規テストスイート

**カバレッジ**:
- キャッシュの保存・取得・自動クリア（3件）
- 同一チャネル+タイプでの上書き動作（1件）
- 異なるタイプでの並存（1件）
- `closeAll()` での全クリア（1件）
- `replayBufferedMessages()` の再生・消費（4件）
- エラーハンドリング（base64/JSON不正）（3件）

## 検証方法

1. ✅ **ユニットテスト**: `cd frontend && pnpm test src/utils/__tests__/broadcastChannel.test.ts`
2. **E2E テスト**: `/game-e2e` スキルで sandbox.spec.ts を実行（未実施）
3. **手動検証**: marimo edit でノートブック起動 → `bt.chart("7203")` 実行 → スキルツリーで SANDBOX_001 完了確認 → ブラウザタブ閉じて再接続 → スキルツリーが 0/59 でないことを確認（未実施）

---

## 設計背景と知見

### なぜラストバリューキャッシュを採用したか

**検討した選択肢**:

1. **汎用バッファ（MAX_SIZE=200）** - 全メッセージを保持
2. **ラストバリューキャッシュ** - channel+type ごとに最新1件のみ保持 ← **採用**

**採用理由**:
- `progress_init` は**累積状態を含む**（`completed_skills: ["SANDBOX_001", "SANDBOX_002", ...]`）
  - 最新1件で全スキル進捗が復元可能
  - 中間状態は不要
- `skill_complete` も**冪等**（`completeSkillWithRewardAtom` が `includes(sid)` でチェック）
  - 重複発火しても安全
  - 全イベントを保持する必要なし
- メモリ効率が高い（最大でもチャネル数 × タイプ数 = 数十件程度）

### 自動クリアの設計判断

`consumeMessages()` が**取得と同時にクリア**する理由:

- リスナーマウント時に1回だけ再生すればよい
- 2回目以降の `replayBufferedMessages()` 呼出は空振りでOK
- 明示的な `clearBuffer()` 不要 → API がシンプル
- テストコードでも「消費後は空」を検証（冪等性の保証）

### テストフラグとの互換性

既存のテスト用フラグ（`suppressBroadcast`, `__testSuppressProgressSync`）は、`handleMessage` 内で統一してチェックされるため、**ライブメッセージとキャッシュ再生の両方に適用**される。

これにより、`resetGameProgress()` 後に BroadcastChannel 経由の遅延メッセージを抑制する既存のロジックが、キャッシュ再生にも適用される。

### タイミング問題の根本解決

**Before**:
```
WebSocket → extractAndSendBroadcastMessages → BroadcastChannel.postMessage
                                                        ↓
                                                  (消失: リスナー未マウント)
```

**After**:
```
WebSocket → extractAndSendBroadcastMessages → BroadcastChannel.postMessage + cacheMessage
                                                        ↓                            ↓
                                                  (消失でもOK)                    キャッシュ保持
                                                                                      ↓
                                                                              リスナーマウント
                                                                                      ↓
                                                                              replayBufferedMessages
```

### 副作用と影響範囲

**変更は完全に追加のみ**:
- 既存の BroadcastChannel 送信ロジックは無変更
- `sendBroadcastMessage()` の戻り値も維持
- キャッシュ機構はオプトイン（`replayBufferedMessages()` を呼ばなければ影響なし）

**影響を受けるコンポーネント**:
- `useProgressSync` - 進捗初期化
- `setupSkillEventListener` - スキルイベントハンドラ

この2つだけが `replayBufferedMessages()` を呼ぶため、他のコンポーネントへの影響ゼロ。

---

## Tips for Future Developers

### キャッシュのライフサイクル

- **保存**: `sendBroadcastMessage()` 呼出時に自動
- **取得**: `replayBufferedMessages()` で全タイプを一括取得
- **クリア**: `consumeMessages()` 呼出時に自動（明示的な削除不要）
- **リセット**: `closeAll()` で全チャネルとキャッシュをクリア

### 新しいチャネルを追加する場合

1. `sendBroadcastMessage(channelName, type, payload)` を呼ぶ箇所を追加
2. リスナー側で `replayBufferedMessages(channelName, handler)` を呼ぶ
3. 自動的にキャッシュが機能する（追加コード不要）

### デバッグ時の確認ポイント

- Chrome DevTools Console で `broadcastChannelManager.consumeMessages("progress_channel")` を実行
  - 現在のキャッシュ内容を確認可能
  - 2回目の呼出は空配列（消費済み）
- `replayBufferedMessages()` の呼出タイミングを `console.log` で確認
  - `useEffect` のマウント順序が重要

### E2E テストへの影響

既存の E2E テスト（sandbox.spec.ts）は、`__testCompleteSkill` で直接 atom を更新するため、BroadcastChannel をバイパスしている。キャッシュ機構の追加は既存テストに影響しない。

新規テストを追加する場合は、`__testInjectBroadcastHTML()` を使って実際の HTML パイプラインをテスト可能。
