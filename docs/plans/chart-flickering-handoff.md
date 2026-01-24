# チャート・チカチカ問題 - 作業引継ぎプロンプト

## 問題概要

marimoノートブックで100msごとにセルが再実行されると、anywidgetで描画したチャートが**一瞬消えて再描画される（チカチカする）**問題。

## 現状の観察結果

ブラウザのDevToolsで確認した結果:

| 属性 | 挙動 |
|------|------|
| `data-js-hash` | **変わらない**（ESMの内容ハッシュ、安定） |
| `data-js-url` | **毎回変わる**（ランダムファイル名） |
| `random-id` | **毎回変わる**（UIElement生成時にランダム） |

## 試した修正（効果なし）

`frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx:177-179` を変更:

```typescript
// Before:
const key = randomId ?? jsUrl;

// After:
const key = randomId ?? jsHash ?? jsUrl;
```

**結果**: 効果なし。`randomId`が常に存在するため、`jsHash`が使われない。

---

## 仮説

### 仮説1: randomIdが優先されている

`randomId ?? jsHash ?? jsUrl` では、`randomId`が`null`/`undefined`でない限り`jsHash`は使われない。

**検証方法**: ログを追加して`randomId`の値を確認

### 仮説2: 別の場所で再マウントがトリガーされている

`AnyWidgetSlot`のキーだけでなく、親コンポーネントや`LoadedSlot`内部でも再マウントが発生している可能性。

**検証方法**:
- `LoadedSlot`内の`useEffect`にログを追加
- `runAnyWidgetModule`の呼び出しタイミングを確認

### 仮説3: UIElement Web Componentレベルで再マウント

`frontend/src/core/dom/ui-element.ts`の`attributeChangedCallback`で`random-id`の変化を検出し、子要素を強制再レンダリングしている可能性。

**検証方法**: `ui-element.ts`の`attributeChangedCallback`にログを追加

---

## 検証用ログの追加箇所

### 1. AnyWidgetPlugin.tsx（行177付近）

```typescript
// 既存コード
const randomId = props.host.closest("[random-id]")?.getAttribute("random-id");
const key = randomId ?? jsHash ?? jsUrl;

// 追加するログ
console.log("[AnyWidget Debug] AnyWidgetSlot render", {
  randomId,
  jsHash,
  jsUrl,
  key,
  timestamp: Date.now()
});
```

### 2. AnyWidgetPlugin.tsx - LoadedSlot内（行290付近のuseEffect）

```typescript
useEffect(() => {
  console.log("[AnyWidget Debug] LoadedSlot useEffect - widget re-run", {
    jsUrl: data.jsUrl,
    jsHash: data.jsHash,
    timestamp: Date.now()
  });
  // ... 既存コード
}, [widget, data.jsUrl]);
```

### 3. ui-element.ts（行188付近のattributeChangedCallback）

```typescript
attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
  console.log("[UIElement Debug] attributeChangedCallback", {
    name,
    oldValue,
    newValue,
    hasChanged: oldValue !== newValue
  });
  // ... 既存コード
}
```

---

## 検証手順

1. 上記のログを3箇所に追加
2. フロントエンドをビルド: `pnpm build`
3. 開発サーバー起動: `make dev`
4. `fintech1.py`（`C:\Users\sasai\AppData\Local\Temp\fintech1.py`）を実行
5. ブラウザのDevToolsコンソールでログを確認
6. 以下を特定:
   - どのログが100msごとに出力されるか
   - `key`が毎回変わっているか
   - `attributeChangedCallback`が呼ばれているか

---

## 修正案

### 案1: randomIdを完全に無視（リスク: 中）

```typescript
// AnyWidgetPlugin.tsx:177-179
// randomIdを使わず、jsHashのみをキーにする
const key = jsHash ?? jsUrl;
```

**リスク**: `random-id`は「セル再実行時にUIをリセットする」設計。これを無視すると初期値リセットが効かない可能性。

### 案2: UIElement側でanywidgetを特別扱い（リスク: 低）

`ui-element.ts`の`attributeChangedCallback`で、anywidgetの場合は`random-id`変更を無視する。

```typescript
attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null) {
  // anywidgetの場合はrandom-id変更を無視
  const isAnyWidget = this.querySelector("marimo-anywidget") !== null;
  if (isAnyWidget && name === "random-id") {
    console.log("[UIElement] Skipping re-render for anywidget");
    return;
  }
  // ... 既存コード
}
```

### 案3: Python側でanywidgetのrandom_idを安定化（リスク: 低）

`from_anywidget.py`で、同じESMハッシュなら同じ`random_id`を返すようにキャッシュ。

```python
# from_anywidget.py に追加
_random_id_cache: dict[str, str] = {}

def get_stable_random_id(js_hash: str) -> str:
    if js_hash not in _random_id_cache:
        _random_id_cache[js_hash] = str(uuid.uuid4())
    return _random_id_cache[js_hash]
```

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| `frontend/src/plugins/impl/anywidget/AnyWidgetPlugin.tsx` | anywidgetのReactコンポーネント、キー生成 |
| `frontend/src/core/dom/ui-element.ts` | UIElement Web Component、random-id監視 |
| `marimo/_plugins/ui/_core/ui_element.py` | Python UIElement基底クラス、random_id生成 |
| `marimo/_plugins/ui/_impl/from_anywidget.py` | anywidgetラッパー |
| `marimo/_runtime/virtual_file/virtual_file.py` | ランダムファイル名生成 |

## 分析ドキュメント

- `chart-flickering-analysis.md` - 根本原因の詳細分析
- `chart-flickering-fix-plan.md` - 改修プラン一覧

## テスト用ファイル

- `C:\Users\sasai\AppData\Local\Temp\fintech1.py` - 問題が再現するサンプル

---

## 期待する結果

1. ログから再マウントの真の原因を特定
2. 適切な修正案を選択して実装
3. 100ms更新でもチャートがチカチカしない
