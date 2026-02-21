# Issue: SANDBOX_005 スキルイベントの重複送信

**作成日**: 2026-02-20
**重要度**: Low
**カテゴリ**: Game / BroadcastChannel
**ステータス**: ✅ Resolved (2026-02-20)

---

## 📝 概要

SANDBOX_005 スキルイベントがコンソールログに2回記録される。

**現象**: `bt.chart("7203")` を複数回実行すると、SANDBOX_005 イベントが重複して送信される。

---

## ✅ 修正完了

### 根本原因

`game_setup.py` の `chart()` 関数で SANDBOX_005 の発火前に「すでに発火済みか」のチェックが欠落していた。

```python
# 修正前
def chart(code: str, **kwargs):
    df = get_stock_daily(code)
    set_data({code: df})
    s = get_triggered_skills()
    emit_skill("SANDBOX_001")
    if "SANDBOX_003" in s and "SANDBOX_004" in s:  # ← SANDBOX_005 の状態チェックなし
        emit_skill("SANDBOX_005")
    return backtest_chart(bt, code=code, **kwargs)
```

**重複の仕組み**:
1. 1回目の `chart()` 呼び出し → SANDBOX_005 が `emit_skill()` で発火 → `_triggered_skills` に追加
2. 2回目の `chart()` 呼び出し → `emit_skill("SANDBOX_005")` → Python 側の `_triggered_skills` で dedup → **発火しない**
3. しかし marimo のリアクティブ実行で複数セルが**同時に**実行された場合、`_triggered_skills` への追加がまだ反映されていない別セルからも `chart()` が呼ばれ、2回目の `emit_skill()` が dedup をすり抜ける

### 修正内容

#### ✅ 採用した方針: オプション1（Python 側で重複防止を強化）

```python
# game_setup.py — 修正後
def chart(code: str, **kwargs):
    # _get_stock_daily を直接使用（get_stock_daily は BRIDGE_002 を発火するため）
    df = _get_stock_daily(code)
    set_data({code: df})
    s = get_triggered_skills()

    emit_skill("SANDBOX_001")
    if "SANDBOX_003" in s and "SANDBOX_004" in s and "SANDBOX_005" not in s:
        emit_skill("SANDBOX_005")

    return backtest_chart(bt, code=code, **kwargs)
```

**変更点**: `"SANDBOX_005" not in s` 条件を追加。`get_triggered_skills()` のスナップショット `s` に SANDBOX_005 が含まれている場合は `emit_skill()` を呼ばない。

---

## 🧠 設計思想と背景

### なぜ `emit_skill()` の dedup だけでは不十分だったか

`skill_events.py` の `emit_skill()` には `_triggered_skills` セットによる dedup 処理がある:

```python
def emit_skill(skill_id, context=None):
    if skill_id in _triggered_skills:
        return  # 重複スキップ
    _triggered_skills.add(skill_id)
    # ... HTML 生成 → mo.output.append()
```

この dedup は**同一スレッド内の逐次呼び出し**には有効だが、以下のケースで不十分:

1. **marimo のリアクティブ実行**: 複数セルが依存関係により同時再実行される場合、`_triggered_skills` への書き込みと別セルの読み取りの間にタイミングギャップが生じる
2. **`mo.output.append()` の非同期性**: HTML の出力がバッファされ、複数の出力が1回のフラッシュでフロントエンドに送信される場合、BroadcastChannel で同一イベントが複数回配信される

### 防御の多層化（Defense in Depth）

スキルイベントの重複防止は3層で行う:

| 層 | 場所 | 仕組み | 効果 |
|---|---|---|---|
| **1. 呼び出し前チェック** | `game_setup.py` | `"SKILL" not in s` | `emit_skill()` 自体を呼ばない |
| **2. `emit_skill()` dedup** | `skill_events.py` | `_triggered_skills` set | 同一スキルの HTML 生成を防止 |
| **3. atom dedup** | `atoms.ts` | `completedSkills.includes()` | フロントエンドで最終防御 |

今回の修正は層1を追加したもの。層2・3は既存の仕組みをそのまま利用。

### フロントエンド側への影響

コンソールログに2回表示されていた問題について:

- `[SkillHandler] Received skill event: SANDBOX_005` が2回表示されるのは、BroadcastChannel で2回受信していたため
- しかし `completeSkillWithRewardAtom` の dedup（層3）により、実際のスキル完了は1回のみ
- **ユーザーへの実害はなかった**が、コンソールログのノイズと不要な atom 処理を削減するため修正

---

## 💡 Tips

### `chart()` 関数の全変更点まとめ

この修正は BRIDGE_001 修正（`_get_stock_daily` 使用）と同時に行われた。`chart()` の最終形:

```python
def chart(code: str, **kwargs):
    # _get_stock_daily を直接使用（get_stock_daily は BRIDGE_002 を発火するため）
    df = _get_stock_daily(code)
    set_data({code: df})
    s = get_triggered_skills()

    emit_skill("SANDBOX_001")
    if "SANDBOX_003" in s and "SANDBOX_004" in s and "SANDBOX_005" not in s:
        emit_skill("SANDBOX_005")

    return backtest_chart(bt, code=code, **kwargs)
```

変更点:
1. `get_stock_daily` → `_get_stock_daily`（BRIDGE_001 修正）
2. `"SANDBOX_005" not in s` 条件追加（本 issue の修正）

### 新しいスキル発火を追加する際のチェックリスト

1. `emit_skill()` を呼ぶ前に `get_triggered_skills()` で発火済みかチェック
2. marimo のリアクティブ実行で複数回呼ばれる可能性を考慮
3. `emit_skill()` 内部の dedup に頼らず、呼び出し側でもガードを入れる

---

## 📎 関連ファイル

| ファイル | 変更内容 | ステータス |
|---|---|---|
| [`game_setup.py`](../../src-tauri/sample-notebooks/game_setup.py) | `chart()` に `"SANDBOX_005" not in s` ガード追加 | ✅ 修正済み |

---

## 📝 補足情報

### 既存のdedup処理（確認済み・変更なし）

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

### コンソールログの変化

**修正前**:
```
[SkillHandler] Received skill event: SANDBOX_005
[SkillHandler] Received skill event: SANDBOX_005  ← 重複
```

**修正後**:
```
[SkillHandler] Received skill event: SANDBOX_005  ← 1回のみ
```

### e2e テスト結果

```
sandbox.spec.ts: 10 passed (1.8m)
```

「同一スキルを 2 回発火しても completeSkills が重複しない」テストケース（sandbox.spec.ts:174）が、atom 側の dedup を検証済み。
