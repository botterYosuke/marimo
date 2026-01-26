# 作業引継ぎ: BroadcastChannel HUD表示位置の変更

## 概要

marimoバックテストの状態情報を、現在の実装（fintech1.py内の独立したiframe）から、既存のthree.jsシーンのヘッダー領域（shutdownボタンやSettingボタンと同じ高さ）に移動する。

**重要**: `mo.iframe()`内に独立したシーンを作るのではなく、three.jsの`multiple_elements`パターンを使用して、既存のthree.jsシーン（ドローン表示用）のDOM構造内にHUD要素を追加する。

---

## 現在の実装状態

### 完了済み

1. **BacktestStatePublisher** - BroadcastChannel経由で状態を配信するAnyWidget
   - ファイル: `C:\Users\sasai\Documents\BackcastPro\src\BackcastPro\api\state_publisher.py`
   - チャンネル名: `backtest_channel`
   - 配信データ:
     ```javascript
     {
       type: 'backtest_update',
       data: {
         current_time: "2024-01-26",
         progress: 0.75,
         equity: 125000.0,
         cash: 50000.0,
         position: 100,
         closed_trades: 15,
         step_index: 75,
         total_steps: 100,
         _timestamp: 1706234567890
       }
     }
     ```

2. **Backtest.state_publisher()** メソッド
   - ファイル: `C:\Users\sasai\Documents\BackcastPro\src\BackcastPro\backtest.py` (533行目付近)
   - 使い方: `publisher = bt.state_publisher(code)`

3. **fintech1.py** - 現在の実装（変更対象）
   - ファイル: `C:\Users\sasai\AppData\Local\Temp\fintech1.py`
   - 現状: 独立したiframe内にthree.jsシーンとHUDを表示（135-297行目）

---

## 変更依頼

### 目標

BroadcastChannelで受信したバックテスト情報を、**既存のthree.jsシーン**（ドローンが表示されているシーン）のヘッダー領域左上に新しいdiv要素として表示する。

### 参考実装

three.js公式サンプル: [multiple_elements](https://github.com/mrdoob/three.js/blob/master/examples/webgl_multiple_elements.html)

このパターンのポイント:
- 1つのページ内に複数のDOM要素（ビューポート）を配置
- 各要素は独立したrectを持ち、rendererが各要素をクリップして描画
- HUD要素はthree.jsキャンバスの上にHTML/CSSで配置可能

### 配置イメージ

```
┌─────────────────────────────────────────────────────────────────┐
│ [📊 Backtest HUD]                        [Settings] [Shutdown]  │ ← ヘッダー領域
│  Time: 2024-01-26 | Progress: 75% | Equity: ¥125,000           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                     [Three.js シーン]                           │
│                       (ドローン等)                              │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 技術詳細

### BroadcastChannel受信コード（コピー可）

```javascript
const CHANNEL_NAME = 'backtest_channel';
const channel = new BroadcastChannel(CHANNEL_NAME);

channel.onmessage = (event) => {
    try {
        if (!event.data || typeof event.data !== 'object') return;
        if (event.data.type !== 'backtest_update') return;
        if (!event.data.data) return;

        const state = event.data.data;

        // HUD要素を更新
        const hudTime = document.getElementById('hud-time');
        const hudProgress = document.getElementById('hud-progress');
        const hudEquity = document.getElementById('hud-equity');
        const hudCash = document.getElementById('hud-cash');
        const hudPosition = document.getElementById('hud-position');
        const hudTrades = document.getElementById('hud-trades');

        if (hudTime) hudTime.textContent = state.current_time || '-';
        if (hudProgress) {
            const progress = ((state.progress || 0) * 100).toFixed(1);
            hudProgress.textContent = progress + '%';
        }
        if (hudEquity) {
            hudEquity.textContent = '¥' + (state.equity || 0).toLocaleString('ja-JP', {maximumFractionDigits: 0});
        }
        if (hudCash) {
            hudCash.textContent = '¥' + (state.cash || 0).toLocaleString('ja-JP', {maximumFractionDigits: 0});
        }
        if (hudPosition) {
            hudPosition.textContent = (state.position || 0) + ' shares';
        }
        if (hudTrades) {
            hudTrades.textContent = (state.closed_trades || 0) + ' trades';
        }
    } catch (e) {
        console.error('Error processing backtest update:', e);
    }
};
```

### HUD HTML構造（推奨）

```html
<div id="backtest-hud" style="
    position: fixed;
    top: 0;
    left: 0;
    height: 40px;  /* shutdownボタンと同じ高さ */
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 0 15px;
    background: rgba(0, 20, 40, 0.9);
    color: #00ff88;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    border-bottom: 1px solid #00ff8844;
    z-index: 1000;  /* three.jsキャンバスより上 */
">
    <span style="font-weight: bold;">📊 Backtest</span>
    <span>Time: <span id="hud-time">-</span></span>
    <span>Progress: <span id="hud-progress">0%</span></span>
    <span>Equity: <span id="hud-equity">¥0</span></span>
    <span>Cash: <span id="hud-cash">¥0</span></span>
    <span>Position: <span id="hud-position">0</span></span>
    <span>Trades: <span id="hud-trades">0</span></span>
</div>
```

---

## 調査が必要な項目

### 1. 既存のthree.jsシーンの場所

ドローンが表示されているthree.jsシーンがどこで初期化されているか確認が必要:

- marimo frontend内のコンポーネント？
- 別のiframe内？
- fintech1.py以外の場所？

**調査コマンド例**:
```bash
# three.js関連ファイルを検索
grep -r "THREE" frontend/src/ --include="*.tsx" --include="*.ts"
grep -r "WebGLRenderer" frontend/src/ --include="*.tsx" --include="*.ts"
```

### 2. ヘッダー領域の構造

shutdownボタン、Settingボタンがどこに定義されているか:

```bash
# ヘッダー関連コンポーネントを検索
grep -r "shutdown" frontend/src/ --include="*.tsx"
grep -r "Settings" frontend/src/ --include="*.tsx"
```

---

## 変更対象ファイル（推定）

1. **既存のthree.jsシーンファイル**
   - HUD用のDOM要素を追加
   - BroadcastChannel購読コードを追加

2. **fintech1.py** (135-297行目)
   - 現在の独立iframeセルを削除または簡略化
   - state_publisherセル（125-131行目）は維持

---

## 作業手順（推奨）

1. **調査フェーズ**
   - 既存のthree.jsシーンの場所を特定
   - ヘッダー領域の構造を確認
   - multiple_elementsパターンの適用可能性を評価

2. **実装フェーズ**
   - HUD用DOM要素を追加
   - BroadcastChannel購読コードを追加
   - スタイリング調整

3. **クリーンアップ**
   - fintech1.pyの不要なiframeセルを削除

4. **検証**
   - バックテスト実行時にHUDが更新されることを確認

---

## 現在のfintech1.py構造

```
セル1 (7-44行目):   初期化（bt, AutoRefresh, toggle_run等）
セル2 (47-65行目):  情報パネル（mo.md）← 既存の情報表示
セル3 (68-78行目):  データ取得
セル4 (81-107行目): 戦略定義
セル5 (110-113行目): toggle_run呼び出し
セル6 (116-122行目): チャート表示
セル7 (125-131行目): state_publisher配置 ← 維持
セル8 (134-297行目): three.js iframe ← 変更対象（削除または移動）
セル9 (300-320行目): 取引履歴テーブル
```

---

## 関連ファイルパス

| ファイル | パス | 役割 |
|----------|------|------|
| Publisher実装 | `C:\Users\sasai\Documents\BackcastPro\src\BackcastPro\api\state_publisher.py` | BroadcastChannel送信 |
| Backtestメソッド | `C:\Users\sasai\Documents\BackcastPro\src\BackcastPro\backtest.py` | state_publisher()メソッド |
| fintech1.py | `C:\Users\sasai\AppData\Local\Temp\fintech1.py` | 現在の実装 |
| marimo frontend | `C:\Users\sasai\Documents\marimo\frontend\src\` | ヘッダー・UI |
| 計画ファイル | `C:\Users\sasai\.claude\plans\fancy-baking-badger.md` | 元の計画 |
| three.js例 | https://github.com/mrdoob/three.js/blob/master/examples/webgl_multiple_elements.html | 参考 |

---

## 注意事項

1. **BroadcastChannel**: 同一オリジン内でのみ動作
2. **z-index**: HUD要素はthree.jsキャンバスより高いz-indexが必要
3. **DOM存在確認**: HUD要素が存在することを確認してから更新
4. **レスポンシブ**: ウィンドウサイズ変更時の配置を考慮
5. **three.jsバージョン**: 現在r165を使用中

---

## 完了条件

- [ ] HUDがヘッダー領域の左上に表示される（shutdownボタンと同じ高さ）
- [ ] BroadcastChannelからの情報がリアルタイムで更新される
- [ ] 既存のthree.jsシーン（ドローン）は引き続き正常に表示される
- [ ] fintech1.pyの独立iframeセルは削除または調整済み
- [ ] UIが既存のボタン類と視覚的に調和している
