# Phase 6: フルモード機能

**想定日数**: 3-5日
**優先度**: P1
**依存**: Phase 5（ブリッジ完了）
**ステータス**: 部分完了（主要テンプレート実装済み、追加は任意）

---

## 1. ゴール

- 残り49スキル（SETUP, DATA, SET, TRADE, CHART, IND, RISK）の注入テンプレート作成
- 複雑なトリガー条件（インジケーター検出、リスク管理）
- パフォーマンス評価システム

---

## 2. v4でのフルモード設計

```
┌─────────────────────────────────────────────────────────────┐
│                       フルモード                             │
│                                                             │
│  backcast.py の _GAME_PROGRESS["current_mode"] = "full"     │
│                                                             │
│  フルモードでは:                                             │
│  - ユーザーが自分でBacktestを初期化                           │
│  - 好きな銘柄を取得・設定                                     │
│  - インジケーター（SMA, RSI等）を追加                         │
│  - リスク管理（SL/TP）を設定                                  │
│                                                             │
│  スキル完了時:                                               │
│  - Frontend が検知 → Electron IPC → セル注入（ヒント）       │
│  - _GAME_PROGRESS が更新される                               │
└─────────────────────────────────────────────────────────────┘
```

### v4での実装方法

- **ノートブック切り替えは行わない**（単一のbackcast.py）
- `_emit_skill()` は `with app.setup:` 内で定義済み（ユーザーがコード内で呼び出し可能）
- スキル完了時にセル注入でヒントやヘルパーコードを追加
- 将来的にはPython側のフック（`bt.buy()` 時に自動で `_emit_skill()` を呼び出す）を追加予定

---

## 3. カテゴリ別スキル一覧

### 3.1 セットアップ（5スキル）

| ID | トリガー条件 | 注入テンプレート |
|----|------------|-----------------|
| SETUP_001 | marimo edit実行 | なし |
| SETUP_002 | import文実行 | なし |
| SETUP_003 | Backtest()初期化 | なし |
| SETUP_004 | cash変更 | なし |
| SETUP_005 | commission設定 | なし |

### 3.2 データ取得（6スキル）

| ID | トリガー条件 | 注入テンプレート |
|----|------------|-----------------|
| DATA_001 | get_stock_daily実行 | なし |
| DATA_002 | DataFrame確認 | なし |
| DATA_003 | OHLCV理解 | なし |
| DATA_004 | 別銘柄取得 | なし |
| DATA_005 | 複数銘柄取得 | なし |
| DATA_006 | 日付範囲指定 | なし |

### 3.3 インジケーター（9スキル）

| ID | トリガー条件 | 注入テンプレート |
|----|------------|-----------------|
| IND_001 | SMA計算 | `_hint_sma_usage` |
| IND_002 | SMA列追加 | なし |
| IND_003 | ゴールデンクロス | なし |
| IND_004 | デッドクロス | なし |
| IND_005 | RSI計算 | なし |
| IND_006 | RSI過熱判定 | なし |
| IND_007 | ボリンジャーバンド | なし |
| IND_008 | 複合指標 | なし |
| IND_009 | MACD計算 | なし |

### 3.4 リスク管理（10スキル）

| ID | トリガー条件 | 注入テンプレート |
|----|------------|-----------------|
| RISK_001 | SL設定 | `_hint_risk_management` |
| RISK_002 | TP設定 | なし |
| RISK_003 | SL/TP併用 | なし |
| RISK_004 | RR 1:2 | なし |
| RISK_005 | finalize実行 | なし |
| RISK_006 | DD確認 | なし |
| RISK_007 | DD < 20% | なし |
| RISK_008 | DD < 10% | なし |
| RISK_009 | サイズ調整 | なし |
| RISK_010 | 勝率50%+ | なし |

---

## 4. 実装済みの注入テンプレート

**ファイル**: `injection-templates.ts`

```typescript
// IND_001: 移動平均線を計算
{
  skillId: "IND_001",
  description: "移動平均線を計算した後、SMAの使い方ヒント",
  cells: [
    {
      name: "_hint_sma_usage",
      code: `mo.md('''
## 移動平均線(SMA)を使った戦略

### ゴールデンクロス戦略

短期SMAが長期SMAを上抜けたら買い：

\`\`\`python
# 短期(5日)と長期(20日)のSMA
df["SMA5"] = df["Close"].rolling(5).mean()
df["SMA20"] = df["Close"].rolling(20).mean()

# クロス判定
if df["SMA5"].iloc[-1] > df["SMA20"].iloc[-1]:
    if df["SMA5"].iloc[-2] <= df["SMA20"].iloc[-2]:
        bt.buy(tag="golden_cross")
\`\`\`
''')`,
      afterCell: "_playground",
    },
  ],
}

// RISK_001: ストップロスを設定
{
  skillId: "RISK_001",
  description: "ストップロス設定後、リスク管理のヒント",
  cells: [
    {
      name: "_hint_risk_management",
      code: `mo.md('''
## リスク管理の基本

### ストップロス(SL)とテイクプロフィット(TP)

\`\`\`python
# 買い注文時にSL/TPを設定
bt.buy(
    sl=2400,  # この価格以下で自動損切り
    tp=2700,  # この価格以上で自動利確
    tag="managed_trade"
)
\`\`\`

### リスクリワード比

推奨: 1:2以上（リスク1に対してリワード2）

例: SL幅100円なら、TP幅は200円以上
''')`,
      afterCell: "_playground",
    },
  ],
}
```

---

## 5. スキルデータ定義

**ファイル**: `skill-data.ts`

全59スキルの完全な定義を追加（Phase 1で作成済み）:

- SANDBOX_001〜006（6スキル）
- BRIDGE_001〜003（3スキル）
- FAIL_001〜003（3スキル）
- SETUP_001〜005（5スキル）
- DATA_001〜006（6スキル）
- SET_001〜003（3スキル）
- TRADE_001〜010（10スキル）
- CHART_001〜004（4スキル）
- IND_001〜009（9スキル）
- RISK_001〜010（10スキル）

---

## 6. タスク一覧

| # | タスク | ファイル | ステータス |
|---|-------|---------|-----------|
| 6.1 | skill-data.ts完成 | `skill-data.ts` | ✅ 完了（Phase 1） |
| 6.2 | IND_001注入テンプレート | `injection-templates.ts` | ✅ 完了 |
| 6.3 | RISK_001注入テンプレート | `injection-templates.ts` | ✅ 完了 |
| 6.4 | 追加の注入テンプレート | `injection-templates.ts` | 任意（必要に応じて追加） |

---

## 7. 将来の拡張: Python側のスキルトリガー自動化

現在の実装では、フルモードのスキルトリガーはユーザーが手動で確認・完了する必要があります。

将来的には、`backcast.py` の `with app.setup:` 内で以下のような自動トリガーを追加可能:

```python
# 将来の実装例
_original_buy = bt.buy

def _buy_with_skill(*args, **kwargs):
    result = _original_buy(*args, **kwargs)
    _emit_skill("TRADE_001")
    if kwargs.get("sl"):
        _emit_skill("RISK_001")
    if kwargs.get("tp"):
        _emit_skill("RISK_002")
    return result

bt.buy = _buy_with_skill
```

---

## 8. テスト戦略

### 8.1 注入テンプレートテスト

```typescript
describe("Injection templates", () => {
  it("should have template for IND_001", () => {
    const template = getInjectionTemplate("IND_001");
    expect(template).toBeDefined();
    expect(template.cells).toHaveLength(1);
    expect(template.cells[0].name).toBe("_hint_sma_usage");
  });

  it("should have template for RISK_001", () => {
    const template = getInjectionTemplate("RISK_001");
    expect(template).toBeDefined();
    expect(template.cells).toHaveLength(1);
    expect(template.cells[0].name).toBe("_hint_risk_management");
  });
});
```

### 8.2 E2Eテスト

1. BRIDGE_003完了後、フルモードに移行
2. SMAを計算 → IND_001達成、`_hint_sma_usage`セル注入
3. `bt.buy(sl=...)` 実行 → RISK_001達成、`_hint_risk_management`セル注入

---

## 9. 完了条件

- [x] skill-data.ts に全59スキルが定義されている
- [x] IND_001, RISK_001の注入テンプレートが定義されている
- [ ] 追加の注入テンプレート（任意）
- [ ] 将来の自動トリガー実装（任意）

---

## 10. 次のフェーズへの引き継ぎ

Phase 6完了後:

- 全59スキルの定義が `skill-data.ts` に存在
- 主要スキル（IND_001, RISK_001等）の注入テンプレートが存在
- フルモードのスキル達成はユーザーの進捗に基づきフロントエンドで判定

**BackcastProへの変更は不要**（純粋なライブラリのまま維持）
