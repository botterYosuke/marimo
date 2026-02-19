/* Copyright 2026 Marimo. All rights reserved. */

/**
 * ゲーム E2E テスト用定数
 *
 * production コード（skill-data, reward-system）からデータを導出し、
 * テスト内のマジックナンバーを排除する。
 *
 * Playwright テストは Node.js で実行される。
 * skill-data.ts と reward-system.ts はブラウザ API 非依存の純粋データ/ロジックのため
 * Node.js から直接 import 可能。
 */

import {
  skillDefinitions,
  milestones,
} from "../../src/components/skill-tree/skill-data";
import { calculateTotalRewards } from "../../src/components/skill-tree/rewards/reward-system";

/** 全スキル数 */
export const TOTAL_SKILL_COUNT = skillDefinitions.length;

/** サンドボックストラックのスキル ID 一覧 */
export const SANDBOX_SKILL_IDS = skillDefinitions
  .filter((s) => s.category === "sandbox")
  .map((s) => s.id);

/** ブリッジトラックのスキル ID 一覧 */
export const BRIDGE_SKILL_IDS = skillDefinitions
  .filter((s) => s.category === "bridge")
  .map((s) => s.id);

/**
 * 指定スキル群を完了した場合の合計現金（スキル報酬 + マイルストーン報酬）を返す。
 */
export function getTotalCashAfterSkills(skillIds: string[]): number {
  const { totalCash, milestoneCash } = calculateTotalRewards(skillIds);
  return totalCash + milestoneCash;
}

/** 最初のマイルストーン */
export const FIRST_MILESTONE = milestones[0];
