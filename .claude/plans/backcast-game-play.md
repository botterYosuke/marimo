# Plan: marimoゲーム（Backcast）実プレイ

**作成日**: 2026-02-20
**目的**: Playwrightを使ってbackcast.pyゲームを実際にプレイし、スキルツリーシステムの動作を確認する

---

## 📋 作業項目

### 1. 環境準備

#### 初回セットアップ（まだ実行していない場合）
```bash
cd /d/Documents/marimo

# Windows環境でのセットアップ
pnpm run setup:win
# または
# pnpm install && pnpm build:fe && pnpm build:lsp && pnpm download:uv
```

#### marimoサーバー起動
- [x] **方法1: pnpmコマンド（推奨）**
  ```bash
  cd /d/Documents/marimo
  pnpm dev
  # ↑ バックエンド（port 2718）とフロントエンド（port 3000）が起動
  ```

- [ ] **方法2: makeコマンド（pixiが利用可能な場合）**
  ```bash
  pixi shell
  make dev
  ```

- [ ] **方法3: 直接Pythonで起動**
  ```bash
  cd /d/Documents/marimo
  python -m marimo edit --no-token --port 2718 "C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py"
  ```

- [ ] **確認: サーバーが起動していることを確認**
  - http://localhost:2718 (backend) にアクセス可能
  - http://localhost:3000 (frontend, pnpm devの場合) にアクセス可能
- [ ] **backcast.pyファイルの配置確認**
  - パス: `C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py`
  - 存在確認: `ls "C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py"`
- [ ] **Playwrightでbackcast.py開く**
  - URL: `http://localhost:2718/?file=C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py`
  - または: `http://localhost:2718/home` から手動でbackcast.pyを開く
- [ ] **サーバー接続確認（kernel healthy）**
  - backend-statusボタンが緑色（healthy）になることを確認
  - "Reconnected"バナーが出たら閉じる

### 2. ゲームプレイ（サンドボックスモード）
- [ ] SANDBOX_001: `bt.chart("7203")` - チャート表示
- [ ] SANDBOX_002: `bt.buy()` - 株購入
- [ ] SANDBOX_003: `bt.trades()` - 保有株確認
- [ ] SANDBOX_004: `bt.sell()` - 株売却
- [ ] SANDBOX_005: `bt.chart("7203")` (2回目) - チャート再表示
- [ ] SANDBOX_006: (自動発火) - サンドボックス完了

### 3. ゲームプレイ（ブリッジモード）
- [ ] BRIDGE_001: `bt.reveal_data()` - データ詳細確認
- [ ] BRIDGE_002: `bt.get_stock_daily("7203")` - データ取得
- [ ] BRIDGE_003: (自動発火) - ブリッジ完了

### 4. 進捗確認・レポート作成
- [ ] スキルツリーパネル開く
- [ ] 完了スキル数確認（9個以上）
- [ ] スクリーンショット撮影
- [ ] 体験レポート作成

---

## 🎮 ゲーム概要

**Backcast** = トヨタ自動車（7203）の株価を使った投資シミュレーション

### ゲームファイル
- **プレイファイル**: `C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py`
- **ゲームロジック**: `d:\Documents\marimo\src-tauri\sample-notebooks\game_setup.py`
- **スキル発火**: `d:\Documents\marimo\src-tauri\sample-notebooks\skill_events.py`

### スキルツリー構造
- **Sandbox Mode**: 基本操作（6スキル: SANDBOX_001〜006）
- **Bridge Mode**: 内部仕組み理解（3スキル: BRIDGE_001〜003）
- **Full Mode**: 全機能解禁

### 操作方法
| コマンド | 説明 |
|---------|------|
| `bt.chart(code)` | 銘柄チャート表示 |
| `bt.buy()` | 株購入 |
| `bt.sell()` | 株売却 |
| `bt.step()` | 次の日に進む |
| `bt.trades()` | 保有株確認 |
| `bt.reveal_data()` | データの正体確認 |
| `bt.get_stock_daily(code)` | 株価データ取得 |

---

## 🏗️ 技術的背景

### スキル発火の仕組み

```
① Python: emit_skill("SANDBOX_001")
   ↓
② HTML生成: <marimo-broadcast channel="skill_event_channel"
              type="skill_complete"
              payload="base64_encoded_json" />
   ↓
③ HTML パース: extractAndSendBroadcastMessages()
   ↓
④ BroadcastChannel: sendBroadcastMessage()
   ↓
⑤ Listener: setupSkillEventListener()
   ↓
⑥ Atom更新: completeSkillWithRewardAtom
   ↓
⑦ UI反映: スキルノード更新、報酬トースト表示
```

### E2Eテスト参考
- `frontend/e2e-tests/game/helpers.ts`: ヘルパー関数
  - `ensureConnected()`: サーバー接続確認
  - `runNewCellInGrid()`: gridレイアウトでセル実行
  - `openSkillTreePanel()`: スキルツリー開く
  - `getSkillStatus()`: スキル状態確認
  - `dismissReconnectedBanner()`: バナー閉じる
- `frontend/e2e-tests/game/sandbox.spec.ts`: サンドボックステスト例

---

## 💡 重要な設計思想

1. **BroadcastChannel**: Pythonからのイベントをフロントエンドに伝える
2. **Jotai Atoms**: スキル進捗を状態管理（`playerProgressAtom`）
3. **Grid Layout**: backcast.pyは`app = marimo.App(width="grid")`で定義
4. **スキルゲーティング**: 特定スキル完了まで一部機能をロック

---

## 📝 進捗ログ

### 開始時刻
2026-02-20 (実行中)

### 実行ログ

#### ❌ サーバー起動の試行（失敗）
- **問題**: bashサブシェル環境で`pixi`コマンドがPATHに存在しない
- **試行したコマンド**:
  - `pixi run marimo edit ...` (バックグラウンド) → `nohup: failed to run command 'pixi': No such file or directory`
  - `timeout ... pixi run marimo edit ...` → 同様のエラー
- **原因**: nohup/timeout環境ではPATH環境変数が引き継がれない
- **対策**: ユーザーが別ターミナルで手動起動するか、既存のE2Eテスト環境を使用

#### ✅ プロセスクリーンアップ完了
- 起動を試みたすべてのプロセスを停止
- `pkill -f "marimo edit"` で確認済み（プロセスなし）

#### ✅ game-e2eスキル実行完了（2026-02-20）
- 実行時刻: 2026-02-20
- 結果: 全10テスト成功（3.1m）
- 発見したバグ:
  1. `waitForLoadState("networkidle")` タイムアウト — marimo は WebSocket 常時接続のため networkidle 到達不能 → `"load"` に変更
  2. 再接続スキル再発火 — ensureConnected() 後にカーネルがセル出力を再送し初期状態が汚染 → beforeEach で ensureConnected() 後に resetGameProgress() を追加
- 修正ファイル: `frontend/e2e-tests/game/sandbox.spec.ts`
- 知見更新: `development_docs/game-e2e-review-system.md` 知見 35 追加

---

## 🔧 Playwright操作の実装例

### ステップ1: ブラウザ起動とファイルオープン

```typescript
// Playwrightでbackcast.pyを開く
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

// backcast.pyを開く（URLエンコード必要）
const filePath = "C:\\Users\\sasac\\AppData\\Roaming\\marimo\\notebooks\\backcast.py";
await page.goto(`http://localhost:2718/?file=${encodeURIComponent(filePath)}`);

// カーネルがhealthyになるまで待機
await page.locator('[data-testid="backend-status"]').waitFor({ timeout: 20000 });
await page.waitForTimeout(2000); // 安定化待機

// Reconnectedバナーを閉じる（出た場合）
const reconnectedBanner = page.locator("text=Reconnected").first();
if (await reconnectedBanner.isVisible().catch(() => false)) {
  await page.locator('[data-testid="remove-banner-button"]').first().click();
}
```

### ステップ2: gridレイアウトでセルを実行

```typescript
async function runCode(page: Page, code: string) {
  // ツールバーの「Python」ボタンでセル追加
  await page.getByRole('button', { name: 'Python', exact: true }).click();
  await page.waitForTimeout(1000);

  // 新セルのエディタにコードを入力（force: trueでトースト回避）
  const cmContent = page.locator('.cm-content').last();
  await cmContent.click({ force: true });
  await cmContent.fill(code);

  // 実行ボタンをクリック
  await page.getByTestId('run-button').locator(':visible').last().click({ force: true });

  // 実行完了を待つ
  await page.waitForTimeout(2000);
}

// 使用例
await runCode(page, 'bt.chart("7203")');
await runCode(page, 'bt.buy()');
```

### ステップ3: スキルツリー確認

```typescript
// スキルツリーパネルを開く
await page.evaluate(() => {
  document.querySelector('[data-testid="skill-tree-button"]')?.click();
});
await page.locator('[data-testid="skill-tree-panel"]').waitFor({ timeout: 5000 });

// 進捗確認
const progressText = await page.locator('text=/\\d+\\/\\d+ スキル/').first().textContent();
console.log('進捗:', progressText);

// スクリーンショット
await page.screenshot({ path: 'skill-tree-progress.png', fullPage: true });
```

---

## 🐛 既知の問題・Tips

### 重要: auto_instantiate設定の影響

**pyproject.tomlの設定**: `auto_instantiate = true`

この設定により、backcast.pyを開いた瞬間に既存のセルが自動実行されます。

**影響:**
- ファイルを開いた直後に`bt.chart("7203")`セルが自動実行される可能性
- SANDBOX_001スキルが意図せず発火する可能性

**対策:**
1. **推奨**: backcast.pyの既存セルをすべて削除してから開始
2. または: 自動実行されたセルは無視して、新しいセルで順番に実行
3. または: `auto_instantiate = false`に一時的に変更

### Playwrightでの注意点
1. **トースト通知**: 報酬トーストやReconnectedバナーがUIを遮る可能性
   - 対策: `dismissReconnectedBanner()`, `{ force: true }`オプション
2. **Grid Layout**: `create-cell-button`が存在しない
   - 対策: ツールバーの「Python」ボタンでセル作成
3. **セル実行待機**: `[data-cell-status='running']`が消えるまで待つ

### スキル発火タイミング
- `chart()` 2回目実行時に`SANDBOX_003`と`SANDBOX_004`が完了していれば`SANDBOX_005`発火
- サンドボックス5個完了で自動的に`SANDBOX_006`発火
- `BRIDGE_002`完了で自動的に`BRIDGE_003`発火

---

## 🔧 marimoサーバー起動のトラブルシューティング

### 問題1: `pixi`コマンドがPATHに存在しない

**症状:**
```
nohup: failed to run command 'pixi': No such file or directory
```

**解決策A: pnpmを使う（推奨）**
```bash
# marimoプロジェクトのルートディレクトリで実行
cd /d/Documents/marimo
pnpm dev
```

このコマンドは以下を実行します：
- バックエンド: port 2718
- フロントエンド: port 3000

**解決策B: 直接Pythonでmarimoを起動**
```bash
# 仮想環境を有効化（既にビルド済みの場合）
cd /d/Documents/marimo
source .venv/bin/activate  # Windowsの場合: .venv\Scripts\activate

# marimoを起動
python -m marimo edit --no-token --port 2718 "C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py"
```

**解決策C: hatchを使う**
```bash
cd /d/Documents/marimo
hatch shell
make dev
```

### 問題2: `Port 2718 is already in use`

**確認方法:**
```bash
# ポート2718を使用しているプロセスを確認
lsof -i :2718  # macOS/Linux
netstat -ano | findstr :2718  # Windows
```

**解決策:**
```bash
# プロセスをkill
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# または、別のポートを使う
python -m marimo edit --port 2719 "C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py"
```

### 問題3: backcast.pyが見つからない

**確認:**
```bash
ls "C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py"
```

**見つからない場合:**
```bash
# サンプルからコピー
mkdir -p "C:\Users\sasac\AppData\Roaming\marimo\notebooks"
cp /d/Documents/marimo/src-tauri/sample-notebooks/backcast.py "C:\Users\sasac\AppData\Roaming\marimo\notebooks/"
```

### 問題4: `game_setup.py`モジュールが見つからない

backcast.pyは`import game_setup as bt`を使用しています。

**解決策A: 同じディレクトリにコピー（推奨）**
```bash
# 必要なモジュールをすべてコピー
cp /d/Documents/marimo/src-tauri/sample-notebooks/game_setup.py "C:\Users\sasac\AppData\Roaming\marimo\notebooks/"
cp /d/Documents/marimo/src-tauri/sample-notebooks/skill_events.py "C:\Users\sasac\AppData\Roaming\marimo\notebooks/"
cp /d/Documents/marimo/src-tauri/sample-notebooks/backtest_wrapper.py "C:\Users\sasac\AppData\Roaming\marimo\notebooks/"
cp /d/Documents/marimo/src-tauri/sample-notebooks/chart.py "C:\Users\sasac\AppData\Roaming\marimo\notebooks/"
cp /d/Documents/marimo/src-tauri/sample-notebooks/headless_broadcast.py "C:\Users\sasac\AppData\Roaming\marimo\notebooks/"
cp /d/Documents/marimo/src-tauri/sample-notebooks/progress_manager.py "C:\Users\sasac\AppData\Roaming\marimo\notebooks/"
```

**解決策B: PYTHONPATHを設定**
```bash
export PYTHONPATH="/d/Documents/marimo/src-tauri/sample-notebooks:$PYTHONPATH"
python -m marimo edit "C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py"
```

### 問題5: 依存関係が未インストール

**症状:**
```
ModuleNotFoundError: No module named 'BackcastPro'
```

**解決策:**
```bash
# BackcastProプロジェクトのパスを確認
ls /d/Documents/BackcastPro

# PYTHONPATHに追加
export PYTHONPATH="/d/Documents/BackcastPro:$PYTHONPATH"

# または、BackcastProをインストール
cd /d/Documents/BackcastPro
pip install -e .
```

### 推奨される起動手順（最短ルート）

```bash
# 1. marimoプロジェクトに移動
cd /d/Documents/marimo

# 2. pnpmでサーバー起動（バックグラウンド）
pnpm dev &

# 3. サーバー起動を待つ（5-10秒）
sleep 10

# 4. ブラウザで確認
# http://localhost:2718
# http://localhost:3000

# 5. backcast.pyを開く
# http://localhost:2718/?file=C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py
```

---

---

## 🎯 実行方法の選択肢

### オプションA: 手動でサーバー起動 + Playwright操作

**メリット**: 実際のユーザー体験に最も近い
**デメリット**: サーバー起動の手間がかかる

**手順:**
1. 別ターミナルで`pnpm dev`を実行してサーバー起動
2. Playwright MCPツールを使ってブラウザ操作
3. 上記の「Playwright操作の実装例」に従って実行

### オプションB: 既存のE2Eテスト（game-e2eスキル）を使用

**メリット**: サーバー自動起動、実装済みのテストを活用
**デメリット**: E2Eテストの仕様に従う必要がある

**手順:**
```bash
# game-e2eスキルを実行
/game-e2e

# または直接Playwrightテストを実行
cd /d/Documents/marimo/frontend
pnpm test:e2e e2e-tests/game/sandbox.spec.ts
```

**game-e2eスキルの内容:**
- `frontend/e2e-tests/game/sandbox.spec.ts`を実行
- 失敗時は知見ドキュメントを参照して自動修正を試みる
- サーバー自動起動機能付き

### オプションC: 手動プレイ（Playwrightなし）

**メリット**: 最もシンプル、実装不要
**デメリット**: 自動化されない

**手順:**
1. `pnpm dev`でサーバー起動
2. ブラウザで `http://localhost:2718` を開く
3. backcast.pyを手動で開く
4. 手動でコードを入力・実行
5. スキルツリーを手動で確認

---

## 📊 期待される成果物

1. **実行ログ**: 各コマンド実行とスキル発火の記録
2. **スクリーンショット**: スキルツリー完了状態、チャート画面
3. **体験レポート**: ゲームの流れ、UI/UX改善提案
