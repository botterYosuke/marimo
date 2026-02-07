# 進捗保存リファクタリング: LocalStorage → ファイルベース（レビュー済み）

元プラン `steady-pondering-whistle.md` のレビュー結果と修正版実装計画。

## Context

スキルツリー進捗がブラウザ localStorage に保存されている現状の問題:
1. `.py` ファイルを削除・再作成しても進捗がリセットされない
2. ブラウザを変えると進捗が消える
3. Python 側の `_triggered_skills`（メモリ上 set）と localStorage が非同期

**目標**: Python 側を Single Source of Truth にし、ノートブックディレクトリにサイドカー JSON で永続化する。

---

## 元プランからの修正点

### 1. `deriveRank()` は存在しない
`atoms.ts:21` で `rank` は固定値 `"bronze"`。ランク昇格は未実装。
→ **`"bronze"` 固定で OK。ファイルに保存も復元もしない。**

### 2. ノートブックファイル名からプログレスファイルを導出
元プランの `RuntimeContext.filename` は非公開 API だが、`mo.notebook_dir()` 自体が内部で `get_context().filename` を使っている（`runtime.py:403`）ため、同じリスクレベル。固定名だと同ディレクトリ複数ノートブック時に進捗が共有されてしまう。
→ **`get_context().filename` からファイル名を導出**: `backcast.py` → `.backcast.progress.json`

### 3. マイグレーションロジック不要
ユーザー指示:「後方互換は考えなくていい」。
→ **localStorage マイグレーション完全除去。`atomWithStorage` → 通常 `atom` に単純置換。**

### 4. 起動時ブロードキャストのタイミング
→ **`mo.output.append(Html('<marimo-broadcast ...>'))` パターンを使用**（`skill_events.py:47` と同じ）。セル出力として永続化されるため、ページリロード時も `handlers.ts` で再処理される。

### 5. `_triggered_skills` の初期化を簡素化
元プランは `game_setup.py` で `sync_triggered_skills()` を呼んでいた。
→ **`skill_events.py` のモジュールレベルで `load_progress()` から直接初期化。** `sync_triggered_skills()` 呼び出しが不要になる。

### 6. `initProgressFromFileAtom` の手動構築を集約
`sandboxCompleted`, `bridgeCompleted`, `currentCash`, `earnedTitles` を手動構築するのは脆弱。
→ **`deriveProgressFromSkills(completedSkills)` 関数を新設**し、`calculateTotalRewards()` を内部で呼んで全状態を導出。

### 7. backtest_state の保存は Phase 2 に分離
初回リリース（Phase 1）ではスキル進捗のファイル化に集中。
**Phase 2** で Equity/Cash のスナップショットを `.{stem}.progress.json` の `backtest_state` フィールドに保存し、HUD のフォールバック表示（ノートブック再起動時に前回セッションの Equity/Cash を表示）を実装する。ノートブック再起動時にバックテスト自体は `cash=100_000` でリセットされる点は変わらない。

---

## 実装計画

### ファイル形式: `.{stem}.progress.json`

ノートブック名から導出: `backcast.py` → `.backcast.progress.json`

```json
{
  "version": 1,
  "completed_skills": ["SANDBOX_001", "SANDBOX_002"]
}
```

`currentCash` / `earnedTitles` / `sandboxCompleted` 等は保存しない。`completed_skills` から `calculateTotalRewards()` で常に導出。

---

### Step 1: `progress_manager.py` 新規作成

**ファイル**: `frontend/public/files/progress_manager.py`

| 関数 | 役割 |
|------|------|
| `_get_progress_path()` | `get_context().filename` から stem を取得し `mo.notebook_dir() / f".{stem}.progress.json"` を返す |
| `load_progress()` | JSON 読み込み。不在/壊れ → デフォルト値 |
| `save_progress(completed_skills)` | JSON 書き込み |
| `add_completed_skill(skill_id)` | リストに追加 → 保存 |
| `broadcast_progress()` | `mo.output.append(Html('<marimo-broadcast channel="progress_channel" ...>'))` |

ブロードキャストは `headless_broadcast.py:42-50` と同じ `<marimo-broadcast>` パターン。

**`_get_progress_path()` の実装詳細**:
```python
from marimo._runtime.context import get_context, ContextNotInitializedError

def _get_progress_path() -> Path | None:
    nb_dir = mo.notebook_dir()
    if nb_dir is None:
        return None
    try:
        ctx = get_context()
        filename = ctx.filename  # "backcast.py"
    except (ContextNotInitializedError, AttributeError):
        return None
    if not filename:
        return None
    stem = Path(filename).stem  # "backcast"
    return nb_dir / f".{stem}.progress.json"
```

---

### Step 2: `skill_events.py` 修正

**ファイル**: `frontend/public/files/skill_events.py`

変更内容:
1. `_triggered_skills` の初期化を `load_progress()` から行う（モジュールレベル）
2. `emit_skill()` 内で `add_completed_skill(skill_id)` を呼ぶ

```python
from progress_manager import load_progress, add_completed_skill

# ★変更: ファイルから初期化（sync_triggered_skills 呼び出し不要に）
_triggered_skills: set[str] = set(load_progress().get("completed_skills", []))

def emit_skill(skill_id, context=None):
    if skill_id in _triggered_skills:
        return
    _triggered_skills.add(skill_id)
    add_completed_skill(skill_id)  # ★追加: ファイル保存
    # ... 既存の skill_event_channel ブロードキャスト ...
    _check_graduations()
```

`sync_triggered_skills()` は残すが、`game_setup.py` からの呼び出しは削除。

---

### Step 3: `game_setup.py` 修正

**ファイル**: `frontend/public/files/game_setup.py`

変更: モジュール初期化時に `broadcast_progress()` を1行追加。

```python
from progress_manager import broadcast_progress

# 既存
enable_headless_trade_events(bt)
publish_state_headless(bt, status_label="準備完了", status_variant="secondary")  # mo.output.replace()
broadcast_progress()  # ★追加: mo.output.append() — replace の後に append する順序が重要
```

**順序の注意**: `publish_state_headless` は `mo.output.replace()` でセル出力をセットし、`broadcast_progress` は `mo.output.append()` で追記する。逆にすると `replace` で progress の broadcast が消える。

`step()` / `buy()` / `sell()` への `save_backtest_state` 追加は Phase 2。

---

### Step 4: `atoms.ts` 修正

**ファイル**: `frontend/src/components/skill-tree/atoms.ts`

変更:
1. `atomWithStorage` → 通常 `atom`（localStorage 全廃）
2. `deriveProgressFromSkills()` 関数を新設
3. `initProgressFromFileAtom` を追加

```typescript
// 削除: atomWithStorage, adaptForLocalStorage のインポート
// 追加:
import { calculateTotalRewards } from "./rewards/reward-system";

function deriveProgressFromSkills(completedSkills: SkillId[]): PlayerProgress {
  const rewards = calculateTotalRewards(completedSkills);
  return {
    completedSkills,
    currentCash: rewards.totalCash,
    earnedTitles: rewards.titles,
    earnedBadges: [],
    rank: "bronze",
    stats: { totalReturn: 0, sharpeRatio: 0, maxDrawdown: 0, totalTrades: 0, winRate: 0 },
    sandboxCompleted: completedSkills.includes("SANDBOX_006"),
    bridgeCompleted: completedSkills.includes("BRIDGE_003"),
    hiddenBadgesFound: [],
  };
}

// ★変更: atomWithStorage → atom
export const playerProgressAtom = atom<PlayerProgress>(deriveProgressFromSkills([]));

// ★新規: ファイルから初期化
export const initProgressFromFileAtom = atom(
  null,
  (_get, set, completedSkills: SkillId[]) => {
    set(playerProgressAtom, deriveProgressFromSkills(completedSkills));
  }
);
```

既存の `completeSkillAtom` / `completeSkillWithRewardAtom` は変更不要（`playerProgressAtom` を読み書きするだけ）。

---

### Step 5: `useProgressSync.ts` 新規作成

**ファイル**: `frontend/src/hooks/useProgressSync.ts`

`BroadcastChannel("progress_channel")` をリッスンし、`initProgressFromFileAtom` を呼ぶ。

```typescript
export function useProgressSync(): void {
  const initProgress = useSetAtom(initProgressFromFileAtom);
  useEffect(() => {
    const channel = new BroadcastChannel("progress_channel");
    channel.onmessage = (event) => {
      if (event.data?.type === "progress_init") {
        initProgress(event.data.data.completed_skills ?? []);
      }
    };
    return () => channel.close();
  }, [initProgress]);
}
```

---

### Step 6: `Controls.tsx` 修正

**ファイル**: `frontend/src/components/editor/controls/Controls.tsx`

変更: `useProgressSync()` を追加（既存の `useBroadcastChannelRelay()` と並べて配置）。
`Controls.tsx` はアプリ全体のライフサイクルを管理するコンポーネントで、`useBroadcastChannelRelay()` も同じ場所に置かれている。進捗初期化はスキルツリー UI ではなくアプリレベルの責務。

```typescript
import { useProgressSync } from "@/hooks/useProgressSync";

// Controls コンポーネント内:
useBroadcastChannelRelay();  // 既存（L62）
useProgressSync();           // ★追加
```

### Step 7: テストファイル修正

以下のテストファイルから localStorage モック/テストを修正:

| ファイル | 変更内容 |
|---------|---------|
| `__tests__/atoms.test.ts` | **重大**: L435-525 の localStorage 永続化テスト（P1-3）を削除。L23-37 の Storage モック削除 |
| `__tests__/cumulative-cash-hud.test.ts` | L23-31 の Storage モック削除（テストロジックは変更不要） |
| `__tests__/all-59-skills-prerequisites.test.ts` | L23-32 の Storage モック削除 |
| `__tests__/reward-backtest-sync.test.ts` | L31-39 の Storage モック削除 |

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

両チャネルが `playerProgressAtom` を更新するが、`completeSkillWithRewardAtom` の重複チェック（`includes(skillId)`）で吸収される。

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

---

## 検証

1. ノートブック起動 → `gs.chart("7203")` → `gs.buy()` → `.backcast_progress.json` に `SANDBOX_001`, `SANDBOX_002` が記録される
2. ページリロード → スキルツリーで SANDBOX_001/002 が completed 表示
3. `.backcast_progress.json` を削除 → リロード → 進捗リセット確認
4. localStorage に `backcast:player-progress:v1` が存在しないことを確認
5. `pnpm test src/components/skill-tree/` で既存テスト PASS
6. `mo.notebook_dir()` が `None`（未保存ノートブック）→ エラーなく動作（ファイル保存スキップ）
