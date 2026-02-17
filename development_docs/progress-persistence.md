# 進捗保存リファクタリング: LocalStorage → ファイルベース

**ステータス**: 完了

## Context

スキルツリー進捗がブラウザ localStorage に保存されている現状の問題:
1. `.py` ファイルを削除・再作成しても進捗がリセットされない
2. ブラウザを変えると進捗が消える
3. Python 側の `_triggered_skills`（メモリ上 set）と localStorage が非同期

**目標**: Python 側を Single Source of Truth にし、ノートブックディレクトリにサイドカー JSON で永続化する。

---

## 設計判断

### 1. `deriveRank()` は存在しない
`atoms.ts:21` で `rank` は固定値 `"bronze"`。ランク昇格は未実装。
→ `"bronze"` 固定で OK。ファイルに保存も復元もしない。

### 2. ノートブックファイル名からプログレスファイルを導出
`get_context().filename` からファイル名を導出: `backcast.py` → `.backcast.progress.json`

### 3. マイグレーション不要
後方互換は考慮しない。`atomWithStorage` → 通常 `atom` に単純置換。

### 4. 起動時ブロードキャストのタイミング
`mo.output.append(Html('<marimo-broadcast ...>'))` パターンを使用（`skill_events.py:47` と同じ）。セル出力として永続化されるため、ページリロード時も `handlers.ts` で再処理される。

### 5. `_triggered_skills` の初期化
`skill_events.py` のモジュールレベルで `load_progress()` から直接初期化。`sync_triggered_skills()` 呼び出しが不要になる。

### 6. 状態導出の集約
`deriveProgressFromSkills(completedSkills)` 関数を新設し、`calculateTotalRewards()` を内部で呼んで全状態を導出。

---

## ファイル形式: `.{stem}.progress.json`

ノートブック名から導出: `backcast.py` → `.backcast.progress.json`

```json
{
  "version": 1,
  "completed_skills": ["SANDBOX_001", "SANDBOX_002"]
}
```

`currentCash` / `earnedTitles` / `sandboxCompleted` 等は保存しない。`completed_skills` から `calculateTotalRewards()` で常に導出。

---

## 実装内容

### Step 1: `progress_manager.py` 新規作成

**ファイル**: `frontend/public/files/progress_manager.py`

| 関数 | 役割 |
|------|------|
| `_get_progress_path()` | `get_context().filename` から stem を取得し `mo.notebook_dir() / f".{stem}.progress.json"` を返す |
| `load_progress()` | JSON 読み込み。不在/壊れ → デフォルト値 |
| `save_progress(completed_skills)` | JSON 書き込み |
| `add_completed_skill(skill_id)` | リストに追加 → 保存 |
| `broadcast_progress()` | `mo.output.append(Html('<marimo-broadcast channel="progress_channel" ...>'))` |

### Step 2: `skill_events.py` 修正

`_triggered_skills` の初期化を `load_progress()` から行う（モジュールレベル）。`emit_skill()` 内で `add_completed_skill(skill_id)` を呼ぶ。

### Step 3: `game_setup.py` 修正

モジュール初期化時に `broadcast_progress()` を1行追加。
**順序の注意**: `publish_state_headless` は `mo.output.replace()` でセル出力をセットし、`broadcast_progress` は `mo.output.append()` で追記する。逆にすると `replace` で progress の broadcast が消える。

### Step 4: `atoms.ts` 修正

- `atomWithStorage` → 通常 `atom`（localStorage 全廃）
- `deriveProgressFromSkills()` 関数を新設
- `initProgressFromFileAtom` を追加

### Step 5: `useProgressSync.ts` 新規作成

`BroadcastChannel("progress_channel")` をリッスンし、`initProgressFromFileAtom` を呼ぶ。

### Step 6: `Controls.tsx` 修正

`useProgressSync()` を追加（既存の `useBroadcastChannelRelay()` と並べて配置）。

### Step 7: テストファイル修正

| ファイル | 変更内容 |
|---------|---------|
| `__tests__/atoms.test.ts` | L435-525 の localStorage 永続化テスト（P1-3）を削除。L23-37 の Storage モック削除 |
| `__tests__/cumulative-cash-hud.test.ts` | Storage モック削除 |
| `__tests__/all-59-skills-prerequisites.test.ts` | Storage モック削除 |
| `__tests__/reward-backtest-sync.test.ts` | Storage モック削除 |

---

## データフロー

### 起動 / ページリロード時
```
game_setup.py import
  → broadcast_progress()
    → mo.output.append(Html('<marimo-broadcast channel="progress_channel" ...>'))
      → handlers.ts: extractAndSendBroadcastMessages()
        → BroadcastChannel("progress_channel").postMessage(...)
          → useProgressSync → initProgressFromFileAtom(completedSkills)
            → deriveProgressFromSkills() → playerProgressAtom 復元
```

### スキル達成時
```
game_setup.buy() → emit_skill("SANDBOX_002")
  ├→ add_completed_skill("SANDBOX_002")
  │    → .backcast_progress.json に保存
  └→ skill_event_channel にブロードキャスト（既存）
       → completeSkillWithRewardAtom → playerProgressAtom 更新 + トースト
```

---

## 変更ファイル一覧

| ファイル | 種別 | 変更量 |
|---------|------|-------|
| `frontend/public/files/progress_manager.py` | 新規 | ~70行 |
| `frontend/public/files/skill_events.py` | 修正 | ~5行変更 |
| `frontend/public/files/game_setup.py` | 修正 | 2行追加 |
| `frontend/src/components/skill-tree/atoms.ts` | 修正 | ~30行変更 |
| `frontend/src/hooks/useProgressSync.ts` | 新規 | ~25行 |
| `frontend/src/components/editor/controls/Controls.tsx` | 修正 | 2行追加 |
| `frontend/src/components/skill-tree/__tests__/atoms.test.ts` | 修正 | ~91行削除 |
| `frontend/src/components/skill-tree/__tests__/cumulative-cash-hud.test.ts` | 修正 | モック削除 |
| `frontend/src/components/skill-tree/__tests__/all-59-skills-prerequisites.test.ts` | 修正 | モック削除 |
| `frontend/src/components/skill-tree/__tests__/reward-backtest-sync.test.ts` | 修正 | モック削除 |
