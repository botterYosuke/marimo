# 作業依頼: marimoゲーム（Backcast）を実際にプレイしてください

**作成日**: 2026-02-20

---

## 🎯 目的

backcast.py のゲームシステムを実際にプレイし、スキルツリーの動作を確認する。
発見したバグ・知見はレポートとして記録する。

**ゲームファイル**: `C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py`

---

## 📋 作業手順

### ステップ1: レポートファイルの作成

最初に `D:\Documents\marimo\.claude\plans\my-game-play-report2.md` を作成してください。
作業中に随時更新します。

記録する内容：
- ✅ 完了した作業項目
- 📝 各ステップの実行ログ（コード・結果・発火したスキル）
- 💡 発見したバグ・知見
- 🔧 Tips・トラブルシューティング

---

### ステップ2: 環境準備

#### 2.1 marimoサーバーの起動

```bash
cd /d/Documents/marimo
pnpm dev
```

#### 2.2 backcast.pyを開く

```
http://localhost:2718/?file=C:\Users\sasac\AppData\Roaming\marimo\notebooks\backcast.py
```

> ⚠️ `http://localhost:2718/home` は 404 になります。上記 URL を直接使用してください。

#### 2.3 接続確認

- `[data-testid="backend-status"]` ボタンが緑色（healthy）になるまで待機
- "Reconnected" バナーが出た場合は `[data-testid="remove-banner-button"]` で閉じる

---

### ステップ3: ゲームプレイ

#### auto_instantiateによる自動完了（ページ読み込み時）

backcast.py は `auto_instantiate=true` のため、ページを開くと `bt.chart("7203")` セルが自動実行されます。
`bt.chart()` は内部で `get_stock_daily()` を呼ぶため、以下のスキルがページ読み込み時点で自動完了します：

| スキルID | 自動完了する理由 |
|----------|----------------|
| SANDBOX_001 | `bt.chart()` が `emit_skill("SANDBOX_001")` を呼ぶ |
| BRIDGE_002 | `bt.chart()` が内部で `get_stock_daily()` を呼ぶ |
| BRIDGE_003 | BRIDGE_002 完了時に `_check_graduations()` が自動発火 |

**ページ読み込み後の初期状態: 3/59（SANDBOX_001 + BRIDGE_002 + BRIDGE_003）**

2秒程度待ってからプレイを開始してください（初期化タイミング問題対策）。

#### 残りのスキル取得シーケンス

backcast.py には全操作セルが既に記述されています。**新しいセルを追加せず、既存セルを上から順に実行**してください。

| セル | コード | 説明 | 期待されるスキル |
|------|--------|------|----------------|
| cell 4 | `bt.buy()` | 株を購入 | **SANDBOX_002** ✓ |
| cell 5 | `bt.trades()` | ※この時点で `len(bt.trades) == 0`（未決済）のため**発火しない** | なし |
| cell 6 | `bt.sell()` | 株を売却 | **SANDBOX_004** ✓ |
| cell 7 | `bt.chart("7203")` | 2回目 ※SANDBOX_003未取得のため**発火しない** | なし |
| cell 8 | `bt.reveal_data()` | データ確認（⚠️ 既知バグ: イベントは発火するがフロントでカウントされない） | BRIDGE_001（未カウント） |
| cell 9 | `bt.get_stock_daily("7203")` | ※BRIDGE_002は発火済みのため重複しない | なし |
| cell 10 | `bt.step()` | 次の日に進む（買い注文が決済される） | なし |
| cell 11 | `bt.buy()` | 2回目（SANDBOX_002は重複しない） | なし |
| cell 12 | `bt.step()` | 2回目 | なし |
| cell 13 | `bt.trades()` | 2回目（step後、`len(bt.trades) > 0` になる） | **SANDBOX_003** ✓ |
| cell 14 | `bt.chart("7203")` | 3回目（SANDBOX_003+004 完了後） | **SANDBOX_005** ✓、**SANDBOX_006**（自動）✓ |

---

### ステップ4: 確認・レポート作成

#### 4.1 スキルツリーの確認

`[data-testid="skill-tree-button"]` をクリックしてパネルを開き、進捗を確認する。

#### 4.2 スクリーンショット撮影

- 各ステップのゲーム画面
- スキルツリーパネルの最終状態

#### 4.3 体験レポートをレポートファイルに記載

以下の観点でレポートを作成する：
- スキル発火のタイミングは適切か
- UIフィードバック（トースト通知、スキルツリー更新）は正常か
- 発見したバグ・改善提案

---

## ⚠️ 重要な注意点

### gridレイアウトでのセル操作

backcast.py は `app = marimo.App(width="grid")` のため、セルは react-flow ノード内に配置されています。

- `[data-testid="cell"]` は**存在しない**
- 既存セルを実行する場合: `[data-testid="cell-editor"]` から DOM を遡って `rf__node-{id}` を取得し、`run-button` を `{ force: true }` でクリック
- トースト通知が UI を遮ることがある → 出たら閉じる

```javascript
// 既存セルのrunボタンを取得する方法
const rfNode = await cell.evaluateHandle(el => {
  let node = el;
  while (node && !node.dataset.id) node = node.parentElement;
  return node ? node.dataset.id : null;
});
const cellId = await rfNode.jsonValue();
const cellNode = await page.$(`[data-testid="rf__node-${cellId}"]`);
const runBtn = await cellNode.$('[data-testid="run-button"]');
await runBtn.click({ force: true });
```

### スキル発火タイミング

- **SANDBOX_003** は `bt.step()` で時間を進め、取引が決済された後に `bt.trades()` を実行すると発火（`len(bt.trades) > 0` が条件）
- **SANDBOX_005** は SANDBOX_003 と SANDBOX_004 が**両方**完了後に `bt.chart()` を実行すると発火
- **SANDBOX_006** は SANDBOX_001〜005 の5個完了で自動発火
- **BRIDGE_003** は BRIDGE_002 完了時に自動発火（ページ読み込み時）

---

## 🐛 既知のバグ（プレイ前に把握しておくこと）

| バグ | 現象 | 確認方法 |
|------|------|---------|
| **BRIDGE_001 未カウント** | `bt.reveal_data()` 実行でコンソールに `[SkillHandler] Received skill event: BRIDGE_001` は出るが、スキルツリーのカウントが増えない | スキルツリーでBRIDGE_001が青点線（未完了）のまま |
| **Position表示バグ** | ステータスバーに `"[object Object] shares"` と表示される | Position欄を目視確認 |
| **SANDBOX_005重複送信** | コンソールに SANDBOX_005 が2回ログ記録される | ブラウザコンソール監視 |

---

## 📚 参考ドキュメント

1. **`docs/game-guide.md`** - ゲームの概要
2. **`development_docs/game-e2e-review-system.md`** - E2Eテストと知見
3. **`C:\Users\sasac\AppData\Roaming\marimo\notebooks\game_setup.py`** - ゲームロジック（スキル発火条件）

---

## ✅ 期待される成果物

1. **`D:\Documents\marimo\.claude\plans\my-game-play-report2.md`**
   - 全ステップの実行ログ
   - 発見したバグ・知見・改善提案

2. **スクリーンショット**（各段階のゲーム画面、スキルツリー最終状態）

3. **スキル獲得確認**
   - 到達可能な最終スキル数: **8/59**（BRIDGE_001フロントエンドバグのため9/59は不達成）
   - SANDBOX_001〜006（6個）+ BRIDGE_002 + BRIDGE_003 が完了状態になれば成功
