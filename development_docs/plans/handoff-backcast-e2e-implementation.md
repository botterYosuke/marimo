# 作業依頼：backcast.py統合E2Eテストの実装

**作成日**: 2026-02-20
**優先度**: 中
**推定時間**: 2-3時間

---

## 🎯 作業の目的

実際のゲームファイル（backcast.py）を使った統合E2Eテストを新規作成してください。

**背景**:
手動プレイテスト（`.claude/plans/my-game-play-report.md`参照）で複数のバグと改善点が発見されました。これらを自動テストで継続的に検証できるようにします。

---

## 📋 作業内容

### 新規ファイル作成

**ファイルパス**: `frontend/e2e-tests/game/backcast-integration.spec.ts`

### 実装すべきテストケース

#### 1. 基本フロー（auto_instantiate環境）
```typescript
test("backcast.py完全プレイフロー", async ({ page }) => {
  // backcast.pyを開く（auto_instantiate=trueで既存セルが自動実行）
  // SANDBOX_001, BRIDGE_002が自動取得されることを確認
  // 残りのスキルを順次取得
});
```

#### 2. SANDBOX_003取得条件の検証（重要）
```typescript
test("SANDBOX_003はstep()後のtrades()で取得される", async ({ page }) => {
  // game_setup.pyの条件: len(bt.trades) > 0（注文が決済されないとbt.tradesは空）
  // bt.buy() → bt.trades()        → スキル発火しない（len=0）
  // bt.buy() → bt.step() → bt.trades() → SANDBOX_003発火 ✓
  // backcast.pyには cell 9(step)→cell 10(buy)→cell 11(step)→cell 12(trades) の順で既に配置済み
});
```

#### 3. 発見されたバグの再現テスト
```typescript
test("BRIDGE_001がフロントエンドでカウントされない問題", async ({ page }) => {
  // bt.reveal_data() → コンソール: "[SkillHandler] Received skill event: BRIDGE_001" 確認
  // スキルツリーでカウント未反映を検証（BRIDGE_001は青点線=未完了のまま）
  // 期待値: 8/59（SANDBOX_001-006 + BRIDGE_002 + BRIDGE_003）、BRIDGE_001は含まれない
  // 正常なら9/59になるべき箇所
});

test("Position表示が[object Object]になる問題", async ({ page }) => {
  // bt.buy() → Position表示を確認
  // "[object Object] shares"と表示されることを検証
});
```

#### 4. スキル重複発火の検証
```typescript
test("SANDBOX_005が重複送信される（バグ確認）", async ({ page }) => {
  // コンソールログを監視
  // 現在のバグ: SANDBOX_005が2回記録される
  // 原因: backcast.pyに bt.chart("7203") セルが複数存在し、marimoのリアクティブ実行で再実行される
  // バグ修正後は expect(consoleLogs.length).toBe(1) に変更
});
```

---

## 📚 参照ドキュメント

### 必読
1. **`.claude/plans/my-game-play-report.md`** - 手動プレイテストの結果、発見されたバグ
2. **`frontend/e2e-tests/game/helpers.ts`** - E2Eヘルパー関数
3. **`frontend/e2e-tests/game/sandbox.spec.ts`** - 既存テストの参考実装

### 参考
- **`docs/game-guide.md`** - ゲーム仕様
- **`development_docs/game-e2e-review-system.md`** - E2Eテストシステム
- **`C:\Users\sasac\AppData\Roaming\marimo\notebooks\game_setup.py`** - ゲームロジック

---

## 🔧 実装のポイント

### backcast.pyの使用方法

```typescript
const BACKCAST_PATH = "C:\\Users\\sasac\\AppData\\Roaming\\marimo\\notebooks\\backcast.py";

test.beforeEach(async ({ page }) => {
  await page.goto(`http://localhost:2718/?file=${encodeURIComponent(BACKCAST_PATH)}`);
  await page.waitForLoadState("load");
  await ensureConnected(page);
  // ⚠️ resetGameProgressはフロントエンドのJotai atomのみリセット
  // PythonバックエンドのinメモリセットN_triggered_skillsはリセットされない
  // バックエンドも含む完全リセットにはpage.reload()が必要（ただしWebSocket再接続コストあり）
  await resetGameProgress(page);

  // auto_instantiate=trueの影響を待つ
  await page.waitForTimeout(2000);
});
```

### 既存セルの実行

backcast.pyには既にセルが存在します（bt.chart, bt.buy等）。これらを実行する方法：

```typescript
// 方法1: 既存セルのrunボタンをクリック
// ⚠️ gridレイアウトでは[data-testid="cell"]は存在しない
// セルはreact-flowノード（[data-testid="rf__node-{id}"]）内に配置されているため
// cell-editorからdata-id属性を辿ってrf__nodeを特定する必要がある
const cellEditor = page.locator('[data-testid="cell-editor"]')
  .filter({ hasText: 'bt.buy()' }).first();
const rfNodeId = await cellEditor.evaluate((el: Element) => {
  let node: Element | null = el;
  while (node && !(node as HTMLElement).dataset?.id) node = node.parentElement;
  return (node as HTMLElement)?.dataset?.id ?? null;
});
const rfNode = page.locator(`[data-testid="rf__node-${rfNodeId}"]`);
await rfNode.locator('[data-testid="run-button"]').click({ force: true });

// 方法2: 新セルを追加して実行（helpers.tsのrunNewCellInGrid使用）
// gridレイアウトでは"Python"ボタンでセル追加、.cm-content.last()でフォーカス、force:trueで実行
await runNewCellInGrid(page, 'bt.step()');
```

### auto_instantiateの考慮

ファイルを開くと既存セル（bt.chart）が自動実行され、以下のスキルが自動取得されます：
- SANDBOX_001（chart呼び出し）
- BRIDGE_002（`bt.chart()`は内部でgame_setupラッパーの`get_stock_daily()`を呼ぶため、chart実行だけでBRIDGE_002も完了）
- BRIDGE_003（BRIDGE_002完了時点で`_check_graduations()`が自動発火）

**テスト開始時の初期完了状態: {SANDBOX_001, BRIDGE_002, BRIDGE_003}（`getCompletedCount(page)`で3相当）**

ブラウザの初期化完了前にスキルイベントが発火すると、フロントエンドで受信されない可能性があります。`waitForTimeout(2000)`はこのタイミング問題への対処です。

---

## 🐛 検証すべきバグ

### バグ1: SANDBOX_003の取得条件が直感に反する（ドキュメント不備）
- **現象**: bt.buy() → bt.trades()でスキル発火しない
- **原因**: `game_setup.py`内の条件 `len(bt.trades) > 0` により、`bt.step()`で時間を進めて注文を決済しないと`bt.trades`が空になる
- **正しいシーケンス**: `bt.buy()` → `bt.step()` → `bt.trades()`（backcast.pyにはcell 10-12として配置済み）
- **テスト**: step()前後のbt.trades()でスキル発火の有無を検証

### バグ2: BRIDGE_001がフロントエンドでカウントされない
- **現象**: `emit_skill("BRIDGE_001")`は発火し、コンソールに`[SkillHandler] Received skill event: BRIDGE_001`が出力されるが、スキルツリーのカウントが増えない（8/59のまま、BRIDGE_001ノードは青点線=未完了）
- **テスト**: bt.reveal_data() → `getCompletedCount(page)` が9ではなく8のまま → `getSkillStatus(page, "BRIDGE_001")` が`"completed"`ではなく`"unlocked"`のまま

### バグ3: Position表示バグ
- **現象**: "[object Object] shares"と表示
- **テスト**: UI要素のテキストを検証

### バグ4: SANDBOX_005重複送信
- **現象**: `[SkillHandler] Received skill event: SANDBOX_005`がコンソールに2回記録
- **推測原因**: backcast.pyに`bt.chart("7203")`セルが複数存在し、marimoのリアクティブ実行で複数セルが同時に再実行される。`emit_skill()`内の`_triggered_skills`dedupは機能しているが、BroadcastChannelの受信側で重複が発生する可能性あり
- **テスト**: コンソールログを監視して重複を検出（**現状は2回が期待値**、バグ修正後は1回になる）

---

## 📝 進捗報告

作業中は **`.claude/plans/my-game-play-report.md`** に以下を記録してください：

### 記録内容
1. ✅ 完了した作業項目にチェック
2. 🐛 新たに発見したバグ
3. 💡 設計思想・実装の背景
4. 📌 Tips・トラブルシューティング

---

## ✅ 完了条件

- [x] `backcast-integration.spec.ts`を作成
- [x] 最低5つのテストケースを実装（6テスト実装済み）
  - [x] 完全プレイフロー
  - [x] SANDBOX_003取得条件
  - [x] BRIDGE_001カウント問題
  - [x] Position表示バグ
  - [x] スキル重複発火
  - [x] セル構造確認（追加）
- [x] 全テストがパスする（6/6 passed, 2.9m）
- [x] `.claude/plans/my-game-play-report.md`に進捗記録
- [ ] 新たな知見があれば`development_docs/game-e2e-review-system.md`に追加

---

## 🚀 テスト実行方法

```bash
# 実装したテストを実行
cd /d/Documents/marimo/frontend
pnpm test:e2e e2e-tests/game/backcast-integration.spec.ts

# デバッグモード
pnpm test:e2e e2e-tests/game/backcast-integration.spec.ts --debug

# ヘッドフルモード（ブラウザ表示）
pnpm test:e2e e2e-tests/game/backcast-integration.spec.ts --headed
```

---

## 💡 追加情報

### ヘルパー関数の活用

`helpers.ts`には以下が用意されています：

**接続・UI操作**
- `ensureConnected(page)` - カーネル接続確認 + Reconnectedバナーを自動dismiss
- `dismissReconnectedBanner(page)` - Reconnectedバナーを閉じる
- `openSkillTreePanel(page)` - スキルツリーパネルを開く（ダイアログ形式）

**スキルイベント送信（テストモード）**
- `emitSkillEvent(context, page, skillId)` - `__testCompleteSkill`経由（フロントエンドのみ、高速）
- `emitSkillEventViaHTML(page, skillId)` - HTMLパイプライン経由（BroadcastChannelを通過、本番に近い）
- `emitSkillViaPython(page, skillId)` - Pythonセル実行経由（フルパイプライン、最も本番に近い）

**スキル状態確認**
- `getSkillNodeLocator(page, skillId)` - `[data-skill-id]`属性でLocatorを返す
- `getSkillStatus(page, skillId)` → `"completed" | "unlocked" | "locked"` を返す（`data-skill-status`属性から）
- `waitForSkillStatus(page, skillId, status, timeout?)` - スキルが指定ステータスになるまで待機
- `getCompletedCount(page)` - 完了スキル数を数値で返す（"X/59 スキル"バッジから読み取り）

**セル実行**
- `resetGameProgress(page)` - フロントエンドのJotai atomをリセット（⚠️ Pythonバックエンドは非対象）
- `runNewCellInGrid(page, code)` - gridレイアウトでセル追加・実行（"Python"ボタン使用、`force:true`）
- `runNewCell(page, code)` - 通常レイアウト（非grid）でセル追加・実行（`create-cell-button`使用）

### コンソールログの監視

```typescript
const consoleLogs: string[] = [];
page.on('console', msg => {
  if (msg.text().includes('SANDBOX_005')) {
    consoleLogs.push(msg.text());
  }
});

// 後でアサーション（現在のバグ: 2回が期待値）
expect(consoleLogs.length).toBe(2); // SANDBOX_005重複バグの確認
// バグ修正後: expect(consoleLogs.length).toBe(1);
```

---

**質問や不明点があれば、`.claude/plans/my-game-play-report.md`にメモして進めてください。**
