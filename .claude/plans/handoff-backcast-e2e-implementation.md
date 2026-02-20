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
  // bt.buy() → bt.trades() → スキル発火しない
  // bt.step() → bt.trades() → SANDBOX_003発火 ✓
});
```

#### 3. 発見されたバグの再現テスト
```typescript
test("BRIDGE_001がフロントエンドでカウントされない問題", async ({ page }) => {
  // bt.reveal_data() → コンソールで発火確認
  // スキルツリーでカウント未反映を検証（8/59のまま）
});

test("Position表示が[object Object]になる問題", async ({ page }) => {
  // bt.buy() → Position表示を確認
  // "[object Object] shares"と表示されることを検証
});
```

#### 4. スキル重複発火の検証
```typescript
test("SANDBOX_005が重複送信されない", async ({ page }) => {
  // コンソールログを監視
  // SANDBOX_005が1回のみ発火することを確認
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
- **`d:\Documents\marimo\src-tauri\sample-notebooks\game_setup.py`** - ゲームロジック

---

## 🔧 実装のポイント

### backcast.pyの使用方法

```typescript
const BACKCAST_PATH = "C:\\Users\\sasac\\AppData\\Roaming\\marimo\\notebooks\\backcast.py";

test.beforeEach(async ({ page }) => {
  await page.goto(`http://localhost:2718/?file=${encodeURIComponent(BACKCAST_PATH)}`);
  await page.waitForLoadState("load");
  await ensureConnected(page);
  await resetGameProgress(page);

  // auto_instantiate=trueの影響を待つ
  await page.waitForTimeout(2000);
});
```

### 既存セルの実行

backcast.pyには既にセルが存在します（bt.chart, bt.buy等）。これらを実行する方法：

```typescript
// 方法1: 既存セルのrunボタンをクリック
const cells = page.locator('[data-testid="cell"]');
const targetCell = cells.filter({ hasText: 'bt.buy()' });
await targetCell.locator('[data-testid="run-button"]').click({ force: true });

// 方法2: 新セルを追加して実行（helpers.tsのrunNewCellInGrid使用）
await runNewCellInGrid(page, 'bt.step()');
```

### auto_instantiateの考慮

ファイルを開くと既存セル（bt.chart）が自動実行され、以下のスキルが自動取得されます：
- SANDBOX_001（chart呼び出し）
- BRIDGE_002（chart内部でget_stock_daily呼び出し）

テストではこの初期状態を考慮してください。

---

## 🐛 検証すべきバグ

### バグ1: SANDBOX_003の条件が不明確
- **現象**: bt.buy() → bt.trades()でスキル発火しない
- **原因**: len(bt.trades) == 0（step()で時間を進めないと取引が決済されない）
- **テスト**: step()の有無でスキル発火を検証

### バグ2: BRIDGE_001がカウントされない
- **現象**: emit_skill("BRIDGE_001")は発火するがスキルツリーで未カウント
- **テスト**: bt.reveal_data() → スキルカウントが8/59のまま

### バグ3: Position表示バグ
- **現象**: "[object Object] shares"と表示
- **テスト**: UI要素のテキストを検証

### バグ4: SANDBOX_005重複送信
- **現象**: コンソールに2回記録
- **テスト**: コンソールログを監視して重複検出

---

## 📝 進捗報告

作業中は **`.claude/plans/backcast-game-play.md`** に以下を記録してください：

### 記録内容
1. ✅ 完了した作業項目にチェック
2. 🐛 新たに発見したバグ
3. 💡 設計思想・実装の背景
4. 📌 Tips・トラブルシューティング

### 記録例
```markdown
#### ✅ backcast-integration.spec.ts実装完了（2026-02-20 15:00）
- 実装したテストケース: 7個
- 発見した新たな問題:
  - auto_instantiate環境でのタイミング問題（待機時間を2秒に調整）
- 設計思想:
  - 既存のsandbox.spec.tsは単体テスト的、backcast-integrationは統合テスト的
  - 実際のユーザー体験に近い形でテスト
- Tips:
  - backcast.pyのセルを特定する際はhasText()フィルターが有効
```

---

## ✅ 完了条件

- [ ] `backcast-integration.spec.ts`を作成
- [ ] 最低5つのテストケースを実装
  - [ ] 完全プレイフロー
  - [ ] SANDBOX_003取得条件
  - [ ] BRIDGE_001カウント問題
  - [ ] Position表示バグ
  - [ ] スキル重複発火
- [ ] 全テストがパスする（バグ再現テストは失敗が期待値の場合あり）
- [ ] `.claude/plans/backcast-game-play.md`に進捗記録
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
- `ensureConnected(page)` - サーバー接続確認
- `openSkillTreePanel(page)` - スキルツリー開く
- `getSkillStatus(page, skillId)` - スキル状態取得
- `waitForSkillStatus(page, skillId, status)` - スキル状態待機
- `resetGameProgress(page)` - 進捗リセット
- `runNewCellInGrid(page, code)` - gridレイアウトでセル実行
- `dismissReconnectedBanner(page)` - バナー閉じる

### コンソールログの監視

```typescript
const consoleLogs: string[] = [];
page.on('console', msg => {
  if (msg.text().includes('SANDBOX_005')) {
    consoleLogs.push(msg.text());
  }
});

// 後でアサーション
expect(consoleLogs.length).toBe(1); // 重複なし
```

---

## 🔗 関連Issue・PR

- 発見されたバグは別途Issueを作成することを推奨
- このE2Eテスト実装後、バグ修正のPRと合わせてテストを更新

---

**質問や不明点があれば、`.claude/plans/backcast-game-play.md`にメモして進めてください。**
