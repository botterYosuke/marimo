# チャート・チカチカ問題 分析レポート

## 問題概要

- **現象**: 100msごとにセルが再実行されると、チャートが一瞬消えて再描画される（チカチカ）
- **発生環境**: `fintech1.py` でBackcastProを使用、`mo.ui.refresh(default_interval="100ms")` で自動更新
- **影響**: ユーザー体験の悪化、視覚的な不快感

---

## 根本原因

### 原因のフロー図

```
セル再実行
  ↓
Python: anywidget.__init__() で mo_data.js(js) を呼び出し
  (marimo/_plugins/ui/_impl/from_anywidget.py:241)
  ↓
VirtualFileLifecycleItem.create() で random_filename() を呼び出し
  (marimo/_runtime/virtual_file/virtual_file.py:123)
  ↓
★ 毎回新しいランダムなファイル名（URL）が生成される
  basename = tid + "-" + random.choices(k=8) → "12345-aBcDeFgH.js"
  (marimo/_runtime/virtual_file/virtual_file.py:41-42)
  ↓
js-url が変わる（例: "./@file/1234-abc.js" → "./@file/1234-xyz.js"）
  ↓
フロントエンド: AnyWidgetSlot の key が変わる
  const key = randomId ?? jsUrl;  // jsUrlがキーとして使用
  (frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx:178)
  ↓
React: キー変更 → LoadedSlot を完全再マウント
  ↓
runAnyWidgetModule(): el.innerHTML = "" でDOM消去
  (frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx:213-214)
  ↓
widget.initialize() → widget.render() を再実行
  ↓
✅ チャートが0から新規描画される → チカチカ
```

### 真の原因: random_filename()

**ファイル**: `marimo/_runtime/virtual_file/virtual_file.py`

```python
# 行41-42
def random_filename(ext: str) -> str:
    basename = tid + "-" + "".join(random.choices(_ALPHABET, k=8))
    return f"{basename}.{ext}"

# 行123 - 毎回呼ばれる
filename = random_filename(self.ext)
```

セル再実行のたびに新しいランダムファイル名が生成され、`js-url`が変わる。

### 既存の最適化が効かない理由

1. **js_hash は存在するが使われていない**
   ```python
   # from_anywidget.py:226-228
   js_hash: str = hashlib.md5(js.encode("utf-8"), usedforsecurity=False).hexdigest()
   ```
   このハッシュは `js-hash` 属性として渡されるが、**ファイル名には使われない**

2. **WeakCache が効かない**
   ```python
   # from_anywidget.py:117-122
   def from_anywidget(widget: AnyWidget) -> UIElement[Any, Any]:
       if not (el := _cache.get(widget)):
           el = anywidget(widget)
           _cache.add(widget, el)
       return el
   ```
   セル再実行では新しいウィジェットオブジェクトが作成されるため、キャッシュにヒットしない

### 各レイヤーの詳細

#### 1. Python側: random_id の生成

**ファイル**: `marimo/_plugins/ui/_core/ui_element.py`

```python
# 行210-212
self._random_id = str(
    uuid.UUID(int=self._random_seed.getrandbits(128))
)
```

**設計意図** (行116-122のコメント):
```
We want this to be fully random in production,
otherwise cached session state could use incorrect object-ids.
And changing object-ids are a way to force a re-render.
```

- セル再実行時に確実にUIをリセットするための設計
- **副作用**: チャート等の重いコンポーネントで再描画コストが高い

#### 2. フロントエンド: UIElement Web Component

**ファイル**: `frontend/src/core/dom/ui-element.ts`

```typescript
// 行188-220
static get observedAttributes() {
  return ["random-id"];  // random-idの変化を監視
}

attributeChangedCallback(name, oldValue, newValue) {
  if (name === "random-id" && oldValue !== newValue) {
    // 子要素を完全にアンマウント→再マウント
    this.disconnectedCallback();
    child.rerender();
    this.connectedCallback();
  }
}
```

#### 3. React: AnyWidgetプラグイン

**ファイル**: `frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx`

```typescript
// 行175-191
const randomId = props.host.closest("[random-id]")?.getAttribute("random-id");
const key = randomId ?? jsUrl;

return (
  <LoadedSlot
    key={key}  // ★ キーが変わると完全再マウント
    {...props}
  />
);
```

```typescript
// 行213-214 - runAnyWidgetModule内
el.innerHTML = "";  // ★ DOMを完全クリア
```

---

## 問題の本質

| レイヤ | メカニズム | 結果 |
|------|-----------|------|
| **Python** | セル実行 → 新しい`_random_id`生成 | DOM属性が変わる |
| **Web Component** | `random-id`の変化を検出 | 子要素を完全アンマウント |
| **React** | キーが変わる → `LoadedSlot`を新規作成 | 状態初期化 |
| **anywidget** | `el.innerHTML = ""` | DOM消去＋再描画 |
| **ユーザー体験** | 100ms間隔で全体再描画 | **チカチカ** |

---

## fintech1.py の問題箇所

```python
@app.cell
def _(bt, code, current_step, mo, play_switch, slider):
    # ... 計算ロジック ...

    # ★ 問題: 毎回新しいchartオブジェクトを生成
    chart = bt.chart(code=code, height=500, show_tags=True)

    # ★ 問題: mo.vstack()も毎回新しいオブジェクト
    mo.vstack([chart, info])
```

セルが再実行されるたびに:
1. `bt.chart()` が新しいPlotlyチャートを生成
2. 新しいUIElementが作成される（新しい`random_id`）
3. フロントエンドで完全再マウント
4. Plotlyが0から描画を開始

---

## WeakCacheの限界

**ファイル**: `marimo/_plugins/ui/_impl/from_anywidget.py`

```python
# 行89-122
class WeakCache(Generic[K, V]):
    """同じpythonオブジェクトに対して同じUIElementを返す"""
    def add(self, k: K, v: V) -> None:
        oid: int = id(k)
        self._data[oid] = v
```

**効果**: 同じPythonウィジェットオブジェクトには同じUIElementを返す

**限界**:
- セル再実行時に新しいウィジェットオブジェクトが作成される
- `bt.chart()` は毎回新しいオブジェクトを返す
- WeakCacheのヒットなし → 新しいUIElement生成

---

## 関連コンポーネント

### Plotlyの最適化の試み

**ファイル**: `frontend/src/plugins/impl/plotly/PlotlyPlugin.tsx`

```typescript
export const PlotlyComponent = memo(({ figure }) => {
  const [figure, setFigure] = useState(() => structuredClone(originalFigure));
  // ...
});
```

**問題**: `random-id`が変わるとReactキーが変わり、memoが効かない

---

## チカチカの程度を左右する要因

| 要因 | 影響 |
|------|------|
| チャートの複雑さ | データ点数が多いほど再描画が遅い |
| 更新間隔 | 100msは非常に高頻度 |
| レンダリング方式 | Canvas/WebGLはSVGより高速 |
| ライブラリ初期化コスト | Plotlyは初期化が重い |

---

## 次のステップ

この分析に基づき、以下の改修プランを策定:
→ `chart-flickering-fix-plan.md` を参照
