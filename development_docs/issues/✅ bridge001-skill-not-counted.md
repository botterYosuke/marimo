# Issue: BRIDGE_001 スキルがフロントエンドでカウントされない

**作成日**: 2026-02-20
**重要度**: High
**カテゴリ**: Game / Skill System
**ステータス**: ✅ Resolved (2026-02-20)

---

## 📝 概要

BRIDGE_001（「データの正体」）スキルがPythonバックエンドで正常に発火しているにもかかわらず、フロントエンドのスキルツリーでカウントされない。

**現象**: `bt.reveal_data()` を実行すると、ブラウザコンソールで `[SkillHandler] Received skill event: BRIDGE_001` が確認されるが、スキルツリーパネルのカウントが増えず、BRIDGE_001ノードが「未完了」（青点線）のまま。

---

## ✅ 修正完了

### 根本原因（2つの問題が複合）

調査の結果、仮説1〜4はいずれも不正解で、**2つの独立した問題の複合**が原因だった。

#### 原因 A: `chart()` が `get_stock_daily()` を呼び BRIDGE_002 が早期発火

`game_setup.py` の `chart()` 関数が `get_stock_daily()` を呼んでいたため、チャート表示時に BRIDGE_002（「自分でデータを取得」）が発火。BRIDGE_002 の発火により `_check_graduations()` が BRIDGE_003（ブリッジ卒業）も連鎖的に発火。これらが Python 側の `_triggered_skills` セットに「消費」され、ユーザーが正規手順で到達したとき再発火しなかった。

```
chart("7203")
  → get_stock_daily("7203")   # ← BRIDGE_002 発火（本来はユーザーが明示的に呼ぶべき）
    → _check_graduations()     # ← BRIDGE_003 も連鎖発火
  → emit_skill("SANDBOX_001") # ← これは正しい
```

#### 原因 B: `completeSkillWithRewardAtom` が prerequisites 未達のスキルを無言で破棄

フロントエンドの `completeSkillWithRewardAtom`（atoms.ts）は、prerequisites が未達のスキルを `return` で無言で破棄していた。BRIDGE_001 の prerequisite は `["SANDBOX_006"]` であるため、SANDBOX_006 完了前に BRIDGE_001 イベントが届くと永久に失われた。

```typescript
// 修正前: prerequisites 未達 → 無言で破棄（再試行なし）
if (!prereqsMet) {
  return;  // ← ここで BRIDGE_001 が消える
}
```

### 修正内容

#### ✅ Fix A: `chart()` で `_get_stock_daily` を直接使用

```python
# game_setup.py — 修正後
def chart(code: str, **kwargs):
    # _get_stock_daily を直接使用（get_stock_daily は BRIDGE_002 を発火するため）
    df = _get_stock_daily(code)
    set_data({code: df})
    emit_skill("SANDBOX_001")
    return backtest_chart(bt, code=code, **kwargs)
```

**設計判断**: `get_stock_daily()` は「ユーザーが自分でデータ取得関数を使う」スキル（BRIDGE_002）のトリガーなので、内部ヘルパーの `chart()` からは呼ばない。プライベート関数 `_get_stock_daily`（BackcastPro のインポート）を直接使用する。

#### ✅ Fix B: `pendingSkillsAtom` による保留キュー機構

```typescript
// atoms.ts — 修正後（概要）
const pendingSkillsAtom = atom<SkillId[]>([]);

export const completeSkillWithRewardAtom = atom(null, (get, set, skillId) => {
  const doComplete = (sid) => {
    // prerequisites チェック → 未達なら false を返す（破棄しない）
    if (!prereqsMet) return false;
    // ... 報酬計算・進捗更新・トースト表示 ...
    return true;
  };

  const completed = doComplete(skillId);
  if (!completed) {
    // prerequisites 未達 → 保留キューに追加（重複防止つき）
    const pending = get(pendingSkillsAtom);
    if (!pending.includes(skillId)) {
      set(pendingSkillsAtom, [...pending, skillId]);
    }
    return;
  }

  // 完了後、保留キューから解除可能なスキルをドレイン処理
  let changed = true;
  while (changed) {
    changed = false;
    const pending = get(pendingSkillsAtom);
    const remaining = [];
    for (const pid of pending) {
      if (doComplete(pid)) { changed = true; }
      else { remaining.push(pid); }
    }
    set(pendingSkillsAtom, remaining);
  }
});
```

---

## 🧠 設計思想と背景

### なぜ Python 側と Frontend 側の両方を修正したか

- **Python 側のみ修正**した場合: `chart()` の BRIDGE_002 早期発火は防げるが、他の経路で prerequisites 未達のスキルイベントが届いた場合に同じ問題が再発する
- **Frontend 側のみ修正**した場合: 保留キューで対処できるが、Python 側の `_triggered_skills` セットでスキルが「消費済み」になっている問題は残る
- **両方修正**することで、根本原因（Python 側の早期発火）と構造的弱点（Frontend 側の無言破棄）の両方を解消

### 保留キューの設計

- **while ループでドレイン**: スキル A の完了が保留中スキル B を解除し、B の完了がさらに C を解除する...という連鎖を1回の呼び出しで処理
- **`resetProgressAtom` でキューもクリア**: リセット時に保留キューが残っていると、次のセッションで意図しないスキル完了が発生する

### e2e テストで発見した追加問題

修正後の sandbox.spec.ts で 9/10 テストが通過したが、「初期状態: SANDBOX_001 は unlocked」テストが断続的に失敗。原因は `resetGameProgress()` 後にカーネルが再送する BroadcastChannel メッセージが SANDBOX_001 を再完了するタイミングレースだった。

**解決**: `skill-complete-handler.ts` にリセット後 1 秒間の BroadcastChannel イベント抑制機構を追加（知見 36）。テスト専用の `__testCompleteSkill` は抑制対象外。

---

## 💡 Tips

### 調査時のチェックリスト

1. **`_triggered_skills` の状態確認**: Python 側で `get_triggered_skills()` を呼び、すでに発火済みのスキルを確認。意図しないスキルが含まれていないか注意
2. **prerequisites チェーン**: `skill-data.ts` で該当スキルの prerequisites を確認。上流スキルが正しく完了しているか
3. **`chart()` 経由の副作用**: `chart()` は内部で `_get_stock_daily` を呼ぶが、`get_stock_daily` を呼んではいけない（BRIDGE_002 発火防止）
4. **保留キューの動作確認**: ブラウザコンソールで以下を確認:
   ```javascript
   // Jotai store が直接公開されていないため、__testCompleteSkill で手動テスト
   window.__testCompleteSkill("BRIDGE_001"); // prerequisites 未達なら保留キューに入る
   ```

### 関連する既知の制約

- Python 側 `emit_skill()` の `_triggered_skills` はプロセス単位のグローバル。カーネル再起動しない限りリセットされない
- Frontend 側 `pendingSkillsAtom` はメモリ内のみ。ページリロードで消失する（永続化は不要 — リロード時にカーネルがセル出力を再送するため）

---

## 📎 関連ファイル

| ファイル | 変更内容 | ステータス |
|---|---|---|
| [`game_setup.py`](../../src-tauri/sample-notebooks/game_setup.py) | `chart()` で `_get_stock_daily` を直接使用 | ✅ 修正済み |
| [`atoms.ts`](../../frontend/src/components/skill-tree/atoms.ts) | `pendingSkillsAtom` + ドレイン機構追加 | ✅ 修正済み |
| [`skill-complete-handler.ts`](../../frontend/src/components/skill-tree/skill-complete-handler.ts) | リセット後の BroadcastChannel 抑制追加 | ✅ 修正済み |
| [`skill-data.ts`](../../frontend/src/components/skill-tree/skill-data.ts) | BRIDGE_001 定義（変更なし — 正常） | - |
| [`skill_events.py`](../../src-tauri/sample-notebooks/skill_events.py) | `emit_skill()` dedup（変更なし — 正常） | - |

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
6. ❌ `completeSkillWithRewardAtom` で prerequisites チェックにより破棄された ← **ここが問題だった**

### 仮説の検証結果

| 仮説 | 結果 | 理由 |
|---|---|---|
| 1. スキル定義が存在しない | ❌ 不正解 | `skill-data.ts` に BRIDGE_001 は正しく定義されていた |
| 2. 条件付きスキル処理 | ⭕ 部分的に正解 | prerequisites チェックが原因だが、定義自体は正しい |
| 3. タイミング問題 | ⭕ 部分的に正解 | `chart()` 内の `get_stock_daily()` が早期発火させていた |
| 4. スキルIDの typo | ❌ 不正解 | Python/Frontend 両方で `BRIDGE_001` で一致 |

### e2e テスト結果

```
sandbox.spec.ts: 10 passed (1.8m)
```
