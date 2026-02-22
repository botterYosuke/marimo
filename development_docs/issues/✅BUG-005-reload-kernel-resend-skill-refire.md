# BUG-005: リロード後にカーネル再送でスキルが再発火し進捗がリセットされない

**優先度**: High
**発見元**: play-log-2026-02-21.md
**テスト**: frontend/e2e-tests/game/persistence.spec.ts:74
**ステータス**: ✅ 修正済み

## 再現手順
1. `npx playwright test e2e-tests/game/persistence.spec.ts --headed` を実行する
2. テスト "スキル完了後リロードすると進捗が 0 にリセットされる（Web モード仕様）" を確認する
3. テスト手順:
   a. `emitSkillSequence` で SANDBOX_001, SANDBOX_002, SANDBOX_003 を完了させる
   b. `getCompletedCount` で 3 以上であることを確認する
   c. `page.reload()` でページをリロードする
   d. `ensureConnected` で再接続を確認する
   e. `openSkillTreePanel` でスキルツリーパネルを開く
   f. `getCompletedCount` で 0 であることを確認する

## 期待動作
- Web モード（Tauri なし）ではスキル進捗は plain atom で保持されるため、リロード後に進捗が **0** にリセットされる
- `countAfterReload` が `0` を返す

## 実際の動作
- `Expected 0 but received 2`
- リロード後の完了スキル数が 0 ではなく **2** になっている
- リロード時にカーネルがセル出力を再送し、セル出力内のスキルイベントが再度処理されてスキルが再発火している

## 原因推定

### 仮説 1: カーネルのセル出力再送
marimo のカーネルはページリロード時に既存のセル出力を WebSocket 経由で再送する。セル出力内にスキル完了のマーカー（`<marimo-broadcast>` タグ等）が含まれている場合、フロントエンドがこれを新規イベントとして処理し、スキルが再発火する。

プレイログに「知見35b と関連」と記載されており、この現象は既知の挙動である可能性が高い。

### 仮説 2: BroadcastChannel メッセージの残留
BroadcastChannel にバッファされたメッセージが、リロード後の新しいリスナーに配信される。ただし BroadcastChannel は通常バッファリングしないため、この可能性は低い。

### 仮説 3: テスト前のスキル発火の汚染
`beforeEach` の `resetGameProgress` がリロード後に完全にリセットできておらず、前テストの状態が残っている。ただしエラーメッセージが「received 2」であり、テストで発火させた 3 つのうち 2 つが再発火している点から、カーネル再送による部分的な再発火が最も有力。

## 根本的な問題
Web モード（plain atom）ではリロード時に atom がリセットされるが、カーネルからのセル出力再送がリロード直後に発生し、出力内のスキルイベントマーカーが再処理される。対策として以下が必要:

1. **リロード後のセル出力再送時にスキルイベントを無視する**: 再送されたセル出力には「再送フラグ」を付与し、スキルイベントの処理をスキップする
2. **セル出力内のスキルイベントマーカーにタイムスタンプを持たせ、既に処理済みのイベントをフィルタリングする**
3. **リロード直後に一定時間のデバウンス期間を設け、セル出力由来のスキルイベントを無視する**

## 影響範囲
- persistence.spec.ts のリロードテスト（1件）
- ゲームプレイ中にページをリロードした場合、進捗が正しくリセットされず中途半端な状態になる
- Web モード（ブラウザ版）の進捗管理の信頼性に影響

## 関連 Issue
- `progress-json-reset-incomplete.md` (修正済み) — 進捗 JSON ファイルのリセットに関する Issue。本 Issue はファイルベースの進捗ではなく、Web モードの plain atom + カーネル再送の問題であり別物

## 関連ファイル
| ファイル | 関連箇所 |
|---------|---------|
| `frontend/e2e-tests/game/persistence.spec.ts` | L74-98 — 失敗テスト |
| `frontend/e2e-tests/game/helpers.ts` | `emitSkillSequence`, `getCompletedCount` |
| フロントエンドのスキルイベントリスナー | セル出力からのイベント処理（再送時の重複処理） |
| marimo カーネル | WebSocket 経由のセル出力再送ロジック |
