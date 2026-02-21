# Issue: Position 表示が "[object Object] shares"

**作成日**: 2026-02-20
**重要度**: Medium
**カテゴリ**: UI / Frontend
**ステータス**: ✅ Resolved (2026-02-20)

---

## 📝 概要

ステータスバーの Position（保有ポジション）フィールドが `[object Object] shares` と表示され、正しい数値が表示されない。

**現象**: ポジション数が数値ではなく、JavaScriptのオブジェクトがそのまま文字列化されている。

---

## ✅ 修正完了

### 根本原因

BackcastPro ライブラリの `Backtest.get_state_snapshot()` が返す `position` フィールドの型が、状況によって `float`（単一銘柄）または `dict`（複数銘柄/内部表現）になる。

**データの流れ**:
```
BackcastPro/backtest.py
  get_state_snapshot() → {"position": self.position.size, ...}
    ↓
BackcastPro/position.py
  Position.size → float (通常は単一値)
  ※ ただし内部実装で dict が返る場合がある
    ↓
headless_broadcast.py
  publish_state_headless() → JSON → base64 → <marimo-broadcast> HTML
    ↓
backtest-hud.tsx
  `${state.position} shares` → "[object Object] shares"  ← ここで壊れる
```

**問題箇所**: Python 側の `headless_broadcast.py` で型チェックなしに JSON 化していたため、`position` が dict のまま送信されていた。Frontend 側の `backtest-hud.tsx` もテンプレートリテラルでそのまま埋め込んでいたため、`[object Object]` が表示された。

### 修正内容

**両側で防御的に修正**（Defense in Depth パターン）。

#### ✅ Fix 1: Python 側 — `headless_broadcast.py`

```python
def publish_state_headless(bt, status_label="Backtest", status_variant="secondary"):
    state = bt.get_state_snapshot()
    state["status_label"] = status_label
    state["status_variant"] = status_variant

    # position がオブジェクトの場合は数値に変換
    pos = state.get("position")
    if isinstance(pos, dict):
        state["position"] = sum(pos.values())
    elif pos is not None and not isinstance(pos, (int, float)):
        try:
            state["position"] = float(pos)
        except (TypeError, ValueError):
            state["position"] = 0

    state_json = json.dumps(state)
    # ...
```

#### ✅ Fix 2: Frontend 側 — `backtest-hud.tsx`

```tsx
<HudItem
  icon={<ActivityIcon size={12} />}
  label="Position"
  value={`${
    typeof state.position === "object"
      ? Object.values(state.position as Record<string, number>).reduce((a, b) => a + b, 0)
      : state.position
  } shares`}
/>
```

---

## 🧠 設計思想と背景

### なぜ Python 側と Frontend 側の両方で修正したか（Defense in Depth）

- **Python 側のみ修正**した場合: `headless_broadcast.py` 経由のデータは安全になるが、他の経路（将来の別 publisher など）からオブジェクト型が送信された場合に Frontend が壊れる
- **Frontend 側のみ修正**した場合: 表示は直るが、JSON 内に不要な dict が残り続け、他の消費者（将来追加される可能性がある chart ウィジェットなど）に影響する
- **両方修正**することで、データ送信層と表示層の両方で型安全性を保証

### BackcastPro の Position 型について

BackcastPro は backtesting.py をベースにしたカスタムライブラリ。`Position` クラスの `.size` プロパティは通常 `float` を返すが:

- 単一銘柄: `float` → 問題なし
- ポジションなし: `0` (int) → 問題なし
- 内部で dict 表現が漏れるケース: `{"7203": 100}` → **これが問題**

BackcastPro は外部ライブラリ（`.venv` 内）で直接修正すべきではないため、ラッパー層（`headless_broadcast.py`）で型を正規化する方針を採用。

---

## 💡 Tips

### 型が不定な外部データの扱い

1. **送信前に正規化**: JSON にシリアライズする前に `isinstance` チェックで型を統一する
2. **受信側でも防御**: `typeof` チェックでフォールバック処理を入れる
3. **TypeScript の型定義を信用しすぎない**: `useBroadcastChannel.ts` の `BacktestState` インターフェースでは `position: number` と定義されているが、実際に dict が届く場合がある

### 類似バグの予防

`get_state_snapshot()` が返す他のフィールド（`equity`, `cash`, `closed_trades` など）も同様の型不整合が起きうる。新しいフィールドを追加する際は:

1. `headless_broadcast.py` で型チェックを追加
2. `backtest-hud.tsx` のテンプレートで `typeof` ガードを入れる
3. `useBroadcastChannel.ts` の `BacktestState` 型定義と実際のデータが一致しているか確認

---

## 📎 関連ファイル

| ファイル | 変更内容 | ステータス |
|---|---|---|
| [`headless_broadcast.py`](../../src-tauri/sample-notebooks/headless_broadcast.py) | position 型安全変換を追加 | ✅ 修正済み |
| [`backtest-hud.tsx`](../../frontend/src/components/editor/controls/backtest-hud.tsx) | typeof ガードを追加 | ✅ 修正済み |
| `BackcastPro/backtest.py` | `get_state_snapshot()` — 変更なし（外部ライブラリ） | - |
| `BackcastPro/position.py` | `Position.size` — 変更なし（外部ライブラリ） | - |
| [`useBroadcastChannel.ts`](../../frontend/src/hooks/useBroadcastChannel.ts) | `BacktestState` 型定義 — 変更なし | - |

---

## 📝 補足情報

### backtesting.py の position の仕様

backtesting.py ライブラリでは、`position` は通常、以下の形式:

```python
# 単一銘柄の場合
bt.position = 100  # int

# 複数銘柄の場合
bt.position = {"7203": 100, "6758": 50}  # dict
```

Backcastでは単一銘柄（7203）のみを扱うため、`bt.position` は数値であるべき。しかし BackcastPro の内部実装で dict 型が漏れるケースがあったため、`headless_broadcast.py` で `sum(pos.values())` に変換する防御コードを追加した。

### e2e テスト結果

```
sandbox.spec.ts: 10 passed (1.8m)
```

Position 表示は HUD コンポーネントの一部で、sandbox.spec.ts のスコープ外だが、手動確認で `100 shares` が正しく表示されることを確認済み。
