# Issue: 再接続時のスキルイベント消失 — ページリロード後に進捗が 0/59 のまま

**作成日**: 2026-02-21
**重要度**: High
**カテゴリ**: 接続・安定性 / スキル発火
**ステータス**: ✅ 修正済み

---

## 概要

marimo サーバーに既存セッションとして再接続した際（ページリロードやブラウザを開き直した時）、Python カーネルが auto_instantiate でセルを再実行して `emit_skill()` を発火するが、フロントエンドのスキルリスナーが初期化されておらず BroadcastChannel イベントを受け取れない。その結果、スキル進捗がフロントエンドに反映されず 0/59 のまま表示される。

## 再現手順

1. marimo サーバーを起動し、`backcast.py` を開いてゲームをプレイする（SANDBOX_001〜006 を取得）
2. ブラウザを閉じる、またはページをリロードする
3. 再度 `backcast.py` を開く（Reconnected バナーが表示される）
4. marimo の auto_instantiate が全セルを自動実行し、`emit_skill()` がコンソールに `[SkillHandler] Received skill event: SANDBOX_001` 等を出力する
5. スキルツリーを開くと 0/59 のまま（前回プレイの進捗が反映されない）

## 期待される動作

再接続後にスキルツリーを開くと、前回プレイで取得済みのスキルが正しく表示される。

## 実際の動作

- コンソールログ: `[SkillHandler] Received skill event: SANDBOX_001` （受信は確認される）
- スキルツリー: 0/59 スキル（進捗未反映）
- ステータスバー: `Progress: 0.0%`

## スクリーンショット

`game-play-initial-state.png` — 再接続後の状態（0/59 表示）

## 関連ファイル

| ファイル | 関連箇所 |
|---------|---------|
| `frontend/src/components/skill-tree/skill-complete-handler.ts` | `setupSkillEventListener()` — BroadcastChannel リスナーの初期化 |
| `src-tauri/sample-notebooks/skill_events.py` | `emit_skill()` — BroadcastChannel HTML を生成・送信 |
| `frontend/src/components/skill-tree/atoms.ts` | `playerProgressAtom` — スキル進捗を保持する Jotai atom（非永続化） |
| `development_docs/game/game-e2e-review-system.md` | 知見 37 — この問題の初出記録 |

## 調査メモ

### 根本原因

BroadcastChannel はリアルタイム配信のみを行い、過去のイベントを再生しない。

```
[ページリロード]
  ↓
[フロントエンド]
  React コンポーネントのマウント開始
  setupSkillEventListener() の初期化中（BroadcastChannel未接続）
  ↓
[Python カーネル（auto_instantiate）]
  バックテストセルが自動実行される（カーネルは既に動いている）
  emit_skill("SANDBOX_001") → <marimo-broadcast> HTML を WebSocket 経由で送信
  extractAndSendBroadcastMessages() → BroadcastChannel.postMessage()
  ↓
  BroadcastChannel.postMessage() 時点でリスナーがまだ未接続
  → イベントは誰も受け取らずに消える
  ↓
[フロントエンド（初期化完了後）]
  setupSkillEventListener() が BroadcastChannel を listen 開始
  しかし過去のイベントは再生されない
  → playerProgressAtom は 0/59 のまま
```

### Python 側の `_triggered_skills` との関係

`skill_events.py` の `_triggered_skills` は `load_progress()` から初期化されるため、`.backcast.progress.json` が存在する場合は正しい完了スキルを保持している。しかし、フロントエンド側はメモリ内の `playerProgressAtom`（非永続化）が空のまま。

つまり:
- Python 側: `_triggered_skills = {"SANDBOX_001", "SANDBOX_002", ..., "SANDBOX_006"}`（正しい）
- フロントエンド側: `playerProgressAtom.completedSkills = []`（空）

この不整合が問題の本質。

### E2E テストで検出されない理由

E2E テストは `window.__testCompleteSkill` テストフック（Jotai atom の直接操作）または `page.goto()` 後のクリーンな接続から開始するため、再接続シナリオを通らない。

### 改善方向性

#### 案1: フロントエンド初期化時に Python 側の進捗を取得する（推奨）

フロントエンド初期化完了後に Python カーネルの `get_triggered_skills()` 結果を RPC で取得し、`playerProgressAtom` を同期する。

```typescript
// skill-complete-handler.ts 改善案
async function syncProgressFromPython(): Promise<void> {
  // Python カーネルにスキル進捗を問い合わせる RPC を実行
  const completedSkills = await callPythonRPC("get_triggered_skills");
  // playerProgressAtom を更新
  store.set(playerProgressAtom, { completedSkills });
}
```

ただし marimo の RPC 機構の実装が必要。

#### 案2: `progress_channel` を使って Python 側から進捗を再送する

`progress_manager.py` の `broadcast_progress()` を、フロントエンドの初期化完了イベントをトリガーに呼び出す。フロントエンドが準備完了した後に Python から進捗を再送することで、BroadcastChannel の受け取り損ないを回避する。

#### 案3: `playerProgressAtom` を永続化する（localStorage）

`atomWithStorage`（jotai/utils）を使って `playerProgressAtom` を localStorage に永続化する。ページリロード後も進捗が保持される。

ただし Python 側の `_triggered_skills` との整合性維持が課題となる（フロントエンド側が最新でない場合に古い進捗が表示される可能性）。

#### 案4: ゲーム再開時に明示的に「進捗を読み込む」ボタンを表示する

再接続後に「前回の進捗を読み込む」ボタンを HUD またはバナーで表示し、クリック時に Python 側から進捗を再同期する。UX 的な対症療法。

### 現在の回避策

プレイヤーが `bt.chart("7203")` など SANDBOX_001 のトリガーとなるセルを再実行することで、スキルが再発火する（ただし `_triggered_skills` dedup により SANDBOX_001 は再発火しない — `emit_skill()` の dedup が阻止する）。

実際には `_triggered_skills` dedup により再発火できないため、有効な回避策が存在しない。根本的な修正が必要。

### 影響範囲

- **全プレイヤー**: ページリロード / ブラウザ再起動のたびに発生
- **開発時**: `pnpm dev` のホットリロードでも発生する可能性がある
- **ゲームプレイの連続性**: 前回の進捗が失われたように見え、プレイヤーのモチベーションを損なう

### 関連する既知問題

- `bug-260221-cell-accumulation-in-notebook.md` — セル蓄積によりノートブック起動時の auto_instantiate で意図しないスキル発火が発生し、この問題と複合する
- `bridge001-python-dedup-blocks-e2e-test.md` — auto_instantiate による `_triggered_skills` 汚染が E2E テストを失敗させる（同一の根本原因）

## 修正内容

**修正日**: 以前のコミットで修正済み（2026-02-21 確認）

`skill-complete-handler.ts` の `setupSkillEventListener()` 内で `replayBufferedMessages("skill_event_channel", handleMessage)` が呼ばれており、リスナー登録前に届いたメッセージをバッファから再生する仕組みが実装済み。本 Issue は修正済みと判定。
