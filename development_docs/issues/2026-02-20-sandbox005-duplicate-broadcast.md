# Issue: SANDBOX_005 スキルイベントの重複送信

**作成日**: 2026-02-20
**重要度**: Low
**カテゴリ**: Game / BroadcastChannel
**ステータス**: Open

---

## 📝 概要

SANDBOX_005 スキルイベントがコンソールログに2回記録される。

**現象**: `bt.chart("7203")` を複数回実行すると、SANDBOX_005 イベントが重複して送信される。

---

## 🔍 再現手順

1. marimoで backcast.py を開く
2. SANDBOX_003 と SANDBOX_004 を完了する
3. `bt.chart("7203")` を実行（3回目）
4. ブラウザのコンソールログを確認

**期待される動作**: SANDBOX_005 イベントが1回だけ送信される
**実際の動作**: コンソールログに2回記録される

**コンソールログ例**:
```
[SkillHandler] Received skill event: SANDBOX_005
[SkillHandler] Received skill event: SANDBOX_005
```

---

## 🐛 原因（推測）

### 仮説1: 複数セルの同時実行

backcast.py に複数の `bt.chart("7203")` セルが存在し、marimoのリアクティブ実行で両方が実行された可能性。

**検証**: backcast.py のセル構成
```python
@app.cell
def _():
    bt.chart("7203")  # 1つ目のセル
    return

# ... 他のセル ...

@app.cell
def _():
    bt.chart("7203")  # 2つ目のセル（ユーザーが追加）
    return
```

marimoは依存関係の変更を検出すると、関連するすべてのセルを再実行する。このとき、両方の `bt.chart("7203")` セルが同時に実行され、`emit_skill("SANDBOX_005")` が2回呼ばれる可能性がある。

### 仮説2: BroadcastChannel の重複受信

`emit_skill()` 内の重複防止チェック（`_triggered_skills`）は機能しているはずだが、BroadcastChannelのメッセージ配信で重複が発生している可能性。

**検証ポイント**:
- `skill_events.py` の `_triggered_skills` セットが正しく機能しているか
- `extractAndSendBroadcastMessages()` が同じHTMLを2回パースしていないか
- `setupSkillEventListener()` のリスナーが複数登録されていないか

---

## 📊 影響範囲

- **スキルカウント**: 重複送信されてもフロントエンド側で `completeSkillWithRewardAtom` がdedup処理を行うため、カウントは正しく1回のみ増加する
- **ユーザー体験**: コンソールログに2回表示されるが、実害はほぼない
- **報酬**: 報酬も1回分のみ付与される（Jotai atomのdedup処理により）

**重要度 Low の理由**: 実質的な影響がほとんどない

---

## 💡 修正提案

### オプション1: Python側で重複防止を強化

`game_setup.py` の `chart()` 関数で、SANDBOX_005 の発火条件をより厳密にする:

```python
def chart(code: str, **kwargs):
    df = get_stock_daily(code)
    set_data({code: df})

    s = get_triggered_skills()

    emit_skill("SANDBOX_001")

    # SANDBOX_005 の重複防止：すでに発火済みならスキップ
    if "SANDBOX_003" in s and "SANDBOX_004" in s and "SANDBOX_005" not in s:
        emit_skill("SANDBOX_005")

    return backtest_chart(bt, code=code, **kwargs)
```

**メリット**: Python側で完全に制御できる
**デメリット**: `emit_skill()` 内部のdedup処理と冗長

### オプション2: フロントエンド側でBroadcastChannelのdedup強化

`skill-complete-handler.ts` の `setupSkillEventListener()` で、短時間（例: 500ms）内の同一スキルIDを無視:

```typescript
const recentSkills = new Map<string, number>(); // skillId -> timestamp

setupSkillEventListener((event) => {
  const now = Date.now();
  const lastTime = recentSkills.get(event.skill_id);

  // 500ms以内の重複は無視
  if (lastTime && now - lastTime < 500) {
    console.warn(`[SkillHandler] Duplicate skill ignored: ${event.skill_id}`);
    return;
  }

  recentSkills.set(event.skill_id, now);
  completeSkillWithReward(event);
});
```

**メリット**: あらゆる原因による重複を防げる
**デメリット**: 正当な短時間での再発火もブロックされる可能性

### オプション3: 調査を優先

まず、実際の原因を特定してから対策を決定:

1. `skill_events.py` にデバッグログを追加して、`emit_skill()` が2回呼ばれているか確認
2. ブラウザのBroadcastChannelイベントをトレースして、重複がどこで発生しているか特定
3. backcast.py のセル実行ログを確認して、marimo のリアクティブ実行が原因か検証

**メリット**: 根本原因に基づいた適切な修正
**デメリット**: 調査に時間がかかる

---

## 🎯 推奨アクション

**オプション3（調査優先）**

重要度が Low のため、まず調査を行い、原因が特定されてから修正を検討する。

短期的には以下のデバッグログを追加:

```python
# skill_events.py
def emit_skill(skill_id: str, context: dict | None = None) -> None:
    import traceback
    print(f"[DEBUG] emit_skill called: {skill_id}")
    traceback.print_stack(limit=5)  # 呼び出し元をトレース

    if skill_id in _triggered_skills:
        print(f"[DEBUG] Skipping duplicate: {skill_id}")
        return
    # ...
```

---

## 📎 関連ファイル

- [`game_setup.py`](../../src-tauri/sample-notebooks/game_setup.py) - `chart()` 関数
- [`skill_events.py`](../../src-tauri/sample-notebooks/skill_events.py) - `emit_skill()` 関数
- [`skill-complete-handler.ts`](../../frontend/src/components/skill-tree/skill-complete-handler.ts) - BroadcastChannelリスナー
- [`atoms.ts`](../../frontend/src/components/skill-tree/atoms.ts) - `completeSkillWithRewardAtom`
- [ゲームプレイレポート](../../.claude/plans/my-game-play-report.md) - バグ発見元

---

## 📝 補足情報

### 既存のdedup処理

#### Python側（skill_events.py）
```python
_triggered_skills: set[str] = set()

def emit_skill(skill_id: str, context: dict | None = None) -> None:
    if skill_id in _triggered_skills:
        return  # 重複スキップ
    _triggered_skills.add(skill_id)
    # ... HTML生成
```

#### フロントエンド側（atoms.ts）
```typescript
export const completeSkillWithRewardAtom = atom(
  null,
  (get, set, skillId: SkillId) => {
    const progress = get(playerProgressAtom);
    if (progress.completedSkills.includes(skillId)) {
      return; // すでに完了済みならスキップ
    }
    // ... 進捗更新
  }
);
```

両方でdedup処理があるにもかかわらず、コンソールログには2回表示される。これは、**コンソールログ出力がdedup処理より前に行われている**ことを示唆している。
