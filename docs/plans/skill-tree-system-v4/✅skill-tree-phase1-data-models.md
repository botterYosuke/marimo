# Phase 1: データモデルと状態管理

**想定日数**: 3-5日
**優先度**: P0（最優先）
**依存**: なし
**ステータス**: ✅ 完了（2026-02-02）

---

## 実装状況サマリー

| 項目 | ステータス |
|------|-----------|
| types.ts 型定義拡張 | ✅ 完了 |
| skill-data.ts 59スキル定義 | ✅ 完了 |
| atoms.ts Jotai状態管理 | ✅ 完了 |
| skill-node.tsx reward配列対応 | ✅ 完了 |
| index.ts エクスポート | ✅ 完了 |
| skill-tree-button.tsx atom使用 | ✅ 完了 |
| skill-tree-panel.tsx atom使用 | ✅ 完了 |
| mock-data.ts 削除 | ✅ 完了 |
| 型チェック | ✅ パス（skill-tree関連） |

---

## 新たな知見

### 1. スキル総数の誤差
企画書では「58スキル」と記載されているが、実際にカウントすると**59スキル**になる。
- 6+3+3+5+6+3+10+4+9+10 = 59
- 実装では企画書に記載された全スキルを含めた

### 2. mock-data.tsの使用箇所
`mock-data.ts`は以下のファイルでも使用されていた（計画書に記載なし）:
- `editor/controls/skill-tree-button.tsx`
- `editor/chrome/panels/skill-tree-panel.tsx`

これらも`skillsWithStatusAtom`を使用するよう修正が必要だった。

### 3. atomWithStorageの型問題
`{ getOnInit: true }`オプションを使用すると、atomの戻り値が`T | Promise<T>`になり型エラーが発生。
LocalStorageは同期的なので、このオプションを削除して解決。

---

## 設計変更

### 1. skillsWithStatusAtomのunlock条件修正
計画書のコードでは`prerequisites.every(...)`のみだったが、`prerequisites.length === 0`の場合も考慮が必要。

```typescript
// 修正後
if (
  skill.prerequisites.length === 0 ||
  skill.prerequisites.every((prereq) =>
    progress.completedSkills.includes(prereq)
  )
) {
  status = "unlocked";
}
```

### 2. index.tsの新規作成
計画書には「エクスポート更新」とあったが、実際には`index.ts`ファイル自体が存在しなかったため新規作成。

### 3. currentTrackAtomの型明示
戻り値の型を明示的に指定:
```typescript
export const currentTrackAtom = atom<SkillTrack>((get) => { ... });
```

---

## Tips

### 1. 型チェックの実行方法
```bash
cd /d/Documents/marimo/frontend && pnpm typecheck
```
既存のエラー（backcastpro-loader.ts等）があるが、skill-tree関連は正常にコンパイルされる。

### 2. helpContentのMarkdown
バッククォートのエスケープに注意。テンプレートリテラル内では`\`\`\`python`のようにエスケープ不要。

### 3. 報酬配列の表示
skill-node.tsxでは複数報酬がある場合、最初の報酬+カウントを表示:
```tsx
{skill.reward[0].description}
{skill.reward.length > 1 && <span>+{skill.reward.length - 1}</span>}
```

### 4. LocalStorageキー
`backcast:player-progress:v1`を使用。将来のマイグレーションのためにバージョン番号を含める。

---

## 1. ゴール

- v4仕様に対応したTypeScript型定義
- Jotaiによる永続化された状態管理
- 全58スキルのデータ定義

---

## 2. 修正/作成ファイル

### 2.1 型定義の拡張

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\types.ts`

```typescript
/* Copyright 2026 Marimo. All rights reserved. */

export type SkillId = string;
export type SkillStatus = "locked" | "unlocked" | "completed";

// ★ 新規追加
export type SkillCategory =
  | "sandbox"
  | "bridge"
  | "fail"
  | "setup"
  | "data"
  | "set"
  | "trade"
  | "chart"
  | "indicator"
  | "risk";

export type SkillTrack = "sandbox" | "bridge" | "full";

export type RewardType = "cash" | "item" | "unlock" | "title";

export interface SkillReward {
  type: RewardType;
  description: string;
  value?: number;
}

export interface Skill {
  id: SkillId;
  title: string;
  description: string;
  status: SkillStatus;
  category: SkillCategory;        // ★ 新規
  track: SkillTrack;              // ★ 新規
  reward: SkillReward[];          // ★ 単一→配列に変更
  prerequisites: SkillId[];
  difficulty: 1 | 2 | 3 | 4 | 5;  // ★ 新規
  helpContent?: string;
}

// ★ 新規: プレイヤー進捗
export interface PlayerStats {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  winRate: number;
}

export type PlayerRank = "bronze" | "silver" | "gold" | "platinum" | "master";

export interface PlayerProgress {
  completedSkills: SkillId[];
  currentCash: number;
  earnedTitles: string[];
  earnedBadges: string[];
  rank: PlayerRank;
  stats: PlayerStats;
  sandboxCompleted: boolean;
  bridgeCompleted: boolean;
  hiddenBadgesFound: string[];
}

// ★ 新規: マイルストーン
export interface Milestone {
  skillCount: number;
  bonus: number;
  title?: string;
  item?: string;
  unlock?: string;
}

// 既存（変更なし）
export interface SkillNodeData {
  skill: Skill;
}

export interface SkillTreeData {
  skills: Skill[];
}

export interface SkillSelection {
  type: "skill";
  id: SkillId;
}
```

---

### 2.2 状態管理（新規）

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\atoms.ts`

```typescript
/* Copyright 2026 Marimo. All rights reserved. */

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { PlayerProgress, SkillId, Skill } from "./types";
import { skillDefinitions } from "./skill-data";
import { adaptForLocalStorage } from "@/utils/storage/jotai";

// 初期状態
const initialProgress: PlayerProgress = {
  completedSkills: [],
  currentCash: 0,
  earnedTitles: [],
  earnedBadges: [],
  rank: "bronze",
  stats: {
    totalReturn: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    totalTrades: 0,
    winRate: 0,
  },
  sandboxCompleted: false,
  bridgeCompleted: false,
  hiddenBadgesFound: [],
};

// 永続化されたプレイヤー進捗
export const playerProgressAtom = atomWithStorage<PlayerProgress>(
  "backcast:player-progress:v1",
  initialProgress,
  adaptForLocalStorage({
    toSerializable: (value) => value,
    fromSerializable: (value) => ({
      ...initialProgress,
      ...value,
    }),
  })
);

// スキル定義（読み取り専用）
export const skillDefinitionsAtom = atom<Skill[]>(skillDefinitions);

// 計算されたスキル状態（進捗を反映）
export const skillsWithStatusAtom = atom((get) => {
  const progress = get(playerProgressAtom);
  const definitions = get(skillDefinitionsAtom);

  return definitions.map((skill) => {
    let status: Skill["status"] = "locked";

    if (progress.completedSkills.includes(skill.id)) {
      status = "completed";
    } else if (
      skill.prerequisites.every((prereq) =>
        progress.completedSkills.includes(prereq)
      )
    ) {
      status = "unlocked";
    }

    return { ...skill, status };
  });
});

// スキル完了アクション
export const completeSkillAtom = atom(
  null,
  (get, set, skillId: SkillId) => {
    const progress = get(playerProgressAtom);
    const definitions = get(skillDefinitionsAtom);
    const skill = definitions.find((s) => s.id === skillId);

    if (!skill || progress.completedSkills.includes(skillId)) {
      return;
    }

    // 報酬を計算
    let cashReward = 0;
    const newTitles: string[] = [];

    for (const reward of skill.reward) {
      if (reward.type === "cash" && reward.value) {
        cashReward += reward.value;
      }
      if (reward.type === "title") {
        newTitles.push(reward.description);
      }
    }

    // 進捗を更新
    set(playerProgressAtom, {
      ...progress,
      completedSkills: [...progress.completedSkills, skillId],
      currentCash: progress.currentCash + cashReward,
      earnedTitles: [...progress.earnedTitles, ...newTitles],
      sandboxCompleted: skillId === "SANDBOX_006" || progress.sandboxCompleted,
      bridgeCompleted: skillId === "BRIDGE_003" || progress.bridgeCompleted,
    });
  }
);

// 現在のトラック
export const currentTrackAtom = atom((get) => {
  const progress = get(playerProgressAtom);

  if (progress.bridgeCompleted) return "full";
  if (progress.sandboxCompleted) return "bridge";
  return "sandbox";
});

// 進捗リセット（デバッグ用）
export const resetProgressAtom = atom(null, (_get, set) => {
  set(playerProgressAtom, initialProgress);
});
```

---

### 2.3 スキルデータ定義（新規）

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\skill-data.ts`

```typescript
/* Copyright 2026 Marimo. All rights reserved. */

import type { Skill } from "./types";

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

1. **株を買う**: 下のセルに \`bt.buy()\` と入力して実行
2. **チャートを見る**: ローソク足で株価の動きを確認
3. **時間を進める**: \`bt.step()\` で次の日に進む

### 最初の目標

「株を買って、売る」

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
for trade in bt.trades:
    print(f"銘柄: {trade.code}")
    print(f"買値: {trade.entry_price:,.0f}円")
    print(f"株数: {trade.size}株")
\`\`\``,
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
for trade in bt.trades:
    trade.close()
    print("売却完了！")
\`\`\``,
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

  // ... 残りのスキル（DATA, SET, TRADE, CHART, IND, RISK）は
  // 同様のパターンで追加（企画書セクション4参照）
  // ここでは省略、実装時に全58スキルを定義

  // ========================================
  // データ取得カテゴリ（6スキル）- 一部抜粋
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

  // ========================================
  // 基本取引カテゴリ（10スキル）- 一部抜粋
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
];

// マイルストーン定義
export const milestones = [
  { skillCount: 10, bonus: 50000, title: "見習い投資家" },
  { skillCount: 20, bonus: 100000, title: "新進トレーダー" },
  { skillCount: 35, bonus: 200000, item: "米国株ETF" },
  { skillCount: 50, bonus: 400000, title: "Backcastエキスパート" },
  { skillCount: 58, bonus: 600000, title: "マスター投資家", unlock: "strategy_templates" },
];
```

---

## 3. タスク一覧

| # | タスク | ファイル | 詳細 | ステータス |
|---|-------|---------|------|-----------|
| 1.1 | 型定義の拡張 | `types.ts` | category, track, difficulty, 複数報酬対応 | ✅ |
| 1.2 | Jotai atoms作成 | `atoms.ts` | playerProgress, skillsWithStatus, completeSkill | ✅ |
| 1.3 | スキルデータ作成 | `skill-data.ts` | 全59スキル + マイルストーン | ✅ |
| 1.4 | mock-data.ts削除 | `mock-data.ts` | 不要になるため削除 | ✅ |
| 1.5 | エクスポート更新 | `index.ts` | 新規ファイルのエクスポート追加 | ✅ |
| 1.6 | skill-node.tsx修正 | `skill-node.tsx` | reward配列対応 | ✅ |
| 1.7 | skill-tree-button.tsx修正 | `skill-tree-button.tsx` | atom使用に変更 | ✅ |
| 1.8 | skill-tree-panel.tsx修正 | `skill-tree-panel.tsx` | atom使用に変更 | ✅ |

---

## 4. テスト戦略

### 4.1 型チェック

```bash
cd D:\Documents\marimo\frontend
pnpm typecheck
```

### 4.2 ユニットテスト

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\__tests__\atoms.test.ts`

```typescript
import { createStore } from "jotai";
import { playerProgressAtom, completeSkillAtom, skillsWithStatusAtom } from "../atoms";
import { skillDefinitions } from "../skill-data";

describe("skill-tree atoms", () => {
  it("should have 58 skill definitions", () => {
    expect(skillDefinitions.length).toBe(58);
  });

  it("should initialize with empty progress", () => {
    const store = createStore();
    const progress = store.get(playerProgressAtom);
    expect(progress.completedSkills).toEqual([]);
    expect(progress.currentCash).toBe(0);
  });

  it("should complete skill and add rewards", () => {
    const store = createStore();
    store.set(completeSkillAtom, "SANDBOX_001");

    const progress = store.get(playerProgressAtom);
    expect(progress.completedSkills).toContain("SANDBOX_001");
    expect(progress.currentCash).toBe(30000);
    expect(progress.earnedTitles).toContain("称号「初陣」");
  });

  it("should unlock dependent skills", () => {
    const store = createStore();
    store.set(completeSkillAtom, "SANDBOX_001");

    const skills = store.get(skillsWithStatusAtom);
    const sandbox002 = skills.find(s => s.id === "SANDBOX_002");
    expect(sandbox002?.status).toBe("unlocked");
  });
});
```

---

## 5. 完了条件

- [x] `types.ts` に全ての新規型が定義されている ✅
- [x] `atoms.ts` が動作し、LocalStorageに永続化される ✅
- [x] `skill-data.ts` に全59スキルが定義されている ✅
- [x] 型チェック（`pnpm typecheck`）がパス ✅（skill-tree関連）
- [ ] ユニットテストがパス（Phase 2で実施予定）
- [x] 既存のスキルツリーUIがエラーなく動作（データ構造の変更に対応） ✅

---

## 6. 次のフェーズへの引き継ぎ

Phase 1完了後、以下が利用可能になる：

### エクスポート（`@/components/skill-tree`から）

**Atoms:**
- `playerProgressAtom`: 永続化されたプレイヤー進捗
- `skillDefinitionsAtom`: 全59スキルの定義（読み取り専用）
- `skillsWithStatusAtom`: 進捗を反映したスキル配列
- `completeSkillAtom`: スキル完了アクション
- `currentTrackAtom`: 現在のトラック（sandbox/bridge/full）
- `resetProgressAtom`: 進捗リセット（デバッグ用）

**Data:**
- `skillDefinitions`: 全59スキルの定義配列
- `milestones`: マイルストーン定義（5件）

**Types:**
- `Skill`, `SkillId`, `SkillStatus`, `SkillCategory`, `SkillTrack`
- `SkillReward`, `RewardType`
- `PlayerProgress`, `PlayerStats`, `PlayerRank`
- `Milestone`

### Phase 2で必要な作業

1. スキル完了トリガーの実装（Pythonコード実行検知）
2. `completeSkillAtom`を呼び出すフック/コンポーネント
3. ユニットテストの追加
