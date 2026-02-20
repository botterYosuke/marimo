# 作業依頼: marimoゲーム（Backcast）を実際にプレイしてください

**作成日**: 2026-02-20（v4 — Session 2 の実プレイ結果で更新）

> **v3 からの主な変更**
> - サンプル版 backcast.py は `auto_instantiate` なし → セルは手動実行が必要
> - backcast.py の既存セルは3つのみ → 新しいセルを追加して実行
> - SANDBOX_003: `bt.step()` 不要、`bt.trades()` を呼ぶだけで即発火
> - 全3バグ（BRIDGE_001未カウント・Position表示・SANDBOX_005重複）が修正済み
> - 到達可能スキル数: **9/59**（従来の 8/59 から更新）
> - ゲームリセット時は `.backcast.progress.json` の削除が必須

---

## 🎯 目的

backcast.py のゲームシステムを実際にプレイし、スキルツリーの動作を確認する。
発見したバグ・知見はレポートとして記録する。

**ゲームファイル**: `C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py`

---

## 📋 作業手順

### ステップ1: レポートファイルの作成

最初に `D:\Documents\marimo\.claude\plans\my-game-play-report3.md` を作成してください。
作業中に随時更新します。

記録する内容：
- ✅/⬜ 各作業項目の完了状態
- 📝 各ステップの実行ログ（コード・結果・発火したスキル）
- 💡 発見したバグ・知見
- 🔧 Tips・トラブルシューティング

---

### ステップ2: 環境準備

#### 2.1 ゲームリセット（重要）

前回のセッションの進捗が残っているとスキルが発火しません。**必ず以下を実行**してください。

```bash
# 1. サンプルノートブックをコピー（ゲームファイルをリセット）
cp /c/Users/sasac/AppData/Roaming/marimo/notebooks/  # 確認
cp /d/Documents/marimo/src-tauri/sample-notebooks/*.py /c/Users/sasac/AppData/Roaming/marimo/notebooks/

# 2. 進捗ファイルを削除（★最重要★ これを忘れるとスキルが発火しない）
rm "/c/Users/sasac/AppData/Roaming/marimo/notebooks/.backcast.progress.json"
```

> **なぜ進捗ファイルの削除が必要か**
> `skill_events.py` はモジュールロード時に `.backcast.progress.json` を読み込み、
> `_triggered_skills` セットを初期化します。ファイルが残っていると前回のスキルが
> 「発火済み」扱いになり、`emit_skill()` が dedup で弾かれます。

#### 2.2 marimoサーバーの起動

```bash
cd /d/Documents/marimo
pnpm dev
```

バックグラウンド起動して次の操作に進んでも構いません。

#### 2.3 backcast.pyを開く

Playwright で以下の URL を開きます：

```
http://localhost:2718/?file=C%3A%5CUsers%5Csasac%5CAppData%5CRoaming%5Cmarimo%5Cnotebooks%5Cbackcast.py
```

> ⚠️ `http://localhost:2718/home` は 404 になります。上記 URL を直接使用してください。

#### 2.4 接続確認とカーネル再起動

```javascript
// Playwright で実行する接続待機コード
await page.waitForSelector('[data-testid="backend-status"]', { timeout: 30000 });

// "Reconnected" バナーが出た場合は Restart でカーネルを再起動する
// （カーネルがメモリ上に古い _triggered_skills を持っている可能性があるため）
const reconnectBanner = page.locator('text=Reconnected');
if (await reconnectBanner.isVisible().catch(() => false)) {
  // "Restart" ボタンをクリック → "Confirm Restart" をクリック
}
```

---

### ステップ3: ゲームプレイ

#### 3.1 重要な前提知識

**サンプル版 backcast.py の構成**（3セルのみ）:

| セル | 内容 |
|------|------|
| cell-1 | ウェルカムメッセージ（markdown） |
| cell-2 | `bt.chart("7203")` |
| cell-3 | コメントのみ（プレイスホルダー） |

`auto_instantiate=True` は**ありません**。**cell-2 を手動で実行**するところから始まります。

ゲームの操作はすべて **新しいセルを追加して実行** します（既存セルに書かれていない）。

#### 3.2 セルの追加と実行方法

**有効なパターン（実証済み）**:

```javascript
// Playwright での新規セル追加→コード入力→実行
async function addAndRunCell(page, code) {
  // 1. Python ボタンで新規セル追加
  await page.getByRole('button', { name: 'Python', exact: true }).click();
  await page.waitForTimeout(800);

  // 2. 最後の textbox にコードを入力
  const textboxes = page.locator('[role="textbox"]');
  const count = await textboxes.count();
  const lastTextbox = textboxes.nth(count - 1);
  await lastTextbox.click();
  await lastTextbox.fill(code);
  await page.waitForTimeout(300);

  // 3. Ctrl+Enter で実行（grid レイアウトでも有効）
  await page.keyboard.press('Control+Enter');
  await page.waitForTimeout(2000);  // スキルイベント処理待ち

  // 4. トースト通知を閉じる（UI を遮らないよう）
  const closeButtons = page.locator(
    '[role="region"][aria-label="Notifications (F8)"] button'
  );
  const btnCount = await closeButtons.count();
  for (let i = 0; i < btnCount; i++) {
    await closeButtons.first().click().catch(() => {});
    await page.waitForTimeout(300);
  }

  // 5. スキルツリーが自動で開いた場合は閉じる
  const closeDialog = page.getByRole('button', { name: 'Close', exact: true });
  if (await closeDialog.isVisible().catch(() => false)) {
    await closeDialog.click();
    await page.waitForTimeout(500);
  }
}
```

#### 3.3 スキル取得シーケンス（実証済み）

**まず cell-2（bt.chart）を手動実行**してから、以下の順で新規セルを追加・実行します。

| ステップ | コード | 期待されるスキル | コンソール確認 |
|---------|--------|----------------|--------------|
| cell-2 を実行 | `bt.chart("7203")` | **SANDBOX_001** ✓ | `[SkillHandler] Received skill event: SANDBOX_001` |
| 新規セル追加 | `bt.buy()` | **SANDBOX_002** ✓ | `[SkillHandler] Received skill event: SANDBOX_002` |
| 新規セル追加 | `bt.trades()` | **SANDBOX_003** ✓（空リストでも発火！） | `[SkillHandler] Received skill event: SANDBOX_003` |
| 新規セル追加 | `bt.sell()` | **SANDBOX_004** ✓ | `[SkillHandler] Received skill event: SANDBOX_004` |
| 新規セル追加 | `bt.chart("7203")` | **SANDBOX_005** ✓ + **SANDBOX_006** ✓（自動） | 3つの SANDBOX_ イベント |
| 新規セル追加 | `bt.reveal_data()` | **BRIDGE_001** ✓ | `[SkillHandler] Received skill event: BRIDGE_001` |
| 新規セル追加 | `bt.get_stock_daily("7203")` | **BRIDGE_002** ✓ + **BRIDGE_003** ✓（自動） | BRIDGE_ イベント×3 |

**期待される最終スコア**: 9/59 スキル、Equity ¥310,000

#### 3.4 スキル発火タイミングの詳細

- **SANDBOX_001**: `bt.chart()` を呼ぶと発火（何度でも呼べるが dedup で1回のみ）
- **SANDBOX_002**: `bt.buy()` を呼ぶと発火
- **SANDBOX_003**: `bt.trades()` を呼ぶと発火（**`bt.step()` は不要**、空リストでもOK）
- **SANDBOX_004**: `bt.sell()` を呼ぶと発火
- **SANDBOX_005**: SANDBOX_003 と SANDBOX_004 が両方完了後に `bt.chart()` を呼ぶと発火
- **SANDBOX_006**: SANDBOX_001〜005 の5個完了で**自動発火**
- **BRIDGE_001**: SANDBOX_006 完了後に `bt.reveal_data()` を呼ぶと発火
- **BRIDGE_002**: `bt.get_stock_daily()` を呼ぶと発火（`bt.chart()` 経由では発火しない）
- **BRIDGE_003**: BRIDGE_002 完了時に**自動発火**

---

### ステップ4: 確認・レポート作成

#### 4.1 スキルツリーの確認

```javascript
// スキルツリーボタンをクリック
await page.locator('[data-testid="skill-tree-button"]').click();
await page.waitForTimeout(1000);

// スキル数を取得
const dialog = page.locator('[role="dialog"]');
const text = await dialog.textContent();
const count = text.match(/(\d+)\/59 スキル/)?.[1];
console.log(`スキル数: ${count}/59`);
```

#### 4.2 スクリーンショット撮影

```javascript
// ゲーム画面
await page.screenshot({ path: 'game-final-state.png' });

// スキルツリー（ダイアログが開いた状態で撮影）
await page.screenshot({ path: 'skill-tree-final.png' });
```

#### 4.3 体験レポートをレポートファイルに記載

以下の観点でレポートを作成する：
- 各スキルが期待通りのタイミングで発火したか
- UIフィードバック（トースト通知、スキルツリー更新）は正常か
- 新たに発見したバグ・改善提案
- v3 時点の情報との差分

---

## ⚠️ 重要な注意点

### gridレイアウトでのセル操作

backcast.py は `app = marimo.App(width="grid")` のため、セルは react-flow ノード内に配置されています。

- `[data-testid="cell"]` は**存在しない**
- **有効な操作**: textbox を `click()` → `fill()` → `Ctrl+Enter`
- `[data-testid="rf__node-{id}"]` からの run-button クリックも可能だが、Ctrl+Enter の方がシンプル
- トースト通知がセル上に重なることがある → 出たら閉じる

### よくある落とし穴

| 落とし穴 | 対処法 |
|---------|--------|
| スキルが一切発火しない | `.backcast.progress.json` を削除してカーネル再起動 |
| run ボタンクリックで cell options ダイアログが開く | Escape で閉じて `Ctrl+Enter` を使う |
| 新規セルの textbox が見つからない | `page.locator('[role="textbox"]').last()` で最後の textbox を取得 |
| `Cell ID null cannot be found` 警告 | 無視して良い（既知の軽微な問題、スキル発火に影響なし） |
| スキルツリーが自動で開く | `page.getByRole('button', { name: 'Close', exact: true }).click()` で閉じる |

---

## ✅ 修正済みバグ（v3 に記載されていたが既に解消）

| バグ名 | 修正内容 |
|--------|---------|
| ~~BRIDGE_001 未カウント~~ | `pendingSkillsAtom` による保留キュー機構で修正済み |
| ~~Position表示バグ~~ | `headless_broadcast.py` + `backtest-hud.tsx` で型安全変換を追加 |
| ~~SANDBOX_005 重複送信~~ | `chart()` に `"SANDBOX_005" not in s` ガードを追加 |

詳細は `development_docs/issues/` を参照。

---

## 📚 参考ドキュメント

1. **`docs/game-guide.md`** - ゲームの概要
2. **`development_docs/game-e2e-review-system.md`** - E2Eテストと知見
3. **`C:\Users\sasac\AppData\Roaming\marimo\notebooks\game_setup.py`** - ゲームロジック（スキル発火条件）
4. **`development_docs/issues/`** - 既知バグとその修正内容
5. **`frontend/e2e-tests/game/helpers.ts`** - Playwright ヘルパー関数（`runNewCellInGrid` など）

---

## ✅ 期待される成果物

1. **`D:\Documents\marimo\.claude\plans\my-game-play-report3.md`**
   - 全ステップの実行ログ
   - 発見したバグ・知見・改善提案

2. **スクリーンショット**（ゲーム最終画面、スキルツリー最終状態）

3. **スキル獲得確認**
   - 目標スキル数: **9/59**
   - SANDBOX_001〜006（6個）+ BRIDGE_001〜003（3個）が完了状態
   - Equity: **¥310,000**
