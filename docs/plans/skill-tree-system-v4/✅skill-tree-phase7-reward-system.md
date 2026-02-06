# Phase 7: 報酬システム

**想定日数**: 3-4日
**優先度**: P2
**依存**: Phase 6（フルモード完了）
**ステータス**: ✅ 完了（2026-02-04）

---

## 1. ゴール

- 現金報酬の累積計算
- マイルストーンボーナス
- 称号・アイテム獲得
- 報酬通知UI

---

## 2. 報酬設計

### 2.1 カテゴリ別報酬合計

| カテゴリ | スキル数 | 報酬合計 | 平均/スキル |
|---------|---------|---------|------------|
| サンドボックス | 6 | 150,000円 | 25,000円 |
| ブリッジ | 3 | 60,000円 | 20,000円 |
| 失敗 | 3 | 35,000円 | 11,667円 |
| セットアップ | 5 | 50,000円 | 10,000円 |
| データ取得 | 6 | 100,000円 | 16,667円 |
| データセット | 3 | 70,000円 | 23,333円 |
| 基本取引 | 10 | 195,000円 | 19,500円 |
| チャート | 4 | 65,000円 | 16,250円 |
| インジケーター | 9 | 290,000円 | 32,222円 |
| リスク管理 | 10 | 395,000円 | 39,500円 |
| **合計** | **58** | **1,410,000円** | **24,310円** |

### 2.2 マイルストーン報酬

| スキル数 | ボーナス | 称号/アイテム |
|---------|---------|-------------|
| 10 | 50,000円 | 称号「見習い投資家」 |
| 20 | 100,000円 | 称号「新進トレーダー」 |
| 35 | 200,000円 | 銘柄「米国株ETF」 |
| 50 | 400,000円 | 称号「Backcastエキスパート」 |
| 58 | 600,000円 | 称号「マスター投資家」+ 戦略テンプレート |

**マイルストーン合計**: 1,350,000円

### 2.3 総報酬

- スキル報酬: 1,410,000円
- マイルストーン: 1,350,000円
- **総計: 2,760,000円**

---

## 3. 修正/作成ファイル

### 3.1 報酬計算ロジック

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\rewards\reward-system.ts`

```typescript
/* Copyright 2026 Marimo. All rights reserved. */

import type { Skill, SkillReward, Milestone, PlayerProgress } from "../types";
import { skillDefinitions, milestones } from "../skill-data";

export interface RewardResult {
  cashEarned: number;
  titlesEarned: string[];
  itemsEarned: string[];
  unlocksEarned: string[];
  milestoneReached: Milestone | null;
}

/**
 * スキル完了時の報酬を計算
 */
export function calculateSkillReward(skillId: string): RewardResult {
  const skill = skillDefinitions.find((s) => s.id === skillId);

  if (!skill) {
    return {
      cashEarned: 0,
      titlesEarned: [],
      itemsEarned: [],
      unlocksEarned: [],
      milestoneReached: null,
    };
  }

  const result: RewardResult = {
    cashEarned: 0,
    titlesEarned: [],
    itemsEarned: [],
    unlocksEarned: [],
    milestoneReached: null,
  };

  for (const reward of skill.reward) {
    switch (reward.type) {
      case "cash":
        result.cashEarned += reward.value ?? 0;
        break;
      case "title":
        result.titlesEarned.push(reward.description);
        break;
      case "item":
        result.itemsEarned.push(reward.description);
        break;
      case "unlock":
        result.unlocksEarned.push(reward.description);
        break;
    }
  }

  return result;
}

/**
 * マイルストーン到達をチェック
 */
export function checkMilestone(
  completedCount: number,
  previousCount: number
): Milestone | null {
  for (const milestone of milestones) {
    if (completedCount >= milestone.skillCount && previousCount < milestone.skillCount) {
      return milestone;
    }
  }
  return null;
}

/**
 * 累計報酬を計算
 */
export function calculateTotalRewards(
  completedSkills: string[]
): {
  totalCash: number;
  milestoneCash: number;
  titles: string[];
  items: string[];
  unlocks: string[];
} {
  let totalCash = 0;
  let milestoneCash = 0;
  const titles: string[] = [];
  const items: string[] = [];
  const unlocks: string[] = [];

  // スキル報酬
  for (const skillId of completedSkills) {
    const result = calculateSkillReward(skillId);
    totalCash += result.cashEarned;
    titles.push(...result.titlesEarned);
    items.push(...result.itemsEarned);
    unlocks.push(...result.unlocksEarned);
  }

  // マイルストーン報酬
  for (const milestone of milestones) {
    if (completedSkills.length >= milestone.skillCount) {
      milestoneCash += milestone.bonus;
      if (milestone.title) {
        titles.push(milestone.title);
      }
      if (milestone.item) {
        items.push(milestone.item);
      }
      if (milestone.unlock) {
        unlocks.push(milestone.unlock);
      }
    }
  }

  return {
    totalCash: totalCash + milestoneCash,
    milestoneCash,
    titles,
    items,
    unlocks,
  };
}
```

---

### 3.2 報酬通知コンポーネント

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\rewards\reward-notification.tsx`

```typescript
/* Copyright 2026 Marimo. All rights reserved. */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GiftIcon,
  TrophyIcon,
  SparklesIcon,
  CoinsIcon,
} from "lucide-react";
import { cn } from "@/utils/cn";
import type { RewardResult, Milestone } from "../types";

interface RewardNotificationProps {
  reward: RewardResult | null;
  milestone: Milestone | null;
  onClose: () => void;
}

export function RewardNotification({
  reward,
  milestone,
  onClose,
}: RewardNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (reward || milestone) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [reward, milestone, onClose]);

  if (!reward && !milestone) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed bottom-8 right-8 z-50"
        >
          <div
            className={cn(
              "rounded-xl shadow-2xl p-6 min-w-[300px]",
              milestone
                ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white"
                : "bg-gradient-to-br from-green-500 to-emerald-600 text-white"
            )}
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              {milestone ? (
                <TrophyIcon className="w-8 h-8" />
              ) : (
                <SparklesIcon className="w-8 h-8" />
              )}
              <div>
                <h3 className="font-bold text-lg">
                  {milestone ? "マイルストーン達成！" : "スキル達成！"}
                </h3>
                {milestone && (
                  <p className="text-sm opacity-90">
                    {milestone.skillCount}スキル達成
                  </p>
                )}
              </div>
            </div>

            {/* Rewards */}
            <div className="space-y-2">
              {/* Cash */}
              {(reward?.cashEarned ?? 0) > 0 && (
                <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                  <CoinsIcon className="w-5 h-5" />
                  <span className="font-semibold">
                    +{(reward?.cashEarned ?? 0).toLocaleString()}円
                  </span>
                </div>
              )}

              {/* Milestone Bonus */}
              {milestone && (
                <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                  <TrophyIcon className="w-5 h-5" />
                  <span className="font-semibold">
                    ボーナス +{milestone.bonus.toLocaleString()}円
                  </span>
                </div>
              )}

              {/* Titles */}
              {reward?.titlesEarned.map((title, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2"
                >
                  <GiftIcon className="w-5 h-5" />
                  <span>{title}</span>
                </div>
              ))}

              {/* Items */}
              {reward?.itemsEarned.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2"
                >
                  <GiftIcon className="w-5 h-5" />
                  <span>{item}</span>
                </div>
              ))}

              {/* Milestone Title */}
              {milestone?.title && (
                <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                  <TrophyIcon className="w-5 h-5" />
                  <span>称号「{milestone.title}」獲得！</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

### 3.3 報酬サマリーパネル

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\rewards\reward-summary.tsx`

```typescript
/* Copyright 2026 Marimo. All rights reserved. */

import React from "react";
import { useAtomValue } from "jotai";
import {
  CoinsIcon,
  TrophyIcon,
  GiftIcon,
  UnlockIcon,
  TargetIcon,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { playerProgressAtom } from "../atoms";
import { calculateTotalRewards } from "./reward-system";
import { milestones } from "../skill-data";

export function RewardSummary() {
  const progress = useAtomValue(playerProgressAtom);
  const completedCount = progress.completedSkills.length;

  const {
    totalCash,
    milestoneCash,
    titles,
    items,
    unlocks,
  } = calculateTotalRewards(progress.completedSkills);

  // 次のマイルストーン
  const nextMilestone = milestones.find(
    (m) => m.skillCount > completedCount
  );

  const progressToNext = nextMilestone
    ? ((completedCount / nextMilestone.skillCount) * 100)
    : 100;

  return (
    <div className="p-4 space-y-4">
      {/* 総報酬 */}
      <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <CoinsIcon className="w-5 h-5 text-amber-500" />
          <span className="font-medium">総報酬</span>
        </div>
        <p className="text-2xl font-bold">
          ¥{totalCash.toLocaleString()}
        </p>
        <p className="text-sm text-muted-foreground">
          (マイルストーン ¥{milestoneCash.toLocaleString()} 含む)
        </p>
      </div>

      {/* 進捗 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>スキル達成</span>
          <span className="font-medium">{completedCount}/58</span>
        </div>
        <Progress value={(completedCount / 58) * 100} className="h-2" />
      </div>

      {/* 次のマイルストーン */}
      {nextMilestone && (
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <TargetIcon className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">次のマイルストーン</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">{nextMilestone.skillCount}スキル</span>
            <Badge variant="secondary">
              +¥{nextMilestone.bonus.toLocaleString()}
            </Badge>
          </div>
          <Progress value={progressToNext} className="h-1.5" />
          <p className="text-xs text-muted-foreground mt-1">
            あと{nextMilestone.skillCount - completedCount}スキル
          </p>
        </div>
      )}

      {/* 獲得した称号 */}
      {titles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <TrophyIcon className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium">称号</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {titles.map((title, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {title}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 獲得したアイテム */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <GiftIcon className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium">アイテム</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {items.map((item, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {item}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* アンロック */}
      {unlocks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <UnlockIcon className="w-4 h-4 text-green-500" />
            <span className="text-sm font-medium">解禁</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {unlocks.map((unlock, i) => (
              <Badge key={i} variant="default" className="text-xs">
                {unlock}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### 3.4 atoms.ts の更新

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\atoms.ts`

報酬通知用のatomを追加:

```typescript
// 報酬通知キュー
export const rewardNotificationAtom = atom<{
  reward: RewardResult | null;
  milestone: Milestone | null;
} | null>(null);

// スキル完了アクション（報酬通知付き）
export const completeSkillWithRewardAtom = atom(
  null,
  (get, set, skillId: SkillId) => {
    const progress = get(playerProgressAtom);
    const previousCount = progress.completedSkills.length;

    // スキルを完了
    set(completeSkillAtom, skillId);

    // 報酬を計算
    const reward = calculateSkillReward(skillId);
    const newCount = previousCount + 1;
    const milestone = checkMilestone(newCount, previousCount);

    // 通知を設定
    if (reward.cashEarned > 0 || milestone) {
      set(rewardNotificationAtom, { reward, milestone });
    }
  }
);
```

---

## 4. タスク一覧

| # | タスク | ファイル | 詳細 | ステータス |
|---|-------|---------|------|-----------|
| 7.1 | 報酬計算ロジック | `reward-system.ts` | スキル・マイルストーン報酬 | ✅ 完了 |
| 7.2 | 報酬通知UI | `reward-notification.tsx` | アニメーション付き通知 | ✅ 完了 |
| 7.3 | 報酬サマリー | `reward-summary.tsx` | 累計報酬表示 | ✅ 完了 |
| 7.4 | atoms更新 | `atoms.ts` | 報酬通知atom | ✅ 完了 |
| 7.5 | パネル統合 | `skill-tree-panel.tsx` | 報酬UIの統合 | ✅ 完了 |
| 7.6 | index.ts エクスポート | `index.ts` | 新規関数/型のエクスポート | ✅ 完了 |

---

## 5. テスト戦略

```typescript
describe("reward-system", () => {
  it("should calculate skill reward correctly", () => {
    const result = calculateSkillReward("SANDBOX_001");
    expect(result.cashEarned).toBe(30000);
    expect(result.titlesEarned).toContain("称号「初陣」");
  });

  it("should detect milestone at 10 skills", () => {
    const milestone = checkMilestone(10, 9);
    expect(milestone).not.toBeNull();
    expect(milestone?.bonus).toBe(50000);
  });

  it("should calculate total rewards", () => {
    const completed = ["SANDBOX_001", "SANDBOX_002", "SANDBOX_003"];
    const { totalCash } = calculateTotalRewards(completed);
    expect(totalCash).toBe(30000 + 20000 + 10000);
  });
});
```

---

## 6. 完了条件

- [x] スキル報酬が正しく計算される ✅
- [x] マイルストーン到達が検出される ✅
- [x] 報酬通知がアニメーション表示 ✅
- [x] 報酬サマリーに累計が表示 ✅
- [x] 称号・アイテムが記録される ✅

---

## 7. 次のフェーズへの引き継ぎ

Phase 7完了後:

- `calculateSkillReward()`: スキル報酬計算
- `checkMilestone()`: マイルストーン検出
- `RewardNotification`: 報酬通知コンポーネント
- `RewardSummary`: 報酬サマリーコンポーネント

---

## 8. 実装メモ（2026-02-04追記）

### 新たな知見

1. **framer-motionは不使用**: プロジェクトではframer-motionを使用していないため、TailwindCSSのtransitionクラスでアニメーションを実装
   - `transform transition-all duration-300 ease-out`
   - `opacity-0 translate-y-4 scale-95` → `opacity-100 translate-y-0 scale-100`

2. **型名の重複に注意**: `RewardNotification`という名前がatoms（型）とコンポーネントで重複
   - 解決策: atomsの型を`RewardNotificationData`にリネーム

3. **既存テストファイルのエラー**: 型チェック時に既存のテストファイル（atoms.test.ts, skill-detail-panel.test.tsx等）でエラーが発生するが、これはPhase 7以前から存在していた問題

### 設計変更

1. **パネル統合**: 当初計画ではRewardSummaryをサイドバーまたはタブで表示する予定だったが、フッター部分を展開可能なセクションとして実装
   - ユーザーはフッターをクリックして報酬詳細を展開/折りたたみ

2. **追加関数**: 計画書になかった以下の関数を追加
   - `getNextMilestone()`: 次のマイルストーンを取得
   - `getMilestoneProgress()`: マイルストーン進捗率を計算

### Tips

1. **useAtom vs useAtomValue**: 読み取りのみの場合は`useAtomValue`を使用して不要なセッター関数を避ける

2. **Reactのインポート**: プロジェクトはjsx: "react-jsx"設定のため、`import React from "react"`は不要。ただし`ReactNode`などの型を使用する場合は`import type { ReactNode } from "react"`で個別インポート

### 作成ファイル一覧

```
frontend/src/components/skill-tree/rewards/
├── reward-system.ts       # 報酬計算ロジック
├── reward-notification.tsx # 報酬通知UI
└── reward-summary.tsx     # 報酬サマリー
```

### 更新ファイル一覧

- `atoms.ts`: RewardNotificationData型、rewardNotificationAtom、completeSkillWithRewardAtom追加
- `index.ts`: 新規エクスポート追加
- `skill-tree-panel.tsx`: RewardNotification、RewardSummary統合
