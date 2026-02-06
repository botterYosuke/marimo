# Phase 5: ブリッジモード

**想定日数**: 1-2日
**優先度**: P1
**依存**: Phase 4（サンドボックス完了）
**ステータス**: 完了

---

## 1. ゴール

- サンドボックスとフルモードの橋渡し
- 裏側のコードを可視化（セル注入で実現）
- BRIDGE_001-003の実装
- フルモードへの卒業フロー

---

## 2. ブリッジモードの設計思想（v4）

```
サンドボックス                 ブリッジ                    フルモード
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│ 魔法のように  │          │ 魔法の種明かし │          │ 自分で魔法を  │
│ すぐ動く     │    →     │ コードが見える │    →     │ 唱える       │
└──────────────┘          └──────────────┘          └──────────────┘

_GAME_PROGRESS["current_mode"]:
   "sandbox"         →        "bridge"         →        "full"
```

### v4での実装方法

- **ノートブック切り替えは行わない**（単一のbackcast.py）
- SANDBOX_006完了時にセル注入で「ブリッジ解説セル」を追加
- BRIDGE_001-003完了時に追加のセルを注入
- BRIDGE_003完了時に`current_mode = "full"`に更新

---

## 3. 実装済みファイル

### 3.1 ブリッジスキルのセル注入

**ファイル**: `injection-templates.ts`

```typescript
// BRIDGE_001: データの正体
{
  skillId: "BRIDGE_001",
  description: "データの正体を確認した後、setup節の解説を追加",
  cells: [
    {
      name: "_reveal_setup_code",
      code: `mo.md('''
## サンドボックスの裏側

実は、あなたが \`bt.buy()\` を使えていたのは、
裏でこのコードが動いていたからです：

\`\`\`python
from BackcastPro import Backtest, get_stock_daily

# データ取得
df = get_stock_daily("7203")  # トヨタ

# Backtest初期化
bt = Backtest(cash=100_000, commission=0.001)
bt.set_data({"7203": df})
bt.start()
\`\`\`

これがないと \`buy()\` は使えません！
''')`,
      afterCell: "_playground",
    },
  ],
}

// BRIDGE_002: 自分でデータを取得
{
  skillId: "BRIDGE_002",
  description: "自分でデータを取得した後、ソニーデータ追加のヒント",
  cells: [
    {
      name: "_hint_sony_data",
      code: `
# サンプル: ソニーのデータを取得
sony_code = "6758"
df_sony = get_stock_daily(sony_code)
mo.md(f'''
## ソニー(6758)のデータを取得しました！

データ期間: {df_sony.index[0]} 〜 {df_sony.index[-1]}
''')`,
      afterCell: "_reveal_setup_code",
    },
  ],
}

// BRIDGE_003: フルモードへ
{
  skillId: "BRIDGE_003",
  description: "フルモード解放時、セットアップ手順のテンプレートを追加",
  cells: [
    {
      name: "_full_mode_template",
      code: `mo.md('''
## フルモード解禁！

これからは自分で0からセットアップします。

### セットアップ手順

\`\`\`python
# 1. Backtest初期化
bt = Backtest(cash=1_000_000, commission=0.001)

# 2. 株価データ取得
code = "7203"
df = get_stock_daily(code)

# 3. データをセット
bt.set_data({code: df})

# 4. これで準備完了！
bt.buy()  # 買える！
\`\`\`
''')`,
      afterCell: "_playground",
    },
  ],
}
```

### 3.2 モード変更ハンドリング

**ファイル**: `skill-complete-handler.ts`

```typescript
export async function handleSkillComplete(
  skillId: string,
  currentProgress: GameProgress
): Promise<{ success: boolean; error?: string }> {
  // ...

  // モード変更の処理
  if (skillId === "SANDBOX_006") {
    updatedProgress.current_mode = "bridge";
  } else if (skillId === "BRIDGE_003") {
    updatedProgress.current_mode = "full";
  }

  // ...
}
```

### 3.3 Frontend: BridgeIndicator

**ファイル**: `frontend/src/components/skill-tree/bridge-indicator.tsx`

```typescript
export function BridgeIndicator() {
  const progress = useAtomValue(playerProgressAtom);
  const skills = useAtomValue(skillsWithStatusAtom);

  // サンドボックス未完了なら表示しない
  if (!progress.sandboxCompleted) {
    return null;
  }

  // ブリッジスキルのみ抽出
  const bridgeSkills = skills.filter((s) => s.track === "bridge");
  const completedCount = bridgeSkills.filter(
    (s) => s.status === "completed"
  ).length;

  if (progress.bridgeCompleted) {
    return (
      <div className="flex items-center gap-2 ...">
        <CheckCircleIcon className="w-5 h-5 text-blue-500" />
        <span>ブリッジ完了！</span>
        <Badge variant="default">フルモード解禁</Badge>
      </div>
    );
  }

  return (
    <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
      <Progress value={progressPercent} />
      {/* 進捗メッセージ */}
    </div>
  );
}
```

---

## 4. ブリッジスキルフロー

```
SANDBOX_006: サンドボックス卒業
    │ → _GAME_PROGRESS["current_mode"] = "bridge"
    │ → セル注入: _bridge_intro
    ▼
BRIDGE_001: データの正体
    │ トリガー: _reveal_setup_codeセルを表示/実行
    │ 報酬: +15,000円
    │ → セル注入: _reveal_setup_code
    ▼
BRIDGE_002: 自分でデータを取得
    │ トリガー: get_stock_daily() を実行
    │ 報酬: +20,000円, 銘柄: ソニー
    │ → セル注入: _hint_sony_data
    ▼
BRIDGE_003: フルモードへ
    │ トリガー: 新しいセットアップを完了
    │ 報酬: +25,000円, フルモード解禁
    │ → セル注入: _full_mode_template
    │ → _GAME_PROGRESS["current_mode"] = "full"
    ▼
  フルモードへ（SETUP_001から開始）
```

---

## 5. タスク一覧

| # | タスク | ファイル | ステータス |
|---|-------|---------|-----------|
| 5.1 | BRIDGE_001注入テンプレート | `injection-templates.ts` | ✅ 完了 |
| 5.2 | BRIDGE_002注入テンプレート | `injection-templates.ts` | ✅ 完了 |
| 5.3 | BRIDGE_003注入テンプレート | `injection-templates.ts` | ✅ 完了 |
| 5.4 | モード変更ハンドリング | `skill-complete-handler.ts` | ✅ 完了 |
| 5.5 | BridgeIndicator | `bridge-indicator.tsx` | ✅ 完了 |

---

## 6. テスト戦略

### 6.1 ブリッジモードテスト

```typescript
describe("Bridge mode", () => {
  it("should transition to bridge mode on SANDBOX_006", async () => {
    await handleSkillComplete("SANDBOX_006", mockProgress);
    const progress = await loadProgressFromNotebook();
    expect(progress.current_mode).toBe("bridge");
  });

  it("should transition to full mode on BRIDGE_003", async () => {
    await handleSkillComplete("BRIDGE_003", { current_mode: "bridge" });
    const progress = await loadProgressFromNotebook();
    expect(progress.current_mode).toBe("full");
  });

  it("should inject reveal_setup_code on BRIDGE_001", async () => {
    const result = await handleSkillComplete("BRIDGE_001", mockProgress);
    expect(result.success).toBe(true);
    // ノートブックに _reveal_setup_code セルが追加されていることを確認
  });
});
```

### 6.2 E2Eテスト

1. サンドボックス完了後、ブリッジモードに移行
2. `_reveal_setup_code` セルが追加されていることを確認
3. `get_stock_daily("6758")` を実行 → BRIDGE_002 達成
4. `_hint_sony_data` セルが追加されていることを確認
5. 全完了後、フルモードに移行

---

## 7. 完了条件

- [x] SANDBOX_006完了時に `current_mode = "bridge"` に更新
- [x] BRIDGE_001-003のセル注入テンプレートが定義されている
- [x] BRIDGE_003完了時に `current_mode = "full"` に更新
- [x] BridgeIndicatorが進捗表示
- [x] 卒業時にフルモードスキルがアンロック

---

## 8. 次のフェーズへの引き継ぎ

Phase 5完了後:

- ブリッジスキル（BRIDGE_001-003）が動作
- `_GAME_PROGRESS["current_mode"]` が "sandbox" → "bridge" → "full" と遷移
- ブリッジ完了時に `playerProgress.bridgeCompleted = true`
- フルモード（SETUP_001〜）がアンロック

**BackcastProへの変更は不要**（純粋なライブラリのまま維持）
