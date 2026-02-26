# Issue: bt.buy() 直後の bt.step() が False を返しゲーム終了になる

**作成日**: 2026-02-20
**重要度**: Critical
**カテゴリ**: Game / BackcastPro / Broker
**ステータス**: 修正済み（2026-02-20 検証完了）

---

## 作業進捗

- ✅ バグの再現（`bt.chart("7203")` → `bt.buy()` → `bt.step()` → `False`）
- ✅ 根本原因の特定（`_broker.py:257` の `iloc[-2]` IndexError）
- ✅ monkeypatch による例外の直接確認
- ✅ 方針A 実装: `_broker.py` の `iloc[-2]` にガード追加
- ✅ 方針B 実装: `BankruptError` 専用例外クラスの導入
- ✅ `backtest.py` の `except Exception` → `except BankruptError` に変更
- ✅ `__init__.py` に `BankruptError` のエクスポート追加
- ✅ `game_setup.py` の `except Exception` → `except BankruptError` に変更
- ✅ `backcast.py` のチュートリアル手順を修正（`bt.step()` → `bt.buy()` の順序に）
- ✅ デプロイ（`%APPDATA%/marimo/notebooks/` にコピー）
- ✅ 手動検証: `bt.chart("7203")` → `bt.buy()` → `bt.step()` が `True` を返すことを確認

---

## 概要

ゲームの基本操作である `bt.buy()` → `bt.step()` を実行すると、`bt.step()` が `False` を返してバックテストが即終了する。エラーメッセージは一切表示されない。ゲーム開始直後のチュートリアル操作で発生し、ユーザーは理由不明のゲーム終了に遭遇する。

**現象**: `bt.chart("7203")` → `bt.buy()` → `bt.step()` で 100% 再現

---

## 前提知識

### システム構成

Backcast はトヨタ等の株を売買するバックテストゲーム。以下のレイヤー構造を持つ。

```
ユーザー操作層:  bt.buy() / bt.step()  （game_setup.py のモジュール関数）
    ↓
ラッパー層:      Backtest       （backtest.py — Backtest を継承）
    ↓
コア層:          Backtest               （BackcastPro/backtest.py）
    ↓
ブローカー層:    _Broker                （BackcastPro/_broker.py — 注文約定処理）
```

### ファイルの場所

| ファイル | パス | 役割 |
|---------|------|------|
| `game_setup.py` | `src-tauri/sample-notebooks/game_setup.py` | ユーザー向けAPI。`bt.buy()`等のモジュール関数を提供 |
| `backtest.py` | `src-tauri/sample-notebooks/backtest.py` | Backtest にチャート機能を追加するラッパー |
| `backtest.py` | `.venv/Lib/site-packages/BackcastPro/backtest.py` | バックテストのコアエンジン |
| `_broker.py` | `.venv/Lib/site-packages/BackcastPro/_broker.py` | ブローカー（注文の約定処理を担当） |

### step() の動作

`Backtest.step()` は1日分の時間を進める関数。内部では以下を行う：

1. `_step_index` を元に `current_time`（現在の日付）を取得
2. `_current_data[code]` を `df.iloc[:pos+1]` にスライス（現在日までのデータのみ見える）
3. `_broker_instance.next(current_time)` を呼んで保留中の注文を約定処理
4. `_step_index` をインクリメント
5. 続行可能なら `True`、終了なら `False` を返す

### buy() の動作

`Backtest.buy()` はサイズ省略時に `size = 1 - sys.float_info.epsilon`（≈ 0.9999...）でオーダーを作成する。これは「利用可能資金の99.99%を使う」という意味で、`-1 < size < 1` の範囲に入る比例注文。

ブローカーは `_process_orders()` の中でこの比例サイズを実際の株数に変換して約定する。

---

## 再現手順

### 手動再現

1. ゲームをリセット:
   ```bash
   cp src-tauri/sample-notebooks/*.py "$APPDATA/marimo/notebooks/"
   rm -f "$APPDATA/marimo/notebooks/.backcast.progress.json"
   ```
2. `pnpm dev` でサーバー起動
3. `http://localhost:2718/?file=...backcast.py` を開く
4. cell-2（`bt.chart("7203")`）を Ctrl+Enter で実行
5. 新しいセルを追加して `bt.buy()` を実行
6. 新しいセルを追加して以下を実行:
   ```python
   result = bt.step()
   print(f"step() returned: {result}")  # → 修正前: False / 修正後: True
   ```

### 診断コードによる確認

```python
_inner = bt.bt  # Backtest インスタンス

# buy前の状態
print(f"step_index: {_inner._step_index}")       # → 0
print(f"is_finished: {_inner._is_finished}")     # → False
print(f"_current_data keys: {list(_inner._current_data.keys())}")  # → []

# buy + step
bt.buy()
result = bt.step()

# buy+step後の状態
print(f"step() returned: {result}")              # → 修正前: False / 修正後: True
print(f"step_index: {_inner._step_index}")       # → 修正前: 0 / 修正後: 1
print(f"is_finished: {_inner._is_finished}")     # → 修正前: True / 修正後: False
print(f"trades: {len(_inner.trades)}")           # → 修正前: 0 / 修正後: 1
```

---

## 根本原因

### 直接原因: `_broker.py:257` の IndexError

`_broker.py` の `_process_orders()` メソッド内で、成行注文を処理する際に以下のコードが実行される：

```python
# _broker.py 254-258行（修正前）
else:
    # 成行注文（Market-if-touched / market order）
    # 条件付き注文は常に次の始値で
    prev_close = df.Close.iloc[-2]    # ★ ここで IndexError
    price = prev_close if self._trade_on_close and not order.is_contingent else open
```

`prev_close = df.Close.iloc[-2]` は「1つ前の終値」を取得しようとするが、`step_index=0` のとき `_current_data` にはデータが **1行しかない**（`df.iloc[:1]`）。1行の DataFrame に対して `iloc[-2]` は存在しないため **IndexError** が発生する。

### 例外の伝搬経路

```
_broker.py:257  prev_close = df.Close.iloc[-2]
    → IndexError: single positional indexer is out-of-bounds
        ↓
_broker.py:187  def next(self, current_time):
    → _process_orders() 内の例外がそのまま伝搬
        ↓
backtest.py:304-309  try: ... except Exception:
    → self._is_finished = True; return False   # ★ 例外が消費される
        ↓
game_setup.py:104-105  try: result = bt.step()
    → result = False（例外はここまで到達しない）
        ↓
ユーザー:  bt.step() が False を返す（理由不明）
```

**問題点**: `Backtest.step()` の `except Exception` が `IndexError` を含む全ての例外を静かに飲み込んでしまう。本来この try-except は「equity <= 0 で broker が raise する破産ケース」を想定しているが、プログラミングエラー（IndexError）まで捕捉してしまっている。

### なぜ step_index=0 で問題になるか

```
step_index=0 → current_time = index[0] = "2001-01-04"
→ _current_data["7203"] = df.iloc[:0+1] = df.iloc[:1]  (1行)
→ broker._data = {"7203": <DataFrame 1行>}
→ _process_orders() で成行注文を処理
→ df.Close.iloc[-2] → 1行しかないので IndexError!
```

step_index=1 以降であれば `df.iloc[:2]` 以上になるため `iloc[-2]` が成功する。つまり、**最初の1ステップ目にペンディングオーダーがある場合にのみ発生する**。

### monkeypatch による直接確認ログ

```
step_index before step: 0
index[0]: 2001-01-04 00:00:00
broker.next CAUGHT: IndexError: single positional indexer is out-of-bounds

step() returned: False
step_index after: 0
is_finished: True
```

---

## 影響範囲

| 影響 | 説明 |
|------|------|
| ゲーム進行不能 | 最初の `bt.buy()` → `bt.step()` でゲーム終了。ユーザーはチュートリアルを完了できない |
| FAIL_003 スキル未発火 | `game_setup.step()` は `bt.step()` からの例外で FAIL_003（破産）を発火する設計だが、例外が Backtest 内部で消費されるため発火しない |
| デバッグ困難 | エラーメッセージが一切表示されず、`step()` が単に `False` を返すだけなので原因特定が困難 |
| 正常プレイへの影響なし | `bt.step()` を先に実行してから `bt.buy()` → `bt.step()` する場合は step_index>=1 なので問題ない |

---

## 実施した修正（方針 A + B の両方を採用）

### 方針A: `_broker.py` の `iloc[-2]` にガード追加

```python
# _broker.py 264行目（旧257行目）
# 修正前
prev_close = df.Close.iloc[-2]

# 修正後（データが1行しかない場合は現在の終値を使用）
prev_close = df.Close.iloc[-2] if len(df) >= 2 else df.Close.iloc[-1]
```

**メリット**: 最小限の変更。1行データでも成行注文が約定可能になる。
**考慮点**: 初日の約定価格が「前日終値」ではなく「当日終値」になるが、step_index=0 には前日が存在しないので合理的。

### 方針B: `BankruptError` 専用例外の導入

#### B-1. `_broker.py` に `BankruptError` クラスを新設

```python
# _broker.py 20-22行目（新規追加）
class BankruptError(Exception):
    """エクイティが0以下になった場合に発生する破産例外"""
    pass
```

#### B-2. `_broker.py` の破産処理で `BankruptError` を使用

```python
# _broker.py 207-209行目（旧202行目）
# 修正前
raise Exception(...)

# 修正後
raise BankruptError(
    f"エクイティが0以下になりました (equity={equity:.2f})"
)
```

#### B-3. `backtest.py` で `BankruptError` のみキャッチ

```python
# backtest.py 14行目
from ._broker import _Broker, BankruptError

# backtest.py 304-309行目
# 修正前
try:
    self._broker_instance._data = self._current_data
    self._broker_instance.next(current_time)
except Exception:
    self._is_finished = True
    return False

# 修正後（破産例外のみキャッチ、それ以外は再送出）
try:
    self._broker_instance._data = self._current_data
    self._broker_instance.next(current_time)
except BankruptError:
    self._is_finished = True
    return False
```

#### B-4. `__init__.py` にエクスポート追加

```python
# __init__.py
from ._broker import BankruptError

__all__ = [
    'Backtest',
    'BankruptError',  # 追加
    ...
]
```

#### B-5. `game_setup.py` のエラーハンドリング更新

```python
# game_setup.py 17行目
from BackcastPro import get_stock_daily as _get_stock_daily, BankruptError

# game_setup.py 102-114行目
def step():
    """次の日に進む"""
    try:
        result = bt.step()
    except BankruptError:          # Exception → BankruptError に変更
        emit_skill("FAIL_003")
        update_all_backtest_charts(bt)
        publish_state_headless(bt, status_label="Bankrupt", status_variant="danger")
        raise
    ...
```

### チュートリアル手順の修正（`backcast.py`）

チュートリアルの手順を「まず `bt.step()` で時間を進める → `bt.buy()` で注文」の順序に変更した。これにより step_index=0 で buy が呼ばれるケースを自然に回避し、バグ修正が万一不完全でもユーザーが問題に遭遇しにくくなる。

```markdown
# 修正前の手順
1. 株を買う注文する: `bt.buy()` と入力して実行
2. 時間を進める: `bt.step()` で次の日に進む

# 修正後の手順
1. 時間を進める: `bt.step()` で次の日に進む
2. 株を買う注文する: `bt.buy()` と入力して実行
3. 買注文が決済される: `bt.step()` で次の日に進むと注文が決済されました！
```

---

## 修正ファイル一覧

| ファイル | 変更箇所 | 変更内容 |
|---------|---------|---------|
| `.venv/Lib/site-packages/BackcastPro/_broker.py` | 20-22行目（新規） | `BankruptError` クラス追加 |
| `.venv/Lib/site-packages/BackcastPro/_broker.py` | 207-209行目 | `raise Exception` → `raise BankruptError(...)` |
| `.venv/Lib/site-packages/BackcastPro/_broker.py` | 264行目 | `iloc[-2]` に `len(df) >= 2` ガード追加 |
| `.venv/Lib/site-packages/BackcastPro/backtest.py` | 14行目 | `BankruptError` インポート追加 |
| `.venv/Lib/site-packages/BackcastPro/backtest.py` | 307行目 | `except Exception` → `except BankruptError` |
| `.venv/Lib/site-packages/BackcastPro/__init__.py` | 14行目, `__all__` | `BankruptError` エクスポート追加 |
| `src-tauri/sample-notebooks/game_setup.py` | 17行目 | `BankruptError` インポート追加 |
| `src-tauri/sample-notebooks/game_setup.py` | 106行目 | `except Exception` → `except BankruptError` |
| `src-tauri/sample-notebooks/backcast.py` | 13-28行目 | チュートリアル手順を step→buy 順に修正 |

---

## 設計思想と背景

### なぜ方針 A + B の両方を採用したか

- **方針A（ガード追加）** は直接的なバグ修正。`iloc[-2]` が1行データで落ちる問題を解決する。これだけでゲームは動くようになる。
- **方針B（専用例外）** は防御的設計。`except Exception` が全例外を飲み込むパターンは「サイレントな破損」を引き起こす最も危険なアンチパターン。今回の IndexError はたまたま発見できたが、今後同種のバグが発生した場合にまた隠蔽されてしまう。`BankruptError` を専用例外にすることで、意図しない例外（プログラミングエラー）は必ず表面化する。

### `BankruptError` を `_broker.py` に置いた理由

`BankruptError` は `_Broker.next()` 内部の破産判定で raise される。例外の発生元と定義元を同じモジュールに置くことで依存関係が最もシンプルになる。`backtest.py` と `game_setup.py` は `from ._broker import BankruptError` / `from BackcastPro import BankruptError` でインポートする。

### チュートリアル手順を変更した理由

バグ修正とは別に、チュートリアルの手順自体も「step → buy → step」の順が教育的に優れている：
- 「時間を進める」概念を先に体験できる
- buy の後に step すると注文が約定される、という因果関係が明確になる
- step_index=0 でのエッジケースを自然に回避できる（防御的）

---

## 新たな知見

### `except Exception` の危険性

BackcastPro の `Backtest.step()` 内にあった `except Exception: return False` パターンは、あらゆる種類のエラーを「正常終了」と区別不可能にしてしまう。このパターンを見つけたら必ず「本当にキャッチすべき例外は何か」を確認し、専用例外クラスに置き換えるべき。

### marimo ノートブックでの `bt` の正体

ノートブック内で `import game_setup as bt` しているため、`bt` はモジュールオブジェクトであり Backtest インスタンスではない。内部の Backtest インスタンスにアクセスするには `bt.bt` を使う必要がある（`game_setup.py` のモジュールレベル変数 `bt` が `Backtest` インスタンス）。

```python
# ノートブックでの診断時
bt.bt._step_index    # ✅ Backtest の内部状態
bt._step_index       # ❌ AttributeError（bt はモジュール）
```

### BackcastPro は `.venv` 内のパッケージ

修正は `.venv/Lib/site-packages/BackcastPro/` 内のファイルに直接行った。`pip install` や `pip install -e` で再インストールすると修正が上書きされる可能性がある。恒久的な修正は BackcastPro のソースリポジトリ側で行う必要がある。

---

## Tips

### ゲームリセット手順

```bash
# 1. サンプルノートブックをデプロイ先にコピー
cp -f src-tauri/sample-notebooks/*.py "$APPDATA/marimo/notebooks/"

# 2. 進捗データを削除（スキルの発火状態がリセットされる）
rm -f "$APPDATA/marimo/notebooks/.backcast.progress.json"

# 3. devサーバーを起動
pnpm dev
```

### デバッグ時に便利な診断コード

```python
# Backtest の内部状態を確認
_inner = bt.bt
print(f"step_index: {_inner._step_index}")
print(f"is_finished: {_inner._is_finished}")
print(f"_current_data keys: {list(_inner._current_data.keys())}")
print(f"trades: {len(_inner.trades)}")
print(f"orders: {len(_inner.orders)}")
print(f"equity: {_inner.equity}")
```

### broker.next() の例外をキャッチして確認する方法

```python
# monkeypatch で broker の例外を直接確認
_inner = bt.bt
_orig_next = _inner._broker_instance.next.__func__
def _patched_next(self, current_time):
    try:
        return _orig_next(self, current_time)
    except Exception as e:
        print(f"broker.next CAUGHT: {type(e).__name__}: {e}")
        raise
import types
_inner._broker_instance.next = types.MethodType(_patched_next, _inner._broker_instance)
```

### Playwright でのセル操作（grid レイアウト対応）

marimo の `width="grid"` レイアウトでは react-flow のノード要素がポインターイベントを吸収するため、Playwright の通常のクリックがタイムアウトすることがある。以下の方法で回避可能：

- **JavaScript で直接操作**: `page.evaluate(() => { document.querySelectorAll('button').forEach(b => { if (b.textContent.trim() === 'Reject') b.click(); }); })`
- **`force: true` オプション**: `page.locator(...).click({ force: true })`
- **`fill()` でテキスト入力**: CodeMirror エディタには `fill()` が使える

---

## テスト方法

### 手動テスト

1. ゲームリセット後、`bt.chart("7203")` → `bt.buy()` → `bt.step()` を実行
2. `bt.step()` が `True` を返すことを確認
3. その後 `bt.step()` を繰り返して正常にゲームが進行することを確認

### 自動テスト（e2e）

`frontend/e2e-tests/game/sandbox.spec.ts` の既存テストで SANDBOX_002（`bt.buy()`）の後に `bt.step()` を呼ぶシナリオがあれば、そこで検証可能。なければ以下のテストケースを追加:

```python
# テストケース: buy直後のstepが正常に動作すること
bt.chart("7203")
bt.buy()
result = bt.step()
assert result == True, f"Expected True but got {result}"
assert bt.bt._step_index == 1
assert bt.bt._is_finished == False
```

---

## 補足: なぜこれまで発覚しなかったか

ゲームのチュートリアル手順（`handoff-game-play-v4.md`）では `bt.chart("7203")` → `bt.buy()` → **`bt.trades()`** → `bt.sell()` → ... という順序でプレイしていた。`bt.trades()` は `bt.step()` を呼ばないため、`bt.buy()` 直後に `bt.step()` を呼ぶパターンがテストされていなかった。

ユーザーがチュートリアルの指示に従わず「買って→次の日に進む」という直感的な操作をした場合にのみ発現するバグである。

今回の修正でチュートリアル手順も `bt.step()` → `bt.buy()` → `bt.step()` の順に変更したため、チュートリアル通りにプレイしても step_index >= 1 の状態で buy が実行される。
