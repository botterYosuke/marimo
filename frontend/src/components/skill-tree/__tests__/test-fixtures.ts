/* Copyright 2026 Marimo. All rights reserved. */

import type { PlayerProgress, GameProgress, SkillId } from "../types";

/**
 * ゲームスタート時点の初期データ（ゲーム起動直後）
 */
export const mockProgressGameStart: PlayerProgress = {
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

/**
 * SANDBOX_001 完了後
 * - 報酬: +30,000円, 称号「初陣」
 */
export const mockProgressAfterFirstSkill: PlayerProgress = {
  completedSkills: ["SANDBOX_001"],
  currentCash: 30000,
  earnedTitles: ["称号「初陣」"],
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

/**
 * サンドボックス卒業後（ブリッジモード突入）
 * - SANDBOX_001〜006 完了
 * - 合計報酬: 150,000円
 */
export const mockProgressBridgeMode: PlayerProgress = {
  completedSkills: [
    "SANDBOX_001",
    "SANDBOX_002",
    "SANDBOX_003",
    "SANDBOX_004",
    "SANDBOX_005",
    "SANDBOX_006",
  ] as SkillId[],
  currentCash: 150000, // 30000+20000+10000+20000+20000+50000
  earnedTitles: ["称号「初陣」"],
  earnedBadges: [],
  rank: "bronze",
  stats: {
    totalReturn: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    totalTrades: 0,
    winRate: 0,
  },
  sandboxCompleted: true,
  bridgeCompleted: false,
  hiddenBadgesFound: [],
};

/**
 * フルモード到達後
 * - SANDBOX_001〜006 + BRIDGE_001〜003 完了
 * - 合計報酬: 210,000円
 */
export const mockProgressFullMode: PlayerProgress = {
  completedSkills: [
    "SANDBOX_001",
    "SANDBOX_002",
    "SANDBOX_003",
    "SANDBOX_004",
    "SANDBOX_005",
    "SANDBOX_006",
    "BRIDGE_001",
    "BRIDGE_002",
    "BRIDGE_003",
  ] as SkillId[],
  currentCash: 210000, // 150000+15000+20000+25000
  earnedTitles: ["称号「初陣」"],
  earnedBadges: [],
  rank: "bronze",
  stats: {
    totalReturn: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    totalTrades: 0,
    winRate: 0,
  },
  sandboxCompleted: true,
  bridgeCompleted: true,
  hiddenBadgesFound: [],
};

/**
 * ゲームスタート時点の GameProgress（Python側用）
 */
export const mockGameProgressStart: GameProgress = {
  version: 1,
  completed_skills: [],
  current_mode: "sandbox",
  cash: 0,
  titles: [],
};

/**
 * サンドボックス完了後の GameProgress
 */
export const mockGameProgressBridge: GameProgress = {
  version: 1,
  completed_skills: [
    "SANDBOX_001",
    "SANDBOX_002",
    "SANDBOX_003",
    "SANDBOX_004",
    "SANDBOX_005",
    "SANDBOX_006",
  ],
  current_mode: "bridge",
  cash: 150000,
  titles: ["称号「初陣」"],
};

/**
 * フルモード到達後の GameProgress
 */
export const mockGameProgressFull: GameProgress = {
  version: 1,
  completed_skills: [
    "SANDBOX_001",
    "SANDBOX_002",
    "SANDBOX_003",
    "SANDBOX_004",
    "SANDBOX_005",
    "SANDBOX_006",
    "BRIDGE_001",
    "BRIDGE_002",
    "BRIDGE_003",
  ],
  current_mode: "full",
  cash: 210000,
  titles: ["称号「初陣」"],
};

/**
 * 失敗スキル込みの進捗（FAIL_001, FAIL_002 達成）
 */
export const mockProgressWithFailSkills: PlayerProgress = {
  completedSkills: [
    "SANDBOX_001",
    "SANDBOX_002",
    "SANDBOX_003",
    "SANDBOX_004",
    "FAIL_001",
    "FAIL_002",
  ] as SkillId[],
  currentCash: 95000, // 30000+20000+10000+20000+5000+10000
  earnedTitles: ["称号「初陣」", "称号「授業料」", "称号「決断力」"],
  earnedBadges: [],
  rank: "bronze",
  stats: {
    totalReturn: -5,
    sharpeRatio: 0,
    maxDrawdown: 10,
    totalTrades: 2,
    winRate: 0,
  },
  sandboxCompleted: false,
  bridgeCompleted: false,
  hiddenBadgesFound: [],
};

/**
 * 10スキル達成（ブロンズマイルストーン）
 */
export const mockProgressBronzeMilestone: PlayerProgress = {
  completedSkills: [
    "SANDBOX_001",
    "SANDBOX_002",
    "SANDBOX_003",
    "SANDBOX_004",
    "SANDBOX_005",
    "SANDBOX_006",
    "BRIDGE_001",
    "BRIDGE_002",
    "BRIDGE_003",
    "SETUP_001",
  ] as SkillId[],
  currentCash: 220000, // 210000+10000
  earnedTitles: ["称号「初陣」"],
  earnedBadges: [],
  rank: "bronze",
  stats: {
    totalReturn: 0,
    sharpeRatio: 0,
    maxDrawdown: 0,
    totalTrades: 0,
    winRate: 0,
  },
  sandboxCompleted: true,
  bridgeCompleted: true,
  hiddenBadgesFound: [],
};

/**
 * スキルID一覧（検証用）
 */
export const allSkillIds = {
  sandbox: [
    "SANDBOX_001",
    "SANDBOX_002",
    "SANDBOX_003",
    "SANDBOX_004",
    "SANDBOX_005",
    "SANDBOX_006",
  ],
  bridge: ["BRIDGE_001", "BRIDGE_002", "BRIDGE_003"],
  fail: ["FAIL_001", "FAIL_002", "FAIL_003"],
  setup: ["SETUP_001", "SETUP_002", "SETUP_003", "SETUP_004", "SETUP_005"],
  data: ["DATA_001", "DATA_002", "DATA_003", "DATA_004", "DATA_005", "DATA_006"],
  set: ["SET_001", "SET_002", "SET_003"],
  trade: [
    "TRADE_001",
    "TRADE_002",
    "TRADE_003",
    "TRADE_004",
    "TRADE_005",
    "TRADE_006",
    "TRADE_007",
    "TRADE_008",
    "TRADE_009",
    "TRADE_010",
  ],
  chart: ["CHART_001", "CHART_002", "CHART_003", "CHART_004"],
  indicator: [
    "IND_001",
    "IND_002",
    "IND_003",
    "IND_004",
    "IND_005",
    "IND_006",
    "IND_007",
    "IND_008",
    "IND_009",
  ],
  risk: [
    "RISK_001",
    "RISK_002",
    "RISK_003",
    "RISK_004",
    "RISK_005",
    "RISK_006",
    "RISK_007",
    "RISK_008",
    "RISK_009",
    "RISK_010",
  ],
};

/**
 * 全スキルID配列
 */
export const allSkillIdsFlat = Object.values(allSkillIds).flat();

/**
 * テスト用のモックスキルを作成するヘルパー関数
 */
export function createMockSkill(
  overrides: Partial<{
    id: string;
    title: string;
    description: string;
    status: "locked" | "unlocked" | "completed";
    category: string;
    track: string;
    difficulty: number;
    prerequisites: string[];
    reward: Array<{
      type: string;
      description: string;
      value?: number;
    }>;
    helpContent?: string;
  }> = {}
) {
  return {
    id: "TEST_001",
    title: "テストスキル",
    description: "テスト用のスキル説明",
    status: "unlocked" as const,
    category: "sandbox" as const,
    track: "sandbox" as const,
    difficulty: 1,
    prerequisites: [],
    reward: [{ type: "cash", description: "+10,000円", value: 10000 }],
    helpContent: undefined,
    ...overrides,
  };
}
