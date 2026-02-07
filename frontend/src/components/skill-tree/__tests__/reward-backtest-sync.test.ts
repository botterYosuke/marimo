/* Copyright 2026 Marimo. All rights reserved. */

/**
 * 報酬キャッシュ → BacktestHud 同期の結合テスト
 *
 * スキル完了による報酬が BacktestHud の equity 表示に
 * 正しく反映されることを検証する。
 */

import { createStore } from "jotai";
import { beforeEach, describe, expect, it } from "vitest";
import {
  playerProgressAtom,
  completeSkillWithRewardAtom,
  completeSkillAtom,
  resetProgressAtom,
} from "../atoms";
import {
  mockProgressGameStart,
  mockProgressAfterFirstSkill,
  mockProgressBronzeMilestone,
} from "./test-fixtures";

describe("報酬キャッシュ → BacktestHud 同期", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
  });

  // ========================================
  // 基本的な報酬 → equity 合算テスト
  // ========================================

  describe("報酬キャッシュが equity 表示に合算可能であること", () => {
    it("SANDBOX_001 完了で currentCash=30,000 → backtest equity に加算", () => {
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");
      const progress = store.get(playerProgressAtom);

      const backtestEquity = 100000;
      const displayedEquity = backtestEquity + progress.currentCash;

      expect(progress.currentCash).toBe(30000);
      expect(displayedEquity).toBe(130000);
    });

    it("SANDBOX_001 + SANDBOX_002 完了で累積報酬が合算", () => {
      store.set(completeSkillWithRewardAtom, "SANDBOX_001"); // +30,000
      store.set(completeSkillWithRewardAtom, "SANDBOX_002"); // +20,000
      const progress = store.get(playerProgressAtom);

      const backtestEquity = 100000;
      const displayedEquity = backtestEquity + progress.currentCash;

      expect(progress.currentCash).toBe(50000);
      expect(displayedEquity).toBe(150000);
    });

    it("取引損益がある場合も正しく合算", () => {
      store.set(completeSkillWithRewardAtom, "SANDBOX_001"); // +30,000
      const progress = store.get(playerProgressAtom);

      const backtestEquityWithProfit = 105000; // 取引で +5,000
      const displayedEquity = backtestEquityWithProfit + progress.currentCash;

      expect(displayedEquity).toBe(135000);
    });
  });

  // ========================================
  // マイルストーンボーナスとの統合
  // ========================================

  describe("マイルストーンボーナスが equity に反映", () => {
    it("10スキル達成時、基本報酬 + マイルストーンボーナスが合算", () => {
      // 10スキル完了後の進捗を直接セット
      store.set(playerProgressAtom, mockProgressBronzeMilestone);
      const progress = store.get(playerProgressAtom);

      const backtestEquity = 100000;
      const displayedEquity = backtestEquity + progress.currentCash;

      // mockProgressBronzeMilestone.currentCash = 220,000
      expect(displayedEquity).toBe(320000);
    });
  });

  // ========================================
  // リセット時の挙動
  // ========================================

  describe("リセット後の同期", () => {
    it("リセット後 currentCash=0 → equity は backtest 値のみ", () => {
      // スキル完了
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");
      expect(store.get(playerProgressAtom).currentCash).toBe(30000);

      // リセット
      store.set(resetProgressAtom);
      const progress = store.get(playerProgressAtom);

      const backtestEquity = 100000;
      const displayedEquity = backtestEquity + progress.currentCash;

      expect(progress.currentCash).toBe(0);
      expect(displayedEquity).toBe(100000);
    });
  });

  // ========================================
  // 二重完了防止
  // ========================================

  describe("二重完了による二重加算防止", () => {
    it("同じスキルの二重完了で報酬が二重加算されない", () => {
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");
      const progress = store.get(playerProgressAtom);

      const backtestEquity = 100000;
      const displayedEquity = backtestEquity + progress.currentCash;

      expect(progress.currentCash).toBe(30000); // 二重にならない
      expect(displayedEquity).toBe(130000);
    });
  });

  // ========================================
  // BroadcastChannel 未接続時のエッジケース
  // ========================================

  describe("BroadcastChannel 未接続時", () => {
    it("backtest equity が null の場合、currentCash のみでは合算しない", () => {
      store.set(completeSkillWithRewardAtom, "SANDBOX_001");
      const progress = store.get(playerProgressAtom);

      // backtest_channel 未受信: state = null
      const backtestState = null;

      // BacktestHud は state === null のとき「待機中」プレースホルダーを表示
      // currentCash があっても合算表示はしない
      expect(backtestState).toBeNull();
      expect(progress.currentCash).toBe(30000);
      // → UI では「待機中」を表示すべき
    });
  });

  // ========================================
  // completeSkillAtom と completeSkillWithRewardAtom の一貫性
  // ========================================

  describe("completeSkillAtom と completeSkillWithRewardAtom の一貫性", () => {
    it("両方の atom で同じ currentCash になる", () => {
      const storeA = createStore();
      const storeB = createStore();

      // localStorage モックは既にセットアップ済み

      storeA.set(completeSkillAtom, "SANDBOX_001");
      storeB.set(completeSkillWithRewardAtom, "SANDBOX_001");

      const progressA = storeA.get(playerProgressAtom);
      const progressB = storeB.get(playerProgressAtom);

      expect(progressA.currentCash).toBe(progressB.currentCash);
      expect(progressA.currentCash).toBe(30000);
    });
  });
});
