/* Copyright 2026 Marimo. All rights reserved. */

import type { Milestone, Skill } from "./types";

export const skillDefinitions: Skill[] = [
  // ========================================
  // サンドボックスカテゴリ（6スキル）
  // ========================================
  {
    id: "SANDBOX_001",
    title: "マーケットへようこそ",
    description: "Backcastゲームを起動する",
    status: "unlocked", // 初期状態でアンロック
    category: "sandbox",
    track: "sandbox",
    reward: [
      { type: "cash", description: "+30,000円", value: 30000 },
      { type: "title", description: "称号「初陣」" },
    ],
    prerequisites: [],
    difficulty: 1,
    helpContent: `## ようこそ、Backcastへ！

目の前に見えているのは、トヨタ自動車（7203）の株価チャートです。

### 今すぐできること

1. **時間を進める**: \`bt.step()\` で次の日に進む
2. **株を買う注文する**: 黒いウィンドウに \`bt.buy()\` と入力して実行
3. **買注文が決済される**: \`bt.step()\` で次の日に進むと注文が決済されました！
4. **チャートを見る**: \`bt.step()\` で日を進めて株価の動きを確認

### 最初の目標

「株を買う！！」

これができたら、あなたも投資家の仲間入り！`,
  },
  {
    id: "SANDBOX_002",
    title: "初めての購入",
    description: "bt.buy() で株を購入",
    status: "locked",
    category: "sandbox",
    track: "sandbox",
    reward: [{ type: "cash", description: "+20,000円", value: 20000 }],
    prerequisites: ["SANDBOX_001"],
    difficulty: 1,
  },
  {
    id: "SANDBOX_003",
    title: "買値を確認する",
    description: "自分の買い注文の約定価格を確認",
    status: "locked",
    category: "sandbox",
    track: "sandbox",
    reward: [{ type: "cash", description: "+10,000円", value: 10000 }],
    prerequisites: ["SANDBOX_002"],
    difficulty: 1,
    helpContent: `## 買った株を確認しよう

買い注文を出したら、いくらで買えたか確認しましょう。

\`\`\`python
# 保有中の取引を確認
for trade in bt.trades():
    mo.output.append(f"銘柄: {trade.code}")
    mo.output.append(f"買値: {trade.entry_price:,.0f}円")
    mo.output.append(f"株数: {trade.size}株")
\`\`\`

### ポイント

- \`trade.entry_price\` が買った時の価格
- \`trade.size\` が保有株数
- この情報は売却タイミングを決めるのに重要！`,
  },
  {
    id: "SANDBOX_004",
    title: "初めての売却",
    description: "保有株を売却する（損益問わず）",
    status: "locked",
    category: "sandbox",
    track: "sandbox",
    reward: [{ type: "cash", description: "+20,000円", value: 20000 }],
    prerequisites: ["SANDBOX_002"],
    difficulty: 1,
    helpContent: `## 株を売ってみよう

買った株を売却してみましょう。利益が出ても損失が出ても大丈夫！

\`\`\`python
# 保有株を売却
for trade in bt.trades():
    trade.close()
    mo.output.append("売却完了！")
\`\`\`

### ポイント

- 利益が出ていなくても売却は重要な経験
- 「損切り」はプロトレーダーの基本スキル
- 次のステップで利益を狙う方法を学びます`,
  },
  {
    id: "SANDBOX_005",
    title: "チャートで振り返る",
    description: "チャート上の売買マーカーを確認",
    status: "locked",
    category: "sandbox",
    track: "sandbox",
    reward: [{ type: "cash", description: "+20,000円", value: 20000 }],
    prerequisites: ["SANDBOX_003", "SANDBOX_004"],
    difficulty: 1,
  },
  {
    id: "SANDBOX_006",
    title: "サンドボックス卒業",
    description: "次のステージへ進む準備完了",
    status: "locked",
    category: "sandbox",
    track: "sandbox",
    reward: [
      { type: "cash", description: "+50,000円", value: 50000 },
      { type: "unlock", description: "ブリッジモード解禁" },
    ],
    prerequisites: ["SANDBOX_005"],
    difficulty: 1,
  },

  // ========================================
  // ブリッジカテゴリ（3スキル）
  // ========================================
  {
    id: "BRIDGE_001",
    title: "データの正体",
    description: "サンドボックスで使っていたデータの出所を確認",
    status: "locked",
    category: "bridge",
    track: "bridge",
    reward: [{ type: "cash", description: "+15,000円", value: 15000 }],
    prerequisites: ["SANDBOX_006"],
    difficulty: 1,
    helpContent: `## サンドボックスの「魔法」を解き明かす

サンドボックスでは、最初から株を買えましたよね？
でも実は、裏でこんなコードが動いていました：

\`\`\`python
# サンドボックスの裏側（自動実行されていた）
from BackcastPro import Backtest, get_stock_daily

bt = Backtest(cash=100_000)
df = get_stock_daily("7203")  # ← これでトヨタのデータを取得
bt.set_data({"7203": df})     # ← これでデータをセット

# ここまで完了した状態で、あなたに渡されていた
\`\`\`

### 確認してみよう

\`\`\`python
# 現在セットされているデータを確認
mo.output.append(bt._data.keys())  # → dict_keys(['7203'])
mo.output.append(len(bt._data["7203"]))  # → データの行数
\`\`\`

### 気づき

- \`get_stock_daily()\` で株価データを取得
- \`set_data()\` でBacktestに登録
- これがないと \`buy()\` は使えない！`,
  },
  {
    id: "BRIDGE_002",
    title: "自分でデータを取得",
    description: "get_stock_daily() をサンドボックス内で実行",
    status: "locked",
    category: "bridge",
    track: "bridge",
    reward: [
      { type: "cash", description: "+20,000円", value: 20000 },
      { type: "item", description: "銘柄: ソニー" },
    ],
    prerequisites: ["BRIDGE_001"],
    difficulty: 1,
    helpContent: `## 別の銘柄を追加してみよう

サンドボックスにはトヨタしかありません。
ソニー（6758）を追加してみましょう！

\`\`\`python
# ソニーのデータを取得
df_sony = get_stock_daily("6758")

# 中身を確認
mo.output.append(df_sony.head())
mo.output.append(f"データ期間: {df_sony.index[0]} 〜 {df_sony.index[-1]}")
\`\`\`

### 次のステップ

取得したデータを \`set_data()\` でセットする方法は、
フルモードで学びます。

今は「データを自分で取得できる」ことを体験してください！`,
  },
  {
    id: "BRIDGE_003",
    title: "フルモードへ",
    description: "新規ノートブックで0からセットアップ完了",
    status: "locked",
    category: "bridge",
    track: "bridge",
    reward: [
      { type: "cash", description: "+25,000円", value: 25000 },
      { type: "unlock", description: "フルモード解禁" },
    ],
    prerequisites: ["BRIDGE_002"],
    difficulty: 2,
    helpContent: `## ついにフルモードへ！

サンドボックスで学んだことを活かして、
0から自分でセットアップしてみましょう。

### 手順

\`\`\`python
# 1. インポート
from BackcastPro import Backtest, get_stock_daily

# 2. Backtest初期化（好きな金額で！）
bt = Backtest(cash=1_000_000)

# 3. 株価データ取得
code = "7203"
df = get_stock_daily(code)

# 4. データをセット
bt.set_data({code: df})

# 5. これでサンドボックスと同じ状態！
bt.buy()  # 買える！
\`\`\`

### おめでとうございます！

これでBackcastの基本をマスターしました。
フルモードでは、さらに高度な機能が解禁されます：

- 複数銘柄の同時運用
- インジケーター（移動平均線、RSIなど）
- リスク管理（ストップロス、テイクプロフィット）`,
  },

  // ========================================
  // 失敗カテゴリ（3スキル）
  // ========================================
  {
    id: "FAIL_001",
    title: "初めての含み損",
    description: "保有株が買値を下回る体験",
    status: "locked",
    category: "fail",
    track: "sandbox",
    reward: [
      { type: "cash", description: "+5,000円", value: 5000 },
      { type: "title", description: "称号「授業料」" },
    ],
    prerequisites: ["SANDBOX_002"],
    difficulty: 1,
    helpContent: `## 含み損は「勉強代」

買った株が値下がりすることは珍しくありません。
これは失敗ではなく、投資の現実を学ぶ第一歩です。

\`\`\`python
# 含み損益を確認
for trade in bt.trades():
    if trade.pl < 0:
        mo.output.append(f"含み損: {trade.pl:,.0f}円 ({trade.pl_pct:.1f}%)")
\`\`\`

### プロの考え方

- 100%勝てる投資家は存在しない
- 重要なのは「トータルでプラス」になること
- 小さな損失を受け入れ、大きな利益を狙う

> 「損小利大」がプロの鉄則`,
  },
  {
    id: "FAIL_002",
    title: "初めての損切り",
    description: "損失を確定させる勇気",
    status: "locked",
    category: "fail",
    track: "sandbox",
    reward: [
      { type: "cash", description: "+10,000円", value: 10000 },
      { type: "title", description: "称号「決断力」" },
    ],
    prerequisites: ["SANDBOX_004", "FAIL_001"],
    difficulty: 1,
    helpContent: `## 損切りはプロの証

損切り（ロスカット）は、損失を最小限に抑えるための重要な技術です。

\`\`\`python
# 損切りの実行
for trade in bt.trades():
    if trade.pl < 0 and trade.pl_pct < -5:  # 5%以上の損失
        trade.close()
        mo.output.append("損切り完了 - これ以上の損失を防いだ！")
\`\`\`

### なぜ損切りが重要？

| 含み損 | 回復に必要な利益率 |
|--------|-------------------|
| -10% | +11.1% |
| -20% | +25.0% |
| -50% | +100.0% |
| -90% | +900.0% |

損失が大きくなるほど、回復が困難になります。
早めの損切りが資金を守る！`,
  },
  {
    id: "FAIL_003",
    title: "初めての破産",
    description: "資金が0以下になる",
    status: "locked",
    category: "fail",
    track: "full",
    reward: [
      { type: "cash", description: "+20,000円", value: 20000 },
      { type: "title", description: "称号「不死鳥への道」" },
    ],
    prerequisites: ["TRADE_001"],
    difficulty: 2,
    helpContent: `## 破産を経験しました

おめでとうございます...？いえ、これも大切な経験です。

### 破産の原因を分析

\`\`\`python
# 取引履歴を確認
for trade in bt.closed_trades:
    mo.output.append(f"{trade.code}: {trade.pl:+,.0f}円")
\`\`\`

### よくある破産パターン

1. **全力買い**: 1銘柄に全資金を投入
2. **損切りなし**: 含み損を放置して拡大
3. **ナンピン地獄**: 下がるたびに買い増し

### 次回への教訓

- ポジションサイズを管理する（全力買いしない）
- ストップロスを設定する
- 1回の取引で失っていい金額を決める

> 「マーケットは授業料を取る。問題は、その授業料で何を学ぶかだ」`,
  },

  // ========================================
  // セットアップカテゴリ（5スキル）
  // ========================================
  {
    id: "SETUP_001",
    title: "marimoを起動する",
    description: "marimo edit でノートブックを開く",
    status: "locked",
    category: "setup",
    track: "full",
    reward: [{ type: "cash", description: "+10,000円", value: 10000 }],
    prerequisites: ["BRIDGE_003"],
    difficulty: 1,
  },
  {
    id: "SETUP_002",
    title: "BackcastProをインポート",
    description: "from BackcastPro import Backtest, get_stock_daily",
    status: "locked",
    category: "setup",
    track: "full",
    reward: [{ type: "cash", description: "+10,000円", value: 10000 }],
    prerequisites: ["SETUP_001"],
    difficulty: 1,
  },
  {
    id: "SETUP_003",
    title: "Backtestを初期化する",
    description: "bt = Backtest(cash=1_000_000)",
    status: "locked",
    category: "setup",
    track: "full",
    reward: [{ type: "cash", description: "+15,000円", value: 15000 }],
    prerequisites: ["SETUP_002"],
    difficulty: 1,
  },
  {
    id: "SETUP_004",
    title: "初期資金を設定する",
    description: "cash パラメータで初期資金を変更",
    status: "locked",
    category: "setup",
    track: "full",
    reward: [{ type: "cash", description: "+7,500円", value: 7500 }],
    prerequisites: ["SETUP_003"],
    difficulty: 1,
  },
  {
    id: "SETUP_005",
    title: "手数料を設定する",
    description: "commission パラメータで手数料率を設定",
    status: "locked",
    category: "setup",
    track: "full",
    reward: [{ type: "cash", description: "+7,500円", value: 7500 }],
    prerequisites: ["SETUP_003"],
    difficulty: 1,
  },

  // ========================================
  // データ取得カテゴリ（6スキル）
  // ========================================
  {
    id: "DATA_001",
    title: "get_stock_dailyを使う",
    description: "get_stock_daily(code) で株価データ取得",
    status: "locked",
    category: "data",
    track: "full",
    reward: [
      { type: "cash", description: "+15,000円", value: 15000 },
      { type: "item", description: "銘柄: トヨタ" },
    ],
    prerequisites: ["SETUP_002"],
    difficulty: 1,
  },
  {
    id: "DATA_002",
    title: "株価データを確認する",
    description: "取得したDataFrameの中身を確認",
    status: "locked",
    category: "data",
    track: "full",
    reward: [{ type: "cash", description: "+10,000円", value: 10000 }],
    prerequisites: ["DATA_001"],
    difficulty: 1,
  },
  {
    id: "DATA_003",
    title: "OHLCV列を理解する",
    description: "Open, High, Low, Close, Volume の意味を理解",
    status: "locked",
    category: "data",
    track: "full",
    reward: [{ type: "cash", description: "+15,000円", value: 15000 }],
    prerequisites: ["DATA_002"],
    difficulty: 1,
  },
  {
    id: "DATA_004",
    title: "別の銘柄を取得する",
    description: "トヨタ以外の銘柄コードでデータ取得",
    status: "locked",
    category: "data",
    track: "full",
    reward: [
      { type: "cash", description: "+15,000円", value: 15000 },
      { type: "item", description: "銘柄: 日立" },
    ],
    prerequisites: ["DATA_001"],
    difficulty: 1,
  },
  {
    id: "DATA_005",
    title: "複数銘柄を取得する",
    description: "2銘柄以上のデータを取得",
    status: "locked",
    category: "data",
    track: "full",
    reward: [
      { type: "cash", description: "+25,000円", value: 25000 },
      { type: "item", description: "銘柄: 日経225" },
    ],
    prerequisites: ["DATA_004"],
    difficulty: 2,
  },
  {
    id: "DATA_006",
    title: "日付範囲を指定する",
    description: "特定期間のデータを取得",
    status: "locked",
    category: "data",
    track: "full",
    reward: [{ type: "cash", description: "+20,000円", value: 20000 }],
    prerequisites: ["DATA_001"],
    difficulty: 2,
  },

  // ========================================
  // データセットカテゴリ（3スキル）
  // ========================================
  {
    id: "SET_001",
    title: "set_dataでデータをセット",
    description: "bt.set_data({code: df}) でデータを登録",
    status: "locked",
    category: "set",
    track: "full",
    reward: [
      { type: "cash", description: "+30,000円", value: 30000 },
      { type: "unlock", description: "取引解禁" },
    ],
    prerequisites: ["SETUP_003", "DATA_001"],
    difficulty: 1,
  },
  {
    id: "SET_002",
    title: "bt.dataでデータにアクセス",
    description: "bt.data[code] で現在時点のデータを参照",
    status: "locked",
    category: "set",
    track: "full",
    reward: [{ type: "cash", description: "+15,000円", value: 15000 }],
    prerequisites: ["SET_001"],
    difficulty: 1,
  },
  {
    id: "SET_003",
    title: "複数銘柄をセット",
    description: "2銘柄以上を同時にセット",
    status: "locked",
    category: "set",
    track: "full",
    reward: [{ type: "cash", description: "+25,000円", value: 25000 }],
    prerequisites: ["SET_001", "DATA_005"],
    difficulty: 2,
  },

  // ========================================
  // 基本取引カテゴリ（10スキル）
  // ========================================
  {
    id: "TRADE_001",
    title: "株を購入する（フルモード）",
    description: "フルモードで bt.buy() を実行",
    status: "locked",
    category: "trade",
    track: "full",
    reward: [
      { type: "cash", description: "+20,000円", value: 20000 },
      { type: "title", description: "称号「投資家デビュー」" },
    ],
    prerequisites: ["SET_001"],
    difficulty: 1,
  },
  {
    id: "TRADE_002",
    title: "ポジションを確認する",
    description: "bt.position または bt.position_of(code) で確認",
    status: "locked",
    category: "trade",
    track: "full",
    reward: [{ type: "cash", description: "+10,000円", value: 10000 }],
    prerequisites: ["TRADE_001"],
    difficulty: 1,
  },
  {
    id: "TRADE_003",
    title: "株を売却する",
    description: "trade.close() でポジションを決済",
    status: "locked",
    category: "trade",
    track: "full",
    reward: [{ type: "cash", description: "+15,000円", value: 15000 }],
    prerequisites: ["TRADE_001"],
    difficulty: 1,
  },
  {
    id: "TRADE_004",
    title: "利益確定する",
    description: "利益が出ている状態で売却",
    status: "locked",
    category: "trade",
    track: "full",
    reward: [
      { type: "cash", description: "+20,000円", value: 20000 },
      { type: "title", description: "称号「利確マスター」" },
    ],
    prerequisites: ["TRADE_003"],
    difficulty: 1,
  },
  {
    id: "TRADE_005",
    title: "損切りする",
    description: "損失状態で売却を決断",
    status: "locked",
    category: "trade",
    track: "full",
    reward: [{ type: "cash", description: "+20,000円", value: 20000 }],
    prerequisites: ["TRADE_003", "FAIL_002"],
    difficulty: 1,
  },
  {
    id: "TRADE_006",
    title: "タグを活用する",
    description: "tag 引数で売買理由を記録",
    status: "locked",
    category: "trade",
    track: "full",
    reward: [{ type: "cash", description: "+10,000円", value: 10000 }],
    prerequisites: ["TRADE_001"],
    difficulty: 1,
  },
  {
    id: "TRADE_007",
    title: "5回取引達成",
    description: "合計5回の売買を完了",
    status: "locked",
    category: "trade",
    track: "full",
    reward: [{ type: "cash", description: "+25,000円", value: 25000 }],
    prerequisites: ["TRADE_003"],
    difficulty: 1,
  },
  {
    id: "TRADE_008",
    title: "戦略関数を作成する",
    description: "def my_strategy(bt): で自作戦略を定義",
    status: "locked",
    category: "trade",
    track: "full",
    reward: [
      { type: "cash", description: "+40,000円", value: 40000 },
      { type: "unlock", description: "戦略保存" },
    ],
    prerequisites: ["TRADE_007"],
    difficulty: 2,
  },
  {
    id: "TRADE_009",
    title: "bt.step()を理解する",
    description: "ゲームループの1ステップを理解",
    status: "locked",
    category: "trade",
    track: "full",
    reward: [{ type: "cash", description: "+20,000円", value: 20000 }],
    prerequisites: ["SET_001"],
    difficulty: 1,
  },
  {
    id: "TRADE_010",
    title: "run()でループ実行",
    description: "手動step()との違いを理解",
    status: "locked",
    category: "trade",
    track: "full",
    reward: [{ type: "cash", description: "+15,000円", value: 15000 }],
    prerequisites: ["TRADE_009"],
    difficulty: 2,
  },

  // ========================================
  // チャートカテゴリ（4スキル）
  // ========================================
  {
    id: "CHART_001",
    title: "チャートを表示する",
    description: "bt.chart() でローソク足チャートを表示",
    status: "locked",
    category: "chart",
    track: "full",
    reward: [{ type: "cash", description: "+20,000円", value: 20000 }],
    prerequisites: ["SET_001"],
    difficulty: 1,
  },
  {
    id: "CHART_002",
    title: "売買マーカーを確認する",
    description: "チャート上の売買ポイントを確認",
    status: "locked",
    category: "chart",
    track: "full",
    reward: [{ type: "cash", description: "+10,000円", value: 10000 }],
    prerequisites: ["CHART_001", "TRADE_003"],
    difficulty: 1,
  },
  {
    id: "CHART_003",
    title: "インジケーターを表示する",
    description: "indicators 引数で指標をオーバーレイ",
    status: "locked",
    category: "chart",
    track: "full",
    reward: [{ type: "cash", description: "+15,000円", value: 15000 }],
    prerequisites: ["CHART_001", "IND_001"],
    difficulty: 2,
  },
  {
    id: "CHART_004",
    title: "複数インジケーターを表示",
    description: "2つ以上の指標を同時表示",
    status: "locked",
    category: "chart",
    track: "full",
    reward: [{ type: "cash", description: "+20,000円", value: 20000 }],
    prerequisites: ["CHART_003"],
    difficulty: 2,
  },

  // ========================================
  // インジケーターカテゴリ（9スキル）
  // ========================================
  {
    id: "IND_001",
    title: "移動平均線を計算する",
    description: "df['SMA'] = df['Close'].rolling(N).mean()",
    status: "locked",
    category: "indicator",
    track: "full",
    reward: [{ type: "cash", description: "+20,000円", value: 20000 }],
    prerequisites: ["DATA_002"],
    difficulty: 2,
  },
  {
    id: "IND_002",
    title: "SMAをDataFrameに追加",
    description: "計算したSMAをDataFrameの列として追加",
    status: "locked",
    category: "indicator",
    track: "full",
    reward: [{ type: "cash", description: "+15,000円", value: 15000 }],
    prerequisites: ["IND_001"],
    difficulty: 2,
  },
  {
    id: "IND_003",
    title: "ゴールデンクロスを検出",
    description: "短期MAが長期MAを上抜け",
    status: "locked",
    category: "indicator",
    track: "full",
    reward: [{ type: "cash", description: "+30,000円", value: 30000 }],
    prerequisites: ["IND_002"],
    difficulty: 3,
  },
  {
    id: "IND_004",
    title: "デッドクロスを検出",
    description: "短期MAが長期MAを下抜け",
    status: "locked",
    category: "indicator",
    track: "full",
    reward: [{ type: "cash", description: "+30,000円", value: 30000 }],
    prerequisites: ["IND_003"],
    difficulty: 3,
  },
  {
    id: "IND_005",
    title: "RSIを計算する",
    description: "相対力指数(14日)を計算",
    status: "locked",
    category: "indicator",
    track: "full",
    reward: [{ type: "cash", description: "+30,000円", value: 30000 }],
    prerequisites: ["IND_001"],
    difficulty: 3,
  },
  {
    id: "IND_006",
    title: "RSI過熱判定",
    description: "RSI>70で売り、RSI<30で買い",
    status: "locked",
    category: "indicator",
    track: "full",
    reward: [{ type: "cash", description: "+35,000円", value: 35000 }],
    prerequisites: ["IND_005"],
    difficulty: 3,
  },
  {
    id: "IND_007",
    title: "ボリンジャーバンドを計算",
    description: "BB(20,2)を計算",
    status: "locked",
    category: "indicator",
    track: "full",
    reward: [{ type: "cash", description: "+35,000円", value: 35000 }],
    prerequisites: ["IND_001"],
    difficulty: 3,
  },
  {
    id: "IND_008",
    title: "複合指標戦略",
    description: "2つ以上の指標を組み合わせた戦略",
    status: "locked",
    category: "indicator",
    track: "full",
    reward: [
      { type: "cash", description: "+60,000円", value: 60000 },
      { type: "title", description: "称号「テクニカル入門」" },
    ],
    prerequisites: ["IND_003", "IND_005"],
    difficulty: 3,
  },
  {
    id: "IND_009",
    title: "MACDを計算する",
    description: "MACD(12,26,9)を計算",
    status: "locked",
    category: "indicator",
    track: "full",
    reward: [{ type: "cash", description: "+35,000円", value: 35000 }],
    prerequisites: ["IND_001"],
    difficulty: 3,
  },

  // ========================================
  // リスク管理カテゴリ（10スキル）
  // ========================================
  {
    id: "RISK_001",
    title: "ストップロスを設定する",
    description: "bt.buy(sl=価格) でSL注文",
    status: "locked",
    category: "risk",
    track: "full",
    reward: [
      { type: "cash", description: "+25,000円", value: 25000 },
      { type: "unlock", description: "SL/TP注文" },
    ],
    prerequisites: ["TRADE_001"],
    difficulty: 2,
  },
  {
    id: "RISK_002",
    title: "テイクプロフィットを設定",
    description: "bt.buy(tp=価格) でTP注文",
    status: "locked",
    category: "risk",
    track: "full",
    reward: [{ type: "cash", description: "+25,000円", value: 25000 }],
    prerequisites: ["RISK_001"],
    difficulty: 2,
  },
  {
    id: "RISK_003",
    title: "SL/TPを併用する",
    description: "両方を同時に設定",
    status: "locked",
    category: "risk",
    track: "full",
    reward: [
      { type: "cash", description: "+35,000円", value: 35000 },
      { type: "title", description: "称号「プロの心得」" },
    ],
    prerequisites: ["RISK_001", "RISK_002"],
    difficulty: 2,
  },
  {
    id: "RISK_004",
    title: "リスクリワード1:2",
    description: "SL幅の2倍のTP幅で取引",
    status: "locked",
    category: "risk",
    track: "full",
    reward: [{ type: "cash", description: "+50,000円", value: 50000 }],
    prerequisites: ["RISK_003"],
    difficulty: 3,
  },
  {
    id: "RISK_005",
    title: "finalize()で結果を確認",
    description: "バックテスト統計を確認",
    status: "locked",
    category: "risk",
    track: "full",
    reward: [{ type: "cash", description: "+20,000円", value: 20000 }],
    prerequisites: ["TRADE_007"],
    difficulty: 2,
  },
  {
    id: "RISK_006",
    title: "ドローダウンを確認する",
    description: "Max Drawdown を確認",
    status: "locked",
    category: "risk",
    track: "full",
    reward: [{ type: "cash", description: "+20,000円", value: 20000 }],
    prerequisites: ["RISK_005"],
    difficulty: 2,
  },
  {
    id: "RISK_007",
    title: "DD20%以内を達成",
    description: "最大ドローダウン20%以内",
    status: "locked",
    category: "risk",
    track: "full",
    reward: [{ type: "cash", description: "+50,000円", value: 50000 }],
    prerequisites: ["RISK_006"],
    difficulty: 3,
  },
  {
    id: "RISK_008",
    title: "DD10%以内を達成",
    description: "最大ドローダウン10%以内",
    status: "locked",
    category: "risk",
    track: "full",
    reward: [
      { type: "cash", description: "+100,000円", value: 100000 },
      { type: "title", description: "称号「堅実派」" },
    ],
    prerequisites: ["RISK_007"],
    difficulty: 4,
  },
  {
    id: "RISK_009",
    title: "ポジションサイズを調整",
    description: "資金の一部だけで取引",
    status: "locked",
    category: "risk",
    track: "full",
    reward: [{ type: "cash", description: "+30,000円", value: 30000 }],
    prerequisites: ["TRADE_001"],
    difficulty: 2,
  },
  {
    id: "RISK_010",
    title: "勝率50%以上を達成",
    description: "10取引以上で勝率50%超え",
    status: "locked",
    category: "risk",
    track: "full",
    reward: [{ type: "cash", description: "+40,000円", value: 40000 }],
    prerequisites: ["RISK_005"],
    difficulty: 3,
  },
];

// マイルストーン定義
export const milestones: Milestone[] = [
  { skillCount: 10, bonus: 50000, title: "見習い投資家" },
  { skillCount: 20, bonus: 100000, title: "新進トレーダー" },
  { skillCount: 35, bonus: 200000, item: "米国株ETF" },
  { skillCount: 42, bonus: 150000, title: "中堅トレーダー" },
  { skillCount: 50, bonus: 400000, title: "Backcastエキスパート" },
  {
    skillCount: 58,
    bonus: 600000,
    title: "マスター投資家",
    unlock: "strategy_templates",
  },
];
