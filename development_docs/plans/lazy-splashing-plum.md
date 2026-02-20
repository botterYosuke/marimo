# Fix: スキル完了のフィードバックが無い / 進捗ゼロのまま

## Context

UXレポート Issue #1: セッション再接続後、スキルツリーが 0/59 のまま表示される致命的バグ。
`bt.chart("7203")` で `emit_skill("SANDBOX_001")` が発火しても、フロントエンドに反映されない。

### 根本原因

`emit_skill()` は `mo.output.append()` で `<marimo-broadcast>` タグを送信する。
初回実行時は `handleCellNotificationeration()` が cell-op の `data.output` からタグを抽出し BroadcastChannel に送信する。

**再接続時の問題**:
1. SessionView はセルの最終出力のみ保持。`mo.output.append()` の中間出力は、セルの戻り値で上書きされるケースがある
2. Cell 2 (`bt.chart("7203")` + `return`) は戻り値なしなのでブロードキャストHTMLが最終出力に残る ✓
3. **しかし** BroadcastChannel はリアルタイムのみ。Reactコンポーネント(`useProgressSync`, `setupSkillEventListener`)のマウント前に送信されたメッセージは消失する

つまり根本原因は **BroadcastChannel のタイミングレース**。セルの再生時にメッセージを送信するが、リスナーがまだマウントされていない。

## 変更内容

### 1. `broadcastChannel.ts` — メッセージバッファリング追加

**ファイル**: `frontend/src/utils/broadcastChannel.ts`

`BroadcastChannelManager` にメッセージバッファを追加:
- `sendBroadcastMessage()` 呼出時、BroadcastChannel への送信に加えてバッファにも保存
- `getBufferedMessages(channelName)` でバッファ済みメッセージを取得可能に
- `clearBuffer(channelName)` でバッファをクリア
- `MAX_BUFFER_SIZE = 200` でバッファの無限成長を防止

### 2. `useProgressSync.ts` — マウント時にバッファを再生

**ファイル**: `frontend/src/hooks/useProgressSync.ts`

`useEffect` 内でBroadcastChannelリスナー設定後、`getBufferedMessages("progress_channel")` で
バッファ済みの `progress_init` メッセージを処理。`__testSuppressProgressSync` フラグも考慮。

### 3. `skill-complete-handler.ts` — マウント時にバッファを再生

**ファイル**: `frontend/src/components/skill-tree/skill-complete-handler.ts`

`setupSkillEventListener()` 内でBroadcastChannelリスナー設定後、`getBufferedMessages("skill_event_channel")` で
バッファ済みの `skill_complete` メッセージを処理。`suppressBroadcast` フラグも考慮。

### 4. `skill_events.py` — `emit_skill()` 後に全進捗をブロードキャスト

**ファイル**: `src-tauri/sample-notebooks/skill_events.py`

`emit_skill()` の末尾で `broadcast_progress()` を呼出。
これにより、スキル完了時にそのセルの出力に最新の全進捗データ（`progress_init`）が含まれる。

Cell 2 (`bt.chart("7203")` + `return`) は戻り値を持たないため、
`mo.output.append()` の蓄積出力がそのまま最終出力として保持される。
→ 再接続時に Cell 2 の出力から `progress_init` + `skill_complete` が抽出される。

### 5. テスト追加

- `frontend/src/utils/__tests__/broadcastChannel.test.ts` — バッファリングのユニットテスト
- `frontend/src/core/kernel/__tests__/extractBroadcast.test.ts` — 既存テストに追加ケース不要（パース自体は変更なし）

## 全体フロー（修正後）

```
[再接続時]
1. カーネルが SessionView.notifications を再生
2. Cell 2 の cell-op が到着 (output に <marimo-broadcast> タグ含む)
3. handleCellNotificationeration() → extractAndSendBroadcastMessages()
4. sendBroadcastMessage() → BroadcastChannel に送信 + バッファに保存  ← NEW
5. (React マウント中のためリスナーは未接続 → BroadcastChannel メッセージは消失)
6. useProgressSync マウント → バッファから progress_init を再生  ← NEW
7. setupSkillEventListener マウント → バッファから skill_complete を再生  ← NEW
8. playerProgressAtom が更新 → スキルツリー UI に反映
```

## 修正ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `frontend/src/utils/broadcastChannel.ts` | メッセージバッファ追加 |
| `frontend/src/hooks/useProgressSync.ts` | バッファ再生追加 |
| `frontend/src/components/skill-tree/skill-complete-handler.ts` | バッファ再生追加 |
| `src-tauri/sample-notebooks/skill_events.py` | `emit_skill()` 末尾に `broadcast_progress()` 追加 |
| `frontend/src/utils/__tests__/broadcastChannel.test.ts` | 新規テスト |

## 検証方法

1. **ユニットテスト**: `cd frontend && pnpm test src/utils/__tests__/broadcastChannel.test.ts`
2. **E2E テスト**: `cd frontend && npx playwright test e2e-tests/game/sandbox.spec.ts`
3. **手動検証**: marimo edit でノートブック起動 → `bt.chart("7203")` 実行 → スキルツリーで SANDBOX_001 が完了していることを確認 → ブラウザタブを閉じて再接続 → スキルツリーが 0/59 でないことを確認
