# Issue: SANDBOX_003 スキル発火条件が直感に反する

**作成日**: 2026-02-20
**重要度**: Medium
**カテゴリ**: Game / User Experience
**ステータス**: Open

---

## 📝 概要

SANDBOX_003（「買値を確認する」）スキルの発火条件が直感的でなく、ユーザーが混乱する可能性がある。

**現象**: `bt.buy()` → `bt.trades()` の順で実行してもスキルが発火しない。

---

## 🔍 再現手順

1. marimoで backcast.py を開く
2. `bt.chart("7203")` を実行（チャート表示）
3. `bt.buy()` を実行（株購入注文）
4. `bt.trades()` を実行 ← **ここでSANDBOX_003が発火しない**

**期待される動作**: `bt.trades()`を実行するとスキルが取得できる
**実際の動作**: スキルが発火しない（`len(bt.trades) == 0`のため）

---

## 🐛 原因

`game_setup.py` の `trades()` 関数:

```python
def trades():
    """保有中の取引を確認"""
    s = get_triggered_skills()
    if "SANDBOX_002" in s and len(bt.trades) > 0:  # ← ここが問題
        emit_skill("SANDBOX_003")
    # ...
    return bt.trades
```

**問題点**:
- `bt.buy()` で注文を出しても、`bt.step()` で時間を進めない限り注文は決済されない
- 決済されていない注文は `bt.trades` に含まれない（`len(bt.trades) == 0`）
- したがって、`bt.step()` を呼ばずに `bt.trades()` を実行してもスキルが発火しない

---

## 📊 影響範囲

- **ユーザー体験**: 初心者ユーザーが「なぜスキルが取れないのか」と混乱する
- **ドキュメント**: ハンドオフドキュメント（backcast.py の説明文）に `bt.step()` の必要性が記載されていない
- **ゲーム進行**: SANDBOX_003 が取れないと SANDBOX_005 も取れず、ゲーム進行が止まる

---

## 💡 修正提案

### オプション1: コードを修正してスキル発火条件を緩和

```python
def trades():
    """保有中の取引を確認"""
    s = get_triggered_skills()
    # 条件を緩和：bt.buy() さえ実行していればスキル発火
    if "SANDBOX_002" in s:
        emit_skill("SANDBOX_003")
    # ...
    return bt.trades
```

**メリット**: ユーザーが直感的に進められる
**デメリット**: 「取引を確認する」というスキル名と矛盾する（取引がなくてもスキル取得）

### オプション2: ドキュメントを改善

backcast.py の説明文に以下を追加:

```python
mo.md(r"""
## ようこそ、Backcastへ！

### 今すぐできること

1. **株を買う注文する**: 黒いウィンドウに `bt.buy()` と入力して実行
2. **時間を進める**: `bt.step()` で次の日に進む  ← ★追加
3. **買注文が決済される**: 無事に買い注文が決済され株主になりました！ ← ★追加
4. **保有株を確認**: `bt.trades()` で買った株を確認  ← ★追加
5. **チャートを見る**: `bt.step()` で日を進めて株価の動きを確認
""")
```

**メリット**: コード変更不要、ゲームの設計意図を保つ
**デメリット**: ユーザーがドキュメントを読まない可能性

### オプション3: ヒントセルを自動挿入

SANDBOX_002 取得後に、ヒントセルを自動挿入:

```python
# injection-templates.ts に追加
SANDBOX_002: {
  name: "SANDBOX_003 のヒント",
  code: `# 💡 Tip: 注文を決済するには bt.step() で時間を進めてください
bt.step()
bt.trades()  # ← 決済された取引が表示されます`,
  config: { hide_code: false }
}
```

**メリット**: コードとドキュメント両方で対応、最もユーザーフレンドリー
**デメリット**: 実装工数が必要

---

## 🎯 推奨アクション

**オプション2（ドキュメント改善）+ オプション3（ヒントセル）の組み合わせ**

1. 短期: backcast.py の説明文を改善（即座に対応可能）
2. 中期: SANDBOX_002 取得後にヒントセルを自動挿入（次回リリース）

---

## 📎 関連ファイル

- [`game_setup.py`](../../src-tauri/sample-notebooks/game_setup.py) - スキル発火ロジック
- [`backcast.py`](../../C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py) - ゲームファイル
- [`injection-templates.ts`](../../frontend/src/components/skill-tree/injection-templates.ts) - セル自動挿入
- [ゲームプレイレポート](../../.claude/plans/my-game-play-report.md) - バグ発見元

---

## 📝 補足情報

### 正しい実行シーケンス

```python
bt.chart("7203")  # チャート表示
bt.buy()          # 買い注文 → SANDBOX_002 取得
bt.step()         # ★ここが重要：時間を進めて注文を決済
bt.trades()       # 決済された取引が表示される → SANDBOX_003 取得
```

### 参考: Backtest ライブラリの仕様

backtesting.py の仕様上、注文（Order）と取引（Trade）は別物:
- `bt.buy()` → Order オブジェクト（未決済）
- `bt.step()` → 時間を進めて Order を決済
- 決済後 → Trade オブジェクトとして `bt.trades` に追加
