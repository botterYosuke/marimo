# Issue: BRIDGE_001 スキルがフロントエンドでカウントされない

**作成日**: 2026-02-20
**重要度**: High
**カテゴリ**: Game / Skill System
**ステータス**: Open

---

## 📝 概要

BRIDGE_001（「データの正体」）スキルがPythonバックエンドで正常に発火しているにもかかわらず、フロントエンドのスキルツリーでカウントされない。

**現象**: `bt.reveal_data()` を実行すると、ブラウザコンソールで `[SkillHandler] Received skill event: BRIDGE_001` が確認されるが、スキルツリーパネルのカウントが増えず、BRIDGE_001ノードが「未完了」（青点線）のまま。

---

## 🔍 再現手順

1. marimoで backcast.py を開く
2. SANDBOX_001〜006 を完了する
3. `bt.reveal_data()` を実行
4. ブラウザコンソールを確認 → `[SkillHandler] Received skill event: BRIDGE_001` が表示される
5. スキルツリーパネルを開く
6. **期待**: 9/59 スキル、BRIDGE_001が緑色（完了）
7. **実際**: 8/59 スキル、BRIDGE_001が青点線（未完了）

---

## 🐛 原因（推測）

### 仮説1: スキル定義に BRIDGE_001 が存在しない

`frontend/src/components/skill-tree/skill-data.ts` で BRIDGE_001 が定義されていない可能性。

**検証方法**:
```bash
grep -r "BRIDGE_001" frontend/src/components/skill-tree/skill-data.ts
```

### 仮説2: フロントエンドの条件付きスキル処理

`skill-complete-handler.ts` または `atoms.ts` で、BRIDGE_001 に対する特別な条件（prerequisites、track制限など）があり、スキル完了がブロックされている可能性。

**検証ポイント**:
- `completeSkillWithRewardAtom` 内で BRIDGE_001 が特別扱いされていないか
- BRIDGE_001 の prerequisites が満たされているか
- track が "bridge" のスキルに対する制限があるか

### 仮説3: タイミング問題（auto_instantiate の影響）

レポートの知見によると:
> ブラウザが完全に初期化される前に発火するスキルイベントは、フロントエンドで受信されない可能性

BRIDGE_001 が auto_instantiate によって早期に発火した場合、`setupSkillEventListener()` が登録される前にイベントが送信され、受信されなかった可能性。

**検証方法**:
1. auto_instantiate を無効化してテスト
2. `bt.reveal_data()` を手動で実行して BRIDGE_001 が正しくカウントされるか確認

### 仮説4: スキルIDの typo

Python側とフロントエンド側でスキルIDの表記が異なる可能性（例: `BRIDGE_001` vs `BRIDGE_01`）。

**検証方法**:
```bash
grep -r "BRIDGE_001" frontend/src/components/skill-tree/
grep -r "BRIDGE_001" src-tauri/sample-notebooks/
```

---

## 📊 影響範囲

- **ゲーム進行**: BRIDGE_001 が取れないと、ユーザーは9スキル中8スキルしか獲得できない
- **スキルツリー表示**: 不正確なカウント（8/59）が表示される
- **報酬**: BRIDGE_001 の報酬が付与されない
- **ユーザー体験**: 正しく実行したのにスキルが取れないため、混乱・不満が生じる

**重要度 High の理由**: ゲーム進行に直接影響し、ユーザー体験を著しく損なう

---

## 💡 修正提案

### ステップ1: 原因の特定

以下の順序で調査:

1. **スキル定義の確認**:
   ```bash
   cd frontend/src/components/skill-tree
   grep -n "BRIDGE_001" skill-data.ts
   ```

2. **コンソールログの詳細確認**:
   ブラウザのデベロッパーツールで以下を確認:
   ```javascript
   // playerProgressAtomの状態を確認
   console.log(jotaiStore.get(playerProgressAtom).completedSkills);

   // BRIDGE_001が含まれているか確認
   console.log(jotaiStore.get(playerProgressAtom).completedSkills.includes('BRIDGE_001'));
   ```

3. **BroadcastChannelのイベントをトレース**:
   ```typescript
   // skill-complete-handler.ts に追加
   bc.onmessage = (event) => {
     console.log('[BroadcastChannel] Raw event:', event);
     const decoded = JSON.parse(atob(event.data.payload));
     console.log('[BroadcastChannel] Decoded:', decoded);
     // ...
   };
   ```

### ステップ2: 修正案

**仮説1が正しい場合（スキル定義が存在しない）**:
```typescript
// skill-data.ts に追加
{
  id: "BRIDGE_001",
  title: "データの正体",
  description: "バックテストで使用しているデータの詳細を確認する",
  category: "bridge",
  track: "bridge",
  prerequisites: ["SANDBOX_006"],
  difficulty: 2,
  reward: [
    { type: "cash", value: 500, description: "データ調査報酬" },
  ],
  status: "locked",
}
```

**仮説2が正しい場合（条件付き処理の問題）**:
```typescript
// atoms.ts の completeSkillWithRewardAtom を確認
// BRIDGE_001 に対する特別な条件を削除
```

**仮説3が正しい場合（タイミング問題）**:
```python
# game_setup.py の reveal_data() を修正
def reveal_data():
    # ... データ表示処理 ...

    # イベント送信を遅延させる
    import time
    time.sleep(0.5)  # フロントエンドの初期化を待つ
    emit_skill("BRIDGE_001")

    return bt._data
```

または、フロントエンド側でイベントをバッファリング:
```typescript
// skill-complete-handler.ts に追加
const eventBuffer: SkillEvent[] = [];
let isReady = false;

export function setupSkillEventListener() {
  // 初期化完了後にバッファされたイベントを処理
  setTimeout(() => {
    isReady = true;
    eventBuffer.forEach(event => completeSkillWithReward(event));
    eventBuffer.length = 0;
  }, 1000);

  bc.onmessage = (event) => {
    if (!isReady) {
      eventBuffer.push(event);
    } else {
      completeSkillWithReward(event);
    }
  };
}
```

---

## 🎯 推奨アクション

**優先度1: 原因の特定（ステップ1）**

まず、スキル定義の確認から開始:
```bash
cd /d/Documents/marimo/frontend/src/components/skill-tree
grep -A 10 "BRIDGE_001" skill-data.ts
```

存在しない場合は、スキル定義を追加。
存在する場合は、ステップ1の他の調査を実施。

**優先度2: 緊急対応（ワークアラウンド）**

修正までの間、ドキュメントに以下を追記:
> ⚠️ 既知の問題: BRIDGE_001 スキルは現在正しくカウントされません。`bt.reveal_data()` を実行すると機能は正常に動作しますが、スキルカウントには反映されません。

---

## 📎 関連ファイル

- [`skill-data.ts`](../../frontend/src/components/skill-tree/skill-data.ts) - スキル定義
- [`skill-complete-handler.ts`](../../frontend/src/components/skill-tree/skill-complete-handler.ts) - イベントハンドラ
- [`atoms.ts`](../../frontend/src/components/skill-tree/atoms.ts) - Jotai atoms
- [`game_setup.py`](../../src-tauri/sample-notebooks/game_setup.py) - `reveal_data()` 関数
- [`skill_events.py`](../../src-tauri/sample-notebooks/skill_events.py) - `emit_skill()` 関数
- [ゲームプレイレポート](../../.claude/plans/my-game-play-report.md) - バグ発見元

---

## 📝 補足情報

### コンソールログ（実際）

```
[SkillHandler] Received skill event: BRIDGE_001
{
  skill_id: "BRIDGE_001",
  context: {},
  timestamp: 1708425600000
}
```

このログが表示されているということは、以下が確認できている:
1. ✅ Python側で `emit_skill("BRIDGE_001")` が呼ばれた
2. ✅ HTML が生成され、WebSocket経由でフロントエンドに送信された
3. ✅ `extractAndSendBroadcastMessages()` でHTMLがパースされた
4. ✅ BroadcastChannel でイベントが送信された
5. ✅ `setupSkillEventListener()` でイベントが受信された
6. ❌ `completeSkillWithRewardAtom` で進捗更新が失敗した

**つまり、問題は `completeSkillWithRewardAtom` より後の処理にある。**

### 次の調査ステップ

`completeSkillWithRewardAtom` 内部にデバッグログを追加:

```typescript
// atoms.ts
export const completeSkillWithRewardAtom = atom(
  null,
  (get, set, skillId: SkillId) => {
    console.log(`[completeSkillWithRewardAtom] Attempting to complete: ${skillId}`);

    const progress = get(playerProgressAtom);
    console.log(`[completeSkillWithRewardAtom] Current progress:`, progress);

    if (progress.completedSkills.includes(skillId)) {
      console.log(`[completeSkillWithRewardAtom] Already completed: ${skillId}`);
      return;
    }

    const skill = get(skillDefinitionsAtom).find(s => s.id === skillId);
    if (!skill) {
      console.error(`[completeSkillWithRewardAtom] Skill not found: ${skillId}`);
      return;
    }

    console.log(`[completeSkillWithRewardAtom] Completing skill:`, skill);
    // ... 進捗更新
  }
);
```
