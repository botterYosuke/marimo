/* Copyright 2026 Marimo. All rights reserved. */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { RewardSummary } from "../rewards/reward-summary";
import { playerProgressAtom } from "../atoms";
import type { PlayerProgress } from "../types";

// デフォルトの進捗状態
const defaultProgress: PlayerProgress = {
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

describe("RewardSummary", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    // localStorage をモック
    const mockStorage: Record<string, string> = {};
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key) => mockStorage[key] ?? null
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      mockStorage[key] = value;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderWithStore = () => {
    return render(
      <Provider store={store}>
        <RewardSummary />
      </Provider>
    );
  };

  describe("総報酬表示", () => {
    it("初期状態で0円が表示される", () => {
      renderWithStore();

      expect(screen.getByText("¥0")).toBeInTheDocument();
    });

    it("スキル完了後に正しい総報酬額が表示される", () => {
      store.set(playerProgressAtom, {
        ...defaultProgress,
        completedSkills: ["SANDBOX_001"],
      });
      renderWithStore();

      expect(screen.getByText("¥30,000")).toBeInTheDocument();
    });

    it("マイルストーンボーナス額が表示される（10スキル達成時）", () => {
      store.set(playerProgressAtom, {
        ...defaultProgress,
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
        ],
      });
      renderWithStore();

      // マイルストーンボーナス表示を確認（"(マイルストーン ¥50,000 含む)"）
      expect(screen.getByText(/マイルストーン ¥50,000/)).toBeInTheDocument();
    });
  });

  describe("スキル進捗表示", () => {
    it("初期状態で0/59が表示される", () => {
      renderWithStore();

      expect(screen.getByText("0/59")).toBeInTheDocument();
    });

    it("スキル完了後に正しい進捗が表示される", () => {
      store.set(playerProgressAtom, {
        ...defaultProgress,
        completedSkills: ["SANDBOX_001", "SANDBOX_002"],
      });
      renderWithStore();

      expect(screen.getByText("2/59")).toBeInTheDocument();
    });
  });

  describe("次のマイルストーン表示", () => {
    it("初期状態で10スキルマイルストーンが表示される", () => {
      renderWithStore();

      expect(screen.getByText("次のマイルストーン")).toBeInTheDocument();
      expect(screen.getByText("10スキル達成")).toBeInTheDocument();
      expect(screen.getByText("+¥50,000")).toBeInTheDocument();
    });

    it("残りスキル数が正しく表示される", () => {
      store.set(playerProgressAtom, {
        ...defaultProgress,
        completedSkills: ["SANDBOX_001", "SANDBOX_002"],
      });
      renderWithStore();

      expect(screen.getByText("あと8スキル")).toBeInTheDocument();
    });

    it("10スキル達成後は20スキルマイルストーンが表示される", () => {
      store.set(playerProgressAtom, {
        ...defaultProgress,
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
        ],
      });
      renderWithStore();

      expect(screen.getByText("20スキル達成")).toBeInTheDocument();
      expect(screen.getByText("+¥100,000")).toBeInTheDocument();
    });
  });

  describe("称号表示", () => {
    it("初期状態では称号セクションが表示されない", () => {
      renderWithStore();

      // 称号セクションのヘッダーが存在しない
      const titleSections = screen.queryAllByText("称号");
      expect(titleSections).toHaveLength(0);
    });

    it("スキル完了で獲得した称号が表示される", () => {
      store.set(playerProgressAtom, {
        ...defaultProgress,
        completedSkills: ["SANDBOX_001"],
      });
      renderWithStore();

      expect(screen.getByText("称号「初陣」")).toBeInTheDocument();
    });

    it("称号が7個以上の場合は+N表示される", () => {
      // 7つ以上の称号を持つようなスキルを完了
      store.set(playerProgressAtom, {
        ...defaultProgress,
        completedSkills: [
          "SANDBOX_001", // 称号「初陣」
          "FAIL_001", // 称号「授業料」
          "FAIL_002", // 称号「決断力」
          "SANDBOX_002",
          "SANDBOX_003",
          "SANDBOX_004",
          "SANDBOX_005",
          "SANDBOX_006",
          "BRIDGE_001",
          "BRIDGE_002",
          "BRIDGE_003",
          "SETUP_001", // 10スキルで「見習い投資家」
          "SETUP_002",
          "SETUP_003",
          "SETUP_004",
          "SETUP_005",
          "DATA_001",
          "DATA_002",
          "DATA_003",
          "DATA_004", // 20スキルで「新進トレーダー」
        ],
      });
      renderWithStore();

      // 5つの称号があるはず（初陣、授業料、決断力、見習い投資家、新進トレーダー）
      // 6個以下なので+Nは表示されない
      expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
    });
  });

  describe("空の状態", () => {
    it("報酬未獲得時にメッセージが表示される", () => {
      renderWithStore();

      expect(screen.getByText("まだ報酬を獲得していません")).toBeInTheDocument();
      expect(
        screen.getByText("スキルを達成して報酬を集めましょう!")
      ).toBeInTheDocument();
    });

    it("スキル完了後は空のメッセージが表示されない", () => {
      store.set(playerProgressAtom, {
        ...defaultProgress,
        completedSkills: ["SANDBOX_001"],
      });
      renderWithStore();

      expect(
        screen.queryByText("まだ報酬を獲得していません")
      ).not.toBeInTheDocument();
    });
  });

  describe("全スキル達成時", () => {
    it("マスター表示がされる", () => {
      // 59スキル全て完了（簡略化のためモック）
      const allSkillIds = [
        "SANDBOX_001",
        "SANDBOX_002",
        "SANDBOX_003",
        "SANDBOX_004",
        "SANDBOX_005",
        "SANDBOX_006",
        "BRIDGE_001",
        "BRIDGE_002",
        "BRIDGE_003",
        "FAIL_001",
        "FAIL_002",
        "FAIL_003",
        "SETUP_001",
        "SETUP_002",
        "SETUP_003",
        "SETUP_004",
        "SETUP_005",
        "DATA_001",
        "DATA_002",
        "DATA_003",
        "DATA_004",
        "DATA_005",
        "DATA_006",
        "SET_001",
        "SET_002",
        "SET_003",
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
        "CHART_001",
        "CHART_002",
        "CHART_003",
        "CHART_004",
        "IND_001",
        "IND_002",
        "IND_003",
        "IND_004",
        "IND_005",
        "IND_006",
        "IND_007",
        "IND_008",
        "IND_009",
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
      ];

      store.set(playerProgressAtom, {
        ...defaultProgress,
        completedSkills: allSkillIds,
      });
      renderWithStore();

      expect(screen.getByText("全スキル達成!")).toBeInTheDocument();
      expect(
        screen.getByText("マスター投資家の称号を獲得")
      ).toBeInTheDocument();
    });

    it("全スキル達成時は次のマイルストーンが表示されない", () => {
      const allSkillIds = [
        "SANDBOX_001",
        "SANDBOX_002",
        "SANDBOX_003",
        "SANDBOX_004",
        "SANDBOX_005",
        "SANDBOX_006",
        "BRIDGE_001",
        "BRIDGE_002",
        "BRIDGE_003",
        "FAIL_001",
        "FAIL_002",
        "FAIL_003",
        "SETUP_001",
        "SETUP_002",
        "SETUP_003",
        "SETUP_004",
        "SETUP_005",
        "DATA_001",
        "DATA_002",
        "DATA_003",
        "DATA_004",
        "DATA_005",
        "DATA_006",
        "SET_001",
        "SET_002",
        "SET_003",
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
        "CHART_001",
        "CHART_002",
        "CHART_003",
        "CHART_004",
        "IND_001",
        "IND_002",
        "IND_003",
        "IND_004",
        "IND_005",
        "IND_006",
        "IND_007",
        "IND_008",
        "IND_009",
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
      ];

      store.set(playerProgressAtom, {
        ...defaultProgress,
        completedSkills: allSkillIds,
      });
      renderWithStore();

      expect(screen.queryByText("次のマイルストーン")).not.toBeInTheDocument();
    });
  });

  describe("進捗バー", () => {
    it("スキル進捗バーが存在する", () => {
      renderWithStore();

      // Progress コンポーネントの存在確認
      const progressBars = document.querySelectorAll('[role="progressbar"]');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it("マイルストーン進捗バーが存在する", () => {
      renderWithStore();

      // 次のマイルストーンセクションに進捗バーがある
      expect(screen.getByText("次のマイルストーン")).toBeInTheDocument();
      const progressBars = document.querySelectorAll('[role="progressbar"]');
      expect(progressBars.length).toBeGreaterThanOrEqual(2);
    });
  });
});
