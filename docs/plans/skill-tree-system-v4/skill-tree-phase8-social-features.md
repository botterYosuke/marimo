# Phase 8: ソーシャル機能

**想定日数**: 5-6日
**優先度**: P2
**依存**: Phase 7（報酬システム完了）

---

## 1. ゴール

- ランクシステム（ブロンズ〜マスター）
- バッジシステム
- リーダーボード（ローカル/モック）
- プロフィール表示

---

## 2. ランクシステム

### 2.1 ランク要件

| ランク | 条件 | バッジ |
|--------|------|--------|
| ブロンズ | 10スキル + 利益あり | 🥉 |
| シルバー | 20スキル + リターン+20% | 🥈 |
| ゴールド | 35スキル + シャープレシオ > 1.0 | 🥇 |
| プラチナ | 50スキル + DD < 15% | 💎 |
| マスター | 58スキル + シャープレシオ > 2.0 + DD < 10% | 👑 |

### 2.2 バッジ一覧

| バッジ | 条件 | レア度 |
|--------|------|--------|
| スピードランナー | サンドボックスを5分以内に完了 | ★★ |
| トレードマシン | 累計1,000取引 | ★★ |
| パーフェクトウィーク | 7日連続勝利 | ★★★ |
| フェニックス | 破産から復活して利益 | ★★★★ |
| ワンショットワンダー | 1取引で+50% | ★★★★ |
| コンプリーティスト | 全58スキル達成 | ★★★★★ |
| **隠しバッジ** | ??? | ★★★★★ |

---

## 3. 修正/作成ファイル

### 3.1 ランク計算

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\social\rank-system.ts`

```typescript
/* Copyright 2026 Marimo. All rights reserved. */

import type { PlayerProgress, PlayerRank, PlayerStats } from "../types";

export interface RankRequirement {
  skills: number;
  return?: number;
  sharpe?: number;
  maxDD?: number;
}

export const rankRequirements: Record<PlayerRank, RankRequirement> = {
  bronze: { skills: 10, return: 0 },
  silver: { skills: 20, return: 0.20 },
  gold: { skills: 35, sharpe: 1.0 },
  platinum: { skills: 50, maxDD: 0.15 },
  master: { skills: 58, sharpe: 2.0, maxDD: 0.10 },
};

export const rankOrder: PlayerRank[] = [
  "bronze",
  "silver",
  "gold",
  "platinum",
  "master",
];

export const rankEmoji: Record<PlayerRank, string> = {
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎",
  master: "👑",
};

export const rankLabel: Record<PlayerRank, string> = {
  bronze: "ブロンズ",
  silver: "シルバー",
  gold: "ゴールド",
  platinum: "プラチナ",
  master: "マスター",
};

/**
 * 現在のランクを計算
 */
export function calculateRank(progress: PlayerProgress): PlayerRank {
  const { completedSkills, stats } = progress;
  const skillCount = completedSkills.length;

  // 逆順でチェック（最高ランクから）
  for (let i = rankOrder.length - 1; i >= 0; i--) {
    const rank = rankOrder[i];
    const req = rankRequirements[rank];

    if (meetsRequirements(skillCount, stats, req)) {
      return rank;
    }
  }

  return "bronze";
}

function meetsRequirements(
  skillCount: number,
  stats: PlayerStats,
  req: RankRequirement
): boolean {
  // スキル数
  if (skillCount < req.skills) return false;

  // リターン
  if (req.return !== undefined && stats.totalReturn < req.return) {
    return false;
  }

  // シャープレシオ
  if (req.sharpe !== undefined && stats.sharpeRatio < req.sharpe) {
    return false;
  }

  // 最大ドローダウン
  if (req.maxDD !== undefined && Math.abs(stats.maxDrawdown) > req.maxDD) {
    return false;
  }

  return true;
}

/**
 * 次のランクへの進捗を計算
 */
export function getProgressToNextRank(
  progress: PlayerProgress
): {
  currentRank: PlayerRank;
  nextRank: PlayerRank | null;
  progressPercent: number;
  requirements: string[];
} {
  const currentRank = calculateRank(progress);
  const currentIndex = rankOrder.indexOf(currentRank);

  if (currentIndex === rankOrder.length - 1) {
    return {
      currentRank,
      nextRank: null,
      progressPercent: 100,
      requirements: [],
    };
  }

  const nextRank = rankOrder[currentIndex + 1];
  const req = rankRequirements[nextRank];
  const requirements: string[] = [];
  let metCount = 0;
  let totalCount = 0;

  // スキル数
  totalCount++;
  if (progress.completedSkills.length >= req.skills) {
    metCount++;
  } else {
    requirements.push(
      `${req.skills}スキル達成 (現在: ${progress.completedSkills.length})`
    );
  }

  // リターン
  if (req.return !== undefined) {
    totalCount++;
    if (progress.stats.totalReturn >= req.return) {
      metCount++;
    } else {
      requirements.push(
        `リターン ${(req.return * 100).toFixed(0)}%+ (現在: ${(
          progress.stats.totalReturn * 100
        ).toFixed(1)}%)`
      );
    }
  }

  // シャープレシオ
  if (req.sharpe !== undefined) {
    totalCount++;
    if (progress.stats.sharpeRatio >= req.sharpe) {
      metCount++;
    } else {
      requirements.push(
        `シャープレシオ ${req.sharpe}+ (現在: ${progress.stats.sharpeRatio.toFixed(
          2
        )})`
      );
    }
  }

  // ドローダウン
  if (req.maxDD !== undefined) {
    totalCount++;
    if (Math.abs(progress.stats.maxDrawdown) <= req.maxDD) {
      metCount++;
    } else {
      requirements.push(
        `最大DD ${(req.maxDD * 100).toFixed(0)}%以内 (現在: ${(
          Math.abs(progress.stats.maxDrawdown) * 100
        ).toFixed(1)}%)`
      );
    }
  }

  return {
    currentRank,
    nextRank,
    progressPercent: (metCount / totalCount) * 100,
    requirements,
  };
}
```

---

### 3.2 バッジシステム

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\social\badge-system.ts`

```typescript
/* Copyright 2026 Marimo. All rights reserved. */

import type { PlayerProgress } from "../types";

export interface Badge {
  id: string;
  name: string;
  description: string;
  rarity: 1 | 2 | 3 | 4 | 5;
  icon: string;
  hidden?: boolean;
}

export const badges: Badge[] = [
  {
    id: "speed_runner",
    name: "スピードランナー",
    description: "サンドボックスを5分以内に完了",
    rarity: 2,
    icon: "⚡",
  },
  {
    id: "trade_machine",
    name: "トレードマシン",
    description: "累計1,000取引",
    rarity: 2,
    icon: "🤖",
  },
  {
    id: "perfect_week",
    name: "パーフェクトウィーク",
    description: "7日連続勝利",
    rarity: 3,
    icon: "🔥",
  },
  {
    id: "phoenix",
    name: "フェニックス",
    description: "破産から復活して利益",
    rarity: 4,
    icon: "🐦‍🔥",
  },
  {
    id: "one_shot_wonder",
    name: "ワンショットワンダー",
    description: "1取引で+50%",
    rarity: 4,
    icon: "🎯",
  },
  {
    id: "completionist",
    name: "コンプリーティスト",
    description: "全58スキル達成",
    rarity: 5,
    icon: "🏆",
  },
  {
    id: "hidden_master",
    name: "???",
    description: "隠しバッジ",
    rarity: 5,
    icon: "❓",
    hidden: true,
  },
];

export interface BadgeCheckContext {
  progress: PlayerProgress;
  sandboxStartTime?: number;
  sandboxEndTime?: number;
  totalTrades: number;
  consecutiveWins: number;
  hasBankrupted: boolean;
  hasRecovered: boolean;
  maxSingleTradeReturn: number;
}

type BadgeChecker = (ctx: BadgeCheckContext) => boolean;

const badgeCheckers: Record<string, BadgeChecker> = {
  speed_runner: (ctx) => {
    if (!ctx.sandboxStartTime || !ctx.sandboxEndTime) return false;
    const duration = ctx.sandboxEndTime - ctx.sandboxStartTime;
    return duration <= 5 * 60 * 1000; // 5分
  },

  trade_machine: (ctx) => ctx.totalTrades >= 1000,

  perfect_week: (ctx) => ctx.consecutiveWins >= 7,

  phoenix: (ctx) => ctx.hasBankrupted && ctx.hasRecovered,

  one_shot_wonder: (ctx) => ctx.maxSingleTradeReturn >= 0.5,

  completionist: (ctx) => ctx.progress.completedSkills.length >= 58,

  hidden_master: (ctx) => {
    // 隠し条件: 全スキル達成 + シャープレシオ3以上 + DD5%以内
    return (
      ctx.progress.completedSkills.length >= 58 &&
      ctx.progress.stats.sharpeRatio >= 3.0 &&
      Math.abs(ctx.progress.stats.maxDrawdown) <= 0.05
    );
  },
};

/**
 * 獲得可能なバッジをチェック
 */
export function checkBadges(ctx: BadgeCheckContext): Badge[] {
  const earned: Badge[] = [];

  for (const badge of badges) {
    const checker = badgeCheckers[badge.id];
    if (checker && checker(ctx)) {
      // 隠しバッジの場合は非表示状態を解除
      if (badge.hidden) {
        earned.push({
          ...badge,
          name: "隠しマスター",
          description: "究極の投資家",
          hidden: false,
        });
      } else {
        earned.push(badge);
      }
    }
  }

  return earned;
}

/**
 * レア度の星を生成
 */
export function getRarityStars(rarity: number): string {
  return "★".repeat(rarity) + "☆".repeat(5 - rarity);
}
```

---

### 3.3 リーダーボード（モック）

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\social\leaderboard.tsx`

```typescript
/* Copyright 2026 Marimo. All rights reserved. */

import React from "react";
import { useAtomValue } from "jotai";
import { TrophyIcon, TrendingUpIcon, TargetIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { playerProgressAtom } from "../atoms";
import { rankEmoji } from "./rank-system";

interface LeaderboardEntry {
  rank: number;
  name: string;
  value: string;
  playerRank: string;
  isCurrentUser?: boolean;
}

// モックデータ（実際のバックエンドがない場合のプレースホルダー）
const mockLeaderboards = {
  total: [
    { rank: 1, name: "TraderMike", value: "+245.3%", playerRank: "master" },
    { rank: 2, name: "InvestorJane", value: "+198.7%", playerRank: "platinum" },
    { rank: 3, name: "AlphaTrader", value: "+156.2%", playerRank: "gold" },
    { rank: 4, name: "あなた", value: "+0.0%", playerRank: "bronze", isCurrentUser: true },
    { rank: 5, name: "Beginner123", value: "-12.4%", playerRank: "bronze" },
  ],
  sharpe: [
    { rank: 1, name: "RiskMaster", value: "2.85", playerRank: "master" },
    { rank: 2, name: "ConsistentWin", value: "2.41", playerRank: "platinum" },
    { rank: 3, name: "SteadyHand", value: "1.92", playerRank: "gold" },
  ],
  skills: [
    { rank: 1, name: "Completionist", value: "58/58", playerRank: "master" },
    { rank: 2, name: "AlmostThere", value: "52/58", playerRank: "platinum" },
    { rank: 3, name: "HalfwayDone", value: "30/58", playerRank: "gold" },
  ],
};

function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div
          key={entry.rank}
          className={`flex items-center gap-3 p-2 rounded-lg ${
            entry.isCurrentUser
              ? "bg-primary/10 border border-primary/30"
              : "bg-muted/50"
          }`}
        >
          {/* Rank */}
          <div className="w-8 text-center">
            {entry.rank <= 3 ? (
              <span className="text-lg">
                {entry.rank === 1 && "🥇"}
                {entry.rank === 2 && "🥈"}
                {entry.rank === 3 && "🥉"}
              </span>
            ) : (
              <span className="text-muted-foreground font-medium">
                #{entry.rank}
              </span>
            )}
          </div>

          {/* Player Rank Badge */}
          <span className="text-lg">
            {rankEmoji[entry.playerRank as keyof typeof rankEmoji]}
          </span>

          {/* Name */}
          <span
            className={`flex-1 font-medium ${
              entry.isCurrentUser ? "text-primary" : ""
            }`}
          >
            {entry.name}
          </span>

          {/* Value */}
          <Badge variant="secondary">{entry.value}</Badge>
        </div>
      ))}
    </div>
  );
}

export function Leaderboard() {
  const progress = useAtomValue(playerProgressAtom);

  // 現在のユーザーの値を更新
  const updateCurrentUser = (
    entries: LeaderboardEntry[],
    value: string
  ): LeaderboardEntry[] => {
    return entries.map((e) =>
      e.isCurrentUser ? { ...e, value, playerRank: progress.rank } : e
    );
  };

  const totalLeaderboard = updateCurrentUser(
    mockLeaderboards.total,
    `+${(progress.stats.totalReturn * 100).toFixed(1)}%`
  );

  return (
    <div className="p-4">
      <Tabs defaultValue="total">
        <TabsList className="w-full">
          <TabsTrigger value="total" className="flex-1">
            <TrendingUpIcon className="w-4 h-4 mr-1" />
            総合
          </TabsTrigger>
          <TabsTrigger value="sharpe" className="flex-1">
            <TargetIcon className="w-4 h-4 mr-1" />
            シャープ
          </TabsTrigger>
          <TabsTrigger value="skills" className="flex-1">
            <TrophyIcon className="w-4 h-4 mr-1" />
            スキル
          </TabsTrigger>
        </TabsList>

        <TabsContent value="total" className="mt-4">
          <LeaderboardTable entries={totalLeaderboard} />
        </TabsContent>

        <TabsContent value="sharpe" className="mt-4">
          <LeaderboardTable entries={mockLeaderboards.sharpe} />
        </TabsContent>

        <TabsContent value="skills" className="mt-4">
          <LeaderboardTable entries={mockLeaderboards.skills} />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground text-center mt-4">
        ※ リーダーボードはローカルモックです
      </p>
    </div>
  );
}
```

---

### 3.4 プロフィールバッジ

**ファイル**: `D:\Documents\marimo\frontend\src\components\skill-tree\social\profile-badge.tsx`

```typescript
/* Copyright 2026 Marimo. All rights reserved. */

import React from "react";
import { useAtomValue } from "jotai";
import { playerProgressAtom } from "../atoms";
import { calculateRank, rankEmoji, rankLabel } from "./rank-system";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ProfileBadge() {
  const progress = useAtomValue(playerProgressAtom);
  const rank = calculateRank(progress);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full cursor-pointer hover:bg-muted/80 transition-colors">
          <span className="text-lg">{rankEmoji[rank]}</span>
          <span className="text-sm font-medium">{rankLabel[rank]}</span>
          <Badge variant="secondary" className="text-xs">
            {progress.completedSkills.length}/58
          </Badge>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm">
          <p className="font-medium">
            {rankLabel[rank]}ランク
          </p>
          <p className="text-muted-foreground">
            スキル: {progress.completedSkills.length}/58
          </p>
          <p className="text-muted-foreground">
            総資産: ¥{progress.currentCash.toLocaleString()}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
```

---

## 4. タスク一覧

| # | タスク | ファイル | 詳細 |
|---|-------|---------|------|
| 8.1 | ランク計算 | `rank-system.ts` | 5ランクの計算ロジック |
| 8.2 | バッジシステム | `badge-system.ts` | 7バッジの条件判定 |
| 8.3 | リーダーボード | `leaderboard.tsx` | モックリーダーボード |
| 8.4 | プロフィールバッジ | `profile-badge.tsx` | ヘッダー表示用 |
| 8.5 | atoms更新 | `atoms.ts` | rank自動計算 |
| 8.6 | パネル統合 | - | ソーシャルタブ追加 |

---

## 5. テスト戦略

```typescript
describe("rank-system", () => {
  it("should calculate bronze rank for new user", () => {
    const progress: PlayerProgress = {
      completedSkills: [],
      stats: { totalReturn: 0, sharpeRatio: 0, maxDrawdown: 0, ... },
      ...
    };
    expect(calculateRank(progress)).toBe("bronze");
  });

  it("should calculate master rank for complete user", () => {
    const progress: PlayerProgress = {
      completedSkills: Array(58).fill(""),
      stats: { sharpeRatio: 2.5, maxDrawdown: -0.08, ... },
      ...
    };
    expect(calculateRank(progress)).toBe("master");
  });
});

describe("badge-system", () => {
  it("should award completionist badge at 58 skills", () => {
    const ctx: BadgeCheckContext = {
      progress: { completedSkills: Array(58).fill(""), ... },
      ...
    };
    const earned = checkBadges(ctx);
    expect(earned.some(b => b.id === "completionist")).toBe(true);
  });
});
```

---

## 6. 完了条件

- [ ] ランクが自動計算される
- [ ] バッジ条件が正しく判定される
- [ ] リーダーボードが表示される
- [ ] プロフィールバッジがヘッダーに表示
- [ ] 隠しバッジが条件達成で解除される

---

## 7. 次のフェーズへの引き継ぎ

Phase 8完了後:

- `calculateRank()`: ランク計算
- `checkBadges()`: バッジ判定
- `Leaderboard`: リーダーボードコンポーネント
- `ProfileBadge`: プロフィールバッジ
- 全ソーシャル機能がUI統合済み
