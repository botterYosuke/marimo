# Phase 4: サンドボックスモード

**想定日数**: 1-2日
**優先度**: P1
**依存**: Phase 0-A（Electron拡張）, Phase 1, 2
**ステータス**: 完了

---

## 1. ゴール

- プリロード済みデータでの即時起動
- サンドボックス専用UI（SandboxIndicator）
- SANDBOX_001-006の自動検出
- サンドボックス卒業→ブリッジモードへのセル注入

---

## 2. サンドボックスの設計思想（v4）

```
┌─────────────────────────────────────────────────────────────┐
│                    サンドボックスモード                        │
│                                                             │
│  backcast.py の _GAME_PROGRESS["current_mode"] = "sandbox"  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ bt.buy()  →  株を買う                               │   │
│  │ bt.step() →  時間を進める                           │   │
│  │ trade.close() → 売る                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  背後で自動的に（with app.setup:内）:                        │
│  - get_stock_daily("7203") でデータ取得済み                  │
│  - Backtest(cash=100_000) で初期化済み                       │
│  - チャートも表示済み                                         │
│                                                             │
│  スキル完了時:                                               │
│  - Frontend が検知 → Electron IPC → セル注入                │
│  - _GAME_PROGRESS が更新される                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 実装済みファイル

### 3.1 backcast.py のサンドボックス初期化

**場所**: `frontend/public/files/backcast.py` の `with app.setup:` 節

```python
with app.setup:
    from BackcastPro import Backtest, get_stock_daily

    # 進捗データ（モード管理を含む）
    _GAME_PROGRESS = {
        "version": 1,
        "completed_skills": [],
        "current_mode": "sandbox",  # ← サンドボックスモード
        "cash": 0,
        "titles": [],
    }

    # サンドボックスモード: 自動初期化
    bt = Backtest(cash=1_000_000, commission=0.001)

    # ヘッドレス取引イベントを有効化
    enable_headless_trade_events(bt)
```

### 3.2 サンドボックススキルのトリガー

スキルトリガーは `_emit_skill()` で実装済み。ユーザーのアクションに応じて発火:

| スキル | トリガー条件 | 実装場所 |
|-------|-------------|---------|
| SANDBOX_001 | ゲーム起動 | 初回ロード時に自動 |
| SANDBOX_002 | `bt.buy()` 実行 | ユーザーセル |
| SANDBOX_003 | `bt.trades` アクセス | ユーザーセル |
| SANDBOX_004 | `trade.close()` 実行 | ユーザーセル |
| SANDBOX_005 | チャートで振り返る | SANDBOX_003,004完了後 |
| SANDBOX_006 | 全完了 | 自動判定 |

### 3.3 サンドボックス卒業時のセル注入

**ファイル**: `injection-templates.ts`

```typescript
{
  skillId: "SANDBOX_006",
  description: "サンドボックス卒業時、ブリッジモードへの案内を追加",
  cells: [
    {
      name: "_bridge_intro",
      code: `mo.md('''
## サンドボックス卒業！

おめでとうございます！基本操作をマスターしました。

### 次のステージ: ブリッジモード

サンドボックスでは、裏で自動的にデータが準備されていました。
ブリッジモードでは、その「魔法」の正体を明かします。
''')`,
      afterCell: "_playground",
    },
  ],
}
```

### 3.4 Frontend: SandboxIndicator

**ファイル**: `frontend/src/components/skill-tree/sandbox-indicator.tsx`

```typescript
export function SandboxIndicator() {
  const progress = useAtomValue(playerProgressAtom);
  const skills = useAtomValue(skillsWithStatusAtom);

  // サンドボックススキルのみ抽出
  const sandboxSkills = skills.filter((s) => s.track === "sandbox");
  const completedCount = sandboxSkills.filter(
    (s) => s.status === "completed"
  ).length;

  if (progress.sandboxCompleted) {
    return (
      <div className="flex items-center gap-2 ...">
        <CheckCircleIcon className="w-5 h-5 text-green-500" />
        <span>サンドボックス完了！</span>
        <Badge variant="success">ブリッジモード解禁</Badge>
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/50 border rounded-lg space-y-3">
      <Progress value={progressPercent} />
      {/* 進捗メッセージ */}
    </div>
  );
}
```

---

## 4. サンドボックススキルフロー

```
SANDBOX_001: マーケットへようこそ
    │ トリガー: ゲーム起動
    │ 報酬: +30,000円, 称号「初陣」
    ▼
SANDBOX_002: 初めての購入 ←──────────┐
    │ トリガー: bt.buy() 実行        │
    │ 報酬: +20,000円                │
    │ → セル注入: _hint_check_trades │
    ├──────────────────────────────→ FAIL_001: 初めての含み損
    ▼                                 │ トリガー: trade.pl < 0
SANDBOX_003: 買値を確認する            │ 報酬: +5,000円
    │ トリガー: bt.trades アクセス     ▼
    │ 報酬: +10,000円              FAIL_002: 初めての損切り
    ▼                               │ トリガー: 損失確定
SANDBOX_004: 初めての売却             │ 報酬: +10,000円
    │ トリガー: trade.close()
    │ 報酬: +20,000円
    │ → セル注入: _hint_review_chart
    ▼
SANDBOX_005: チャートで振り返る
    │ トリガー: SANDBOX_003,004完了
    │ 報酬: +20,000円
    ▼
SANDBOX_006: サンドボックス卒業
    │ トリガー: 上記全完了
    │ 報酬: +50,000円
    │ → セル注入: _bridge_intro
    │ → _GAME_PROGRESS["current_mode"] = "bridge"
    ▼
  ブリッジモードへ
```

---

## 5. タスク一覧

| # | タスク | ファイル | ステータス |
|---|-------|---------|-----------|
| 4.1 | サンドボックス初期化 | `backcast.py` | ✅ 完了 |
| 4.2 | スキルトリガー実装 | `backcast.py` | ✅ 完了 |
| 4.3 | 注入テンプレート追加 | `injection-templates.ts` | ✅ 完了 |
| 4.4 | SandboxIndicator | `sandbox-indicator.tsx` | ✅ 完了 |
| 4.5 | パネル統合 | `skill-tree-panel.tsx` | ✅ 完了 |

---

## 6. テスト戦略

### 6.1 サンドボックス起動テスト

```typescript
describe("Sandbox mode", () => {
  it("should start with sandbox mode", async () => {
    const progress = await loadProgressFromNotebook();
    expect(progress.current_mode).toBe("sandbox");
  });

  it("should inject cells on SANDBOX_006 completion", async () => {
    const result = await handleSkillComplete("SANDBOX_006", mockProgress);
    expect(result.success).toBe(true);
    // ノートブックに _bridge_intro セルが追加されていることを確認
  });
});
```

### 6.2 E2Eテスト

1. backcast.py を開く
2. `bt.buy()` を実行 → SANDBOX_002 達成
3. `bt.trades` をアクセス → SANDBOX_003 達成
4. `trade.close()` を実行 → SANDBOX_004 達成
5. 全スキル完了 → SANDBOX_006 達成、セル注入

---

## 7. 完了条件

- [x] `_GAME_PROGRESS["current_mode"] = "sandbox"` で初期化
- [x] SANDBOX_001が起動時に自動トリガー
- [x] 6スキル全てのトリガーが動作
- [x] スキル完了時にセルが注入される
- [x] SandboxIndicatorが進捗表示
- [x] 卒業時にブリッジモードへ移行

---

## 8. 次のフェーズへの引き継ぎ

Phase 4完了後:

- サンドボックススキル（SANDBOX_001-006）が動作
- 失敗スキル（FAIL_001-002）がサンドボックス中に達成可能
- 卒業時に `_GAME_PROGRESS["current_mode"] = "bridge"` に更新
- ブリッジモード案内セルが注入される

**BackcastProへの変更は不要**（純粋なライブラリのまま維持）
