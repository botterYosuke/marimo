# Issue: trades() に "SANDBOX_002" の重複チェックがある

**作成日**: 2026-02-21
**重要度**: Low
**カテゴリ**: Game / Code Quality
**ステータス**: 未修正

---

## 概要

`game_setup.py` の `trades()` 関数に `if "SANDBOX_002" in s:` という同一条件のチェックが2回連続で記述されている。これは冗長なコードであり、意図が不明瞭で将来のバグの温床になる可能性がある。

## 問題箇所

```python
def trades():
    """保有中の取引を確認"""
    s = get_triggered_skills()
    # SANDBOX_002（買い注文）実行済みなら trades() 呼び出しでスキル発火
    # （bt.trades が空でも buy() 後に呼んだこと自体を評価）
    if "SANDBOX_002" in s:          # ← 1回目のチェック
        emit_skill("SANDBOX_003")
    if "SANDBOX_002" in s:          # ← 2回目（同一条件の重複）
        if any(hasattr(t, 'pl') and t.pl < 0 for t in bt.trades):
            emit_skill("FAIL_001")
    return bt.trades
```

## 根本原因

この重複は、`sandbox003-skill-trigger-condition.md` に記録された SANDBOX_003 修正時に発生したと思われる。修正前のコードでは2つの `if` 文が異なる条件を持っていた可能性がある（例: 1つ目が `SANDBOX_002 + len(bt.trades) > 0`、2つ目が `SANDBOX_002` のみ）。修正によって条件を統一した際に、誤って2つの独立した `if` 文として残ってしまった。

SANDBOX_003 修正後の意図したコード：

```python
# おそらく意図していた構造
if "SANDBOX_002" in s:
    emit_skill("SANDBOX_003")
    if any(hasattr(t, 'pl') and t.pl < 0 for t in bt.trades):
        emit_skill("FAIL_001")
```

## 影響範囲

現状では機能的な問題は発生していない（`if "SANDBOX_002" in s:` が False の場合は両方のブロックがスキップされ、True の場合は両方が実行されるため、動作結果は同一）。

ただし以下のリスクがある：
- コードの意図が不明瞭になり、将来の開発者が誤って条件を変更する可能性がある
- 2つ目の `if` 文の条件を誤って異なるものに変更した場合、バグが生じる

## 修正案

2つの `if` 文を1つにネストする：

```python
def trades():
    """保有中の取引を確認"""
    s = get_triggered_skills()
    # SANDBOX_002（買い注文）実行済みなら trades() 呼び出しでスキル発火
    # （bt.trades が空でも buy() 後に呼んだこと自体を評価）
    if "SANDBOX_002" in s:
        emit_skill("SANDBOX_003")
        if any(hasattr(t, 'pl') and t.pl < 0 for t in bt.trades):
            emit_skill("FAIL_001")
    return bt.trades
```

## 関連ファイル

| ファイル | 関連箇所 |
|---|---|
| `src-tauri/sample-notebooks/game_setup.py` | `trades()` 141-151行目 — 修正対象 |
| `development_docs/issues/sandbox003-skill-trigger-condition.md` | この重複が発生した可能性のある修正の記録 |
