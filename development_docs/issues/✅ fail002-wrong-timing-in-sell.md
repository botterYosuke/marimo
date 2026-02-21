# Issue: FAIL_002 の発火タイミングが誤っている（sell() 時点では損切りは未確定）

**作成日**: 2026-02-21
**重要度**: Medium
**カテゴリ**: Game / Skill System
**ステータス**: ✅ 修正済み（2026-02-21 実装確認）

---

## 概要

`game_setup.py` の `sell()` 関数で FAIL_002（「初めての損切り」）を発火する際、`bt.closed_trades` を参照してチェックしているが、`bt.sell()` が生成するのはまだ未決済の「売り注文（Order）」に過ぎない。実際の取引（Trade）が `closed_trades` に追加されるのは、次回 `bt.step()` が呼ばれて注文が決済された後である。

このため、現在の `sell()` 内の FAIL_002 チェックは、直前に発行した売り注文の損益ではなく、それ以前に決済済みの古い取引の損益に基づいて判定される。

## 再現手順

1. `bt.chart("7203")` → `bt.buy()` → `bt.step()` で買い注文を決済させる
2. いくつか `bt.step()` を進めて含み損状態になる
3. `bt.sell()` を実行する
4. この時点で `bt.closed_trades` には現在の売り注文は含まれていない（注文はまだ未決済）
5. `bt.step()` を呼ぶと売り注文が決済されて `bt.closed_trades` に追加されるが、FAIL_002 はすでにチェック済みで発火機会を逃している（または誤った取引に基づいて判定されている）

## 根本原因

BackcastPro のライフサイクルにおいて Order と Trade は別物である：

```
bt.sell() → 売り注文（Order）が pending_orders に追加（まだ未決済）
bt.step() → 時間を進めて Order が決済 → closed_trades に Trade として追加
```

`game_setup.py` の `sell()` 関数：

```python
def sell():
    """保有中の株を売る"""
    order = bt.sell()
    price = bt._broker_instance.last_price(order.code)
    emit_skill("SANDBOX_004")
    # 損切りチェック  ← バグ: この時点では現在の売り注文はまだ closed_trades に存在しない
    if any(hasattr(t, 'pl') and t.pl < 0 for t in bt.closed_trades):
        emit_skill("FAIL_002")
    ...
```

`sell()` 呼び出し時の `bt.closed_trades` には、今回の売り注文で生まれる取引はまだ含まれていない。チェックされているのはそれ以前に決済された取引のみである。

これはすでに修正済みの SANDBOX_003 の問題（`trades()` が `bt.step()` 前は空だった）と同じ構造的な問題である。

## 影響範囲

- FAIL_002 が本来の意図（「今回の売りが損切りだった」）とは異なる条件で発火または不発になる
- 具体的には次の2つのシナリオで誤動作する：
  1. 今回初めての取引で損切りした場合: `bt.closed_trades` が空のため FAIL_002 が発火しない（本来は発火すべき）
  2. 過去に損切りがあった後で利確した場合: `bt.closed_trades` に過去の損切り取引が残っているため FAIL_002 が誤って発火する

## 修正案

### オプション A: `step()` 内でチェックする

FAIL_002 のチェックを `step()` 内の `_check_unrealized_loss()` と同様の仕組みで `bt.closed_trades` を監視する関数に移動する：

```python
def _check_stop_loss():
    """損切りチェック（FAIL_002 トリガー）"""
    if "SANDBOX_004" in get_triggered_skills():
        if any(hasattr(t, 'pl') and t.pl < 0 for t in bt.closed_trades):
            emit_skill("FAIL_002")

def step():
    ...
    _check_unrealized_loss()
    _check_stop_loss()  # step 後に損切り確認
    ...
```

### オプション B: sell() 後の最初の step() でチェック

`sell()` 内でフラグを立て、次回 `step()` で FAIL_002 チェックを行う（実装が複雑になるため非推奨）。

### 推奨: オプション A

`_check_unrealized_loss()` と同じパターンで `step()` 後に損切りチェックを行うのが最もシンプルで一貫性がある。`emit_skill` の dedup 機構により二重発火は防止される。

## 修正確認（2026-02-21）

`game_setup.py` の `step()` 内に FAIL_002 の損切りチェックが実装済みであることを確認（オプション A）。`sell()` には FAIL_002 発火コードが存在せず、`step()` 内の `new_closed` チェックで発火する設計になっている。`_check_unrealized_loss()` と同じパターンで実装されている。

## 関連ファイル

| ファイル | 関連箇所 |
|---|---|
| `src-tauri/sample-notebooks/game_setup.py` | `sell()` 101行目 — 修正対象 |
| `src-tauri/sample-notebooks/game_setup.py` | `step()` / `_check_unrealized_loss()` — 参考にすべきパターン |
| `development_docs/issues/sandbox003-skill-trigger-condition.md` | 同種の問題（Order/Trade ライフサイクル）の修正事例 |
