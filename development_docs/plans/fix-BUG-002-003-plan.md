# BUG-002 / BUG-003 修正計画

## 対象ファイル

- `frontend/e2e-tests/game/guard-validation.spec.ts`

## BUG-002: ポジション保有中の buy() 再呼び出しテスト (line 120-145)

### 症状

`chart("7203")` -> `buy()` -> `buy()` のテストで、完了スキル数が 2 を期待するが 1 を取得。

### 根本原因

BroadcastChannel の非同期配信タイミングとスキル依存関係（prerequisites）に起因するレースコンディション。

**詳細フロー:**

1. `chart("7203")` が `emit_skill("SANDBOX_001")` を発火 -> `mo.output.append()` -> WebSocket -> `extractAndSendBroadcastMessages()` -> `BroadcastChannel.postMessage()`
2. `buy()` (1回目) が `emit_skill("SANDBOX_002")` を発火 -> 同上
3. SANDBOX_002 は `prerequisites: ["SANDBOX_001"]` を持つ
4. BroadcastChannel 配信は非同期（イベントループのマイクロタスクキュー経由）
5. `completeSkillWithRewardAtom` は prerequisites チェックを行い、未達なら pending キューに追加
6. pending キューは他スキル完了時にドレインされる

**問題:** テストは `getCompletedCount(page)` を即座に呼び出し（ポーリングなし）、Jotai atom 更新 -> React 再レンダリング -> DOM 反映のサイクルが完了する前にバッジテキストを読み取ってしまう。

### 修正内容

`expect(count).toBe(2)` を `expect().toPass()` ポーリングパターンに変更:

```typescript
await expect(async () => {
  const count = await getCompletedCount(page);
  expect(count).toBe(2);
}).toPass({ timeout: 10_000 });
```

## BUG-003: ポジションなしで sell() を呼ぶと警告メッセージが表示されない (line 151-175)

### 症状

`chart("7203")` -> `sell()` のテストで、`text=/保有中の株がありません/` ロケーターが DOM 内に見つからない。

### 根本原因

marimo の callout プラグイン（`<marimo-callout-output>`）は Web Components + Shadow DOM でレンダリングされる。`registerReactComponent.tsx` で `attachShadow({ mode: "open" })` を使用してオープンシャドウルートを作成する。

Playwright の `text=/regex/` ロケーターはオープンシャドウルートをピアスするが、正規表現マッチングとシャドウ DOM 内テキストの組み合わせで検出に失敗するケースがある。

**Python 側の出力:**
```python
mo.output.append(mo.callout(
    mo.md("保有中の株がありません。まず `bt.buy()` で株を購入してください"),
    kind="warn",
))
```

**DOM 構造:**
```
<marimo-callout-output data-initial-value="...">
  #shadow-root (open)
    <div class="callout warn">
      <p>保有中の株がありません。まず <code>bt.buy()</code> で株を購入してください</p>
    </div>
</marimo-callout-output>
```

### 修正内容

1. `page.locator("text=/保有中の株がありません/")` を `page.getByText("保有中の株がありません")` に変更。`getByText()` はシャドウ DOM を確実にピアスする。

2. タイムアウトを 5_000ms から 10_000ms に延長（セル実行 + WebSocket 配信 + React レンダリング + Shadow DOM 構築の全サイクルを考慮）。

3. スキル数チェックも `expect().toPass()` ポーリングパターンに変更。

```typescript
await expect(
  page.getByText("保有中の株がありません").first(),
).toBeVisible({
  timeout: 10_000,
});

await expect(async () => {
  const count = await getCompletedCount(page);
  expect(count).toBe(1);
}).toPass({ timeout: 10_000 });
```

## 追加修正（予防的）

テスト 1（データなしで buy() を呼ぶ）のロケーターも同様に `getByText()` に統一:

```typescript
// Before: page.locator("text=/まず.*bt.chart/")
// After:  page.getByText("bt.chart")
```

## 全テストに共通する修正パターン

| テスト | ロケーター修正 | カウントチェック修正 |
|--------|----------------|---------------------|
| 1. データなし buy() | `text=` -> `getByText()` | なし（count=0 は即座に確定） |
| 2. 二重 buy() | `text=` -> `getByText()` | 即時 -> `toPass()` ポーリング |
| 3. ポジションなし sell() | `text=` -> `getByText()` | 即時 -> `toPass()` ポーリング |

## 技術的知見

### BroadcastChannel パイプライン

```
Python emit_skill()
  -> mo.output.append(Html(<marimo-broadcast>))
  -> WebSocket cell-op message
  -> handleCellNotificationeration()
  -> extractAndSendBroadcastMessages() [HTML パース]
  -> sendBroadcastMessage() [BroadcastChannel.postMessage()]
  -> async delivery to listener
  -> setupSkillEventListener.handleMessage()
  -> onSkillComplete callback
  -> set(completeSkillWithRewardAtom, skillId)
  -> Jotai atom update
  -> React re-render
  -> DOM 更新
```

### mo.output.append() の蓄積動作

各 `mo.output.append()` 呼び出しは `ctx.execution_context.output` リストに追加し、`vstack(accumulated_output)` として全蓄積出力を WebSocket で即座に送信する。後続の `append()` は前回の出力を含む完全な vstack を再送する。

### completeSkillWithRewardAtom の pending キュー

prerequisites 未達のスキルは `pendingSkillsAtom` に追加され、他スキルの完了時に自動リトライされる。これにより SANDBOX_001 -> SANDBOX_002 の順序依存は解決されるが、全体のパイプラインが非同期であるためテスト側でのポーリングが必要。
