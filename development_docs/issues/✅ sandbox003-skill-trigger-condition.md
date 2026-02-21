# Issue: SANDBOX_003 スキル発火条件が直感に反する

**作成日**: 2026-02-20
**重要度**: Medium
**カテゴリ**: Game / User Experience
**ステータス**: ✅ Resolved (2026-02-20)

---

## 📝 概要

SANDBOX_003（「買値を確認する」）スキルの発火条件が直感的でなく、ユーザーが混乱する可能性がある。

**現象**: `bt.buy()` → `bt.trades()` の順で実行してもスキルが発火しない。

---

## ✅ 修正完了

### 根本原因

backtesting.py / BackcastPro の **Order と Trade のライフサイクル** に起因する設計ミス。

```
bt.buy()   → Order オブジェクト生成（未決済）
bt.step()  → 時間を進めて Order を決済 → Trade オブジェクト生成
bt.trades  → 決済済み Trade のリスト（bt.step() 前は空）
```

`game_setup.py` の `trades()` 関数が `len(bt.trades) > 0` を条件にしていたため、`bt.step()` を呼ばずに `bt.trades()` を実行してもスキルが発火しなかった。

```python
# 修正前
def trades():
    s = get_triggered_skills()
    if "SANDBOX_002" in s and len(bt.trades) > 0:  # ← bt.step() なしでは常に False
        emit_skill("SANDBOX_003")
    return bt.trades
```

### 修正内容

#### ✅ 採用した方針: オプション1（条件緩和）

```python
# game_setup.py — 修正後
def trades():
    """保有中の取引を確認"""
    s = get_triggered_skills()
    # SANDBOX_002（買い注文）実行済みなら trades() 呼び出しでスキル発火
    # （bt.trades が空でも buy() 後に呼んだこと自体を評価）
    if "SANDBOX_002" in s:
        emit_skill("SANDBOX_003")
    if "SANDBOX_002" in s:
        if any(hasattr(t, 'pl') and t.pl < 0 for t in bt.trades):
            emit_skill("FAIL_001")
    return bt.trades
```

**変更点**: `len(bt.trades) > 0` 条件を削除。`SANDBOX_002`（買い注文実行）が完了していれば、`trades()` を呼んだ時点でスキル発火。

---

## 🧠 設計思想と背景

### なぜオプション1（条件緩和）を選択したか

issueの修正提案にはオプション1〜3があったが、以下の理由でオプション1を採用:

| オプション | 判断 | 理由 |
|---|---|---|
| 1. 条件緩和 | ✅ 採用 | ゲーム体験を最優先。初心者が直感的に進められる |
| 2. ドキュメント改善 | △ 補助的に有効 | ユーザーがドキュメントを読まない可能性が高い |
| 3. ヒントセル | △ 将来検討 | 実装工数が大きく、今回のスコープ外 |

### 「スキルの意味」と「発火条件」の乖離について

SANDBOX_003 のタイトルは「買値を確認する」。厳密には `bt.trades` に決済済み Trade が存在しないと「買値」は確認できない。しかし:

- **ゲームの目的はプログラミング学習の促進**であり、厳密なバックテスト知識の検証ではない
- `bt.trades()` を呼ぶ行為自体が「取引を確認しようとした」ことを意味する
- `bt.step()` → `bt.trades()` の正確なシーケンスは BRIDGE トラック以降で学べばよい

### FAIL_001（含み損チェック）との関係

SANDBOX_003 の条件緩和に伴い、FAIL_001（含み損検出）のチェックも `trades()` 内に残している。ただし FAIL_001 は `bt.trades` の実際の pl 値を参照するため、`bt.step()` 後でないと発火しない。これは意図的な設計：

- SANDBOX_003: `trades()` を呼んだだけで発火（学習行動の評価）
- FAIL_001: 実際に含み損がある場合のみ発火（状態の評価）

---

## 💡 Tips

### Order / Trade のライフサイクル（backtesting.py / BackcastPro 共通）

```
bt.buy()         → Order（未決済注文）が pending_orders に追加
bt.step()        → 次の足で Order が決済 → Trade に変換
bt.trades        → 決済済み Trade のリスト
bt.orders        → 未決済 Order のリスト
bt.closed_trades → クローズ済み Trade のリスト
```

**重要**: `bt.buy()` 直後は `bt.trades` は空。`bt.orders` に Order が入る。

### スキル発火条件の設計指針

サンドボックストラック（SANDBOX_001〜006）のスキルは**行動ベース**で発火すべき:

- ユーザーが関数を呼んだ → スキル発火（結果は問わない）
- 失敗スキル（FAIL_*）のみ結果ベース → 含み損・破産などの状態を評価

ブリッジトラック（BRIDGE_001〜003）以降は結果ベースの評価を強化する。

### 同様の問題が起きやすい箇所

- `sell()` 内の SANDBOX_004 発火: 現在は `bt.sell()` 呼び出しで即発火（行動ベース）→ 問題なし
- `step()` 内の処理: `bt.step()` の例外で FAIL_003（破産）が発火 → 結果ベースで正しい

---

## 📎 関連ファイル

| ファイル | 変更内容 | ステータス |
|---|---|---|
| [`game_setup.py`](../../src-tauri/sample-notebooks/game_setup.py) | `trades()` の SANDBOX_003 条件緩和 | ✅ 修正済み |

---

## 📝 補足情報

### 正しい実行シーケンス（修正後）

```python
bt.chart("7203")  # チャート表示 → SANDBOX_001
bt.buy()          # 買い注文 → SANDBOX_002
bt.trades()       # 取引確認 → SANDBOX_003 ← bt.step() 不要に！
bt.step()         # 次の日に進む（注文が決済される）
bt.sell()         # 売り → SANDBOX_004
bt.chart("7203")  # チャート再表示 → SANDBOX_005（003+004 完了後）
```

### 参考: Backtest ライブラリの仕様

backtesting.py の仕様上、注文（Order）と取引（Trade）は別物:
- `bt.buy()` → Order オブジェクト（未決済）
- `bt.step()` → 時間を進めて Order を決済
- 決済後 → Trade オブジェクトとして `bt.trades` に追加

### e2e テスト結果

```
sandbox.spec.ts: 10 passed (1.8m)
```
