/* Copyright 2026 Marimo. All rights reserved. */

export type SkillId = string;

export type SkillStatus = "locked" | "unlocked" | "completed";

// スキルカテゴリ（10種類）
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

// スキルトラック（3種類）
export type SkillTrack = "sandbox" | "bridge" | "full";

// 報酬タイプ（4種類）
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
  category: SkillCategory;
  track: SkillTrack;
  reward: SkillReward[]; // 単一→配列に変更
  prerequisites: SkillId[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  helpContent?: string; // オプショナル: Markdownセルに挿入するヘルプコンテンツ
}

// プレイヤー統計
export interface PlayerStats {
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  winRate: number;
}

// プレイヤーランク
export type PlayerRank = "bronze" | "silver" | "gold" | "platinum" | "master";

// プレイヤー進捗
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

// ゲーム進捗（ノートブック埋め込み用）
// Pythonの _GAME_PROGRESS と対応
export interface GameProgress {
  version: number;
  completed_skills: SkillId[];
  current_mode: "sandbox" | "bridge" | "full";
  cash: number;
  titles: string[];
}

// マイルストーン
export interface Milestone {
  skillCount: number;
  bonus: number;
  title?: string;
  item?: string;
  unlock?: string;
}

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
