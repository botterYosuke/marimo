/* Copyright 2026 Marimo. All rights reserved. */

import { render, screen, act, within } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { BacktestHud } from "../backtest-hud";
import { playerProgressAtom } from "@/components/skill-tree/atoms";
import type { BacktestState } from "@/hooks/useBroadcastChannel";
import {
  mockProgressGameStart,
  mockProgressAfterFirstSkill,
  mockProgressBridgeMode,
} from "@/components/skill-tree/__tests__/test-fixtures";

// useBroadcastChannel をモック
let mockBroadcastState: BacktestState | null = null;

vi.mock("@/hooks/useBroadcastChannel", () => ({
  useBroadcastChannel: () => mockBroadcastState,
}));

/**
 * バックテスト状態のデフォルト値を作成
 */
function createBacktestState(
  overrides: Partial<BacktestState> = {},
): BacktestState {
  return {
    current_time: "2024-01-15",
    progress: 0.5,
    equity: 100000,
    cash: 100000,
    position: 0,
    positions: {},
    closed_trades: 0,
    step_index: 50,
    total_steps: 100,
    status_label: "Backtest",
    status_variant: "secondary",
    ...overrides,
  };
}

/**
 * HudItem のラベルに対応する値テキストを取得するヘルパー。
 * HudItem 構造: <div> <span>icon</span> <span>Label:</span> <span>value</span> </div>
 */
function getHudValue(container: HTMLElement, label: string): string {
  const labelEl = within(container).getByText(`${label}:`);
  // ラベルの親 div 内の最後の span が値
  const parent = labelEl.closest("div")!;
  const spans = parent.querySelectorAll("span.font-medium");
  return spans[0]?.textContent ?? "";
}

describe("BacktestHud", () => {
  let store: ReturnType<typeof createStore>;

  beforeEach(() => {
    store = createStore();
    mockBroadcastState = null;

    // localStorage をモック
    const mockStorage: Record<string, string> = {};
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(
      (key) => mockStorage[key] ?? null,
    );
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
      mockStorage[key] = value;
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key) => {
      delete mockStorage[key];
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderHud() {
    return render(
      <Provider store={store}>
        <BacktestHud />
      </Provider>,
    );
  }

  // ========================================
  // プレースホルダー表示
  // ========================================

  describe("backtest_channel 未受信時", () => {
    it("プレースホルダー「待機中」が表示される", () => {
      mockBroadcastState = null;
      renderHud();
      expect(screen.getByText("待機中")).toBeInTheDocument();
    });

    it("Equity/Cash が「-」で表示される", () => {
      mockBroadcastState = null;
      renderHud();
      const dashes = screen.getAllByText("-");
      expect(dashes.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ========================================
  // Equity 表示と報酬キャッシュの統合
  // ========================================

  describe("Equity 表示と報酬キャッシュの統合", () => {
    it("backtest equity=100,000 + currentCash=0 → Equity: ¥100,000", () => {
      mockBroadcastState = createBacktestState({ equity: 100000 });
      const { container } = renderHud();
      expect(getHudValue(container, "Equity")).toBe("¥100,000");
    });

    it("backtest equity=100,000 + currentCash=30,000 → Equity: ¥130,000", () => {
      mockBroadcastState = createBacktestState({ equity: 100000 });
      store.set(playerProgressAtom, mockProgressAfterFirstSkill);
      const { container } = renderHud();
      expect(getHudValue(container, "Equity")).toBe("¥130,000");
    });

    it("backtest equity=105,000 (取引利益) + currentCash=30,000 → Equity: ¥135,000", () => {
      mockBroadcastState = createBacktestState({ equity: 105000 });
      store.set(playerProgressAtom, mockProgressAfterFirstSkill);
      const { container } = renderHud();
      expect(getHudValue(container, "Equity")).toBe("¥135,000");
    });

    it("サンドボックス卒業後: backtest equity=100,000 + currentCash=150,000 → Equity: ¥250,000", () => {
      mockBroadcastState = createBacktestState({ equity: 100000 });
      store.set(playerProgressAtom, mockProgressBridgeMode);
      const { container } = renderHud();
      expect(getHudValue(container, "Equity")).toBe("¥250,000");
    });
  });

  // ========================================
  // Cash 表示と報酬キャッシュの統合
  // ========================================

  describe("Cash 表示と報酬キャッシュの統合", () => {
    it("backtest cash=95,000 + currentCash=30,000 → Cash: ¥125,000", () => {
      mockBroadcastState = createBacktestState({ equity: 100000, cash: 95000 });
      store.set(playerProgressAtom, mockProgressAfterFirstSkill);
      const { container } = renderHud();
      expect(getHudValue(container, "Cash")).toBe("¥125,000");
    });

    it("backtest cash=100,000 + currentCash=0 → Cash: ¥100,000", () => {
      mockBroadcastState = createBacktestState({ cash: 100000 });
      const { container } = renderHud();
      expect(getHudValue(container, "Cash")).toBe("¥100,000");
    });
  });

  // ========================================
  // リセット後の表示
  // ========================================

  describe("リセット後の表示", () => {
    it("リセット後 currentCash=0 → backtest equity そのまま表示", () => {
      mockBroadcastState = createBacktestState({ equity: 100000 });
      store.set(playerProgressAtom, mockProgressAfterFirstSkill);
      store.set(playerProgressAtom, mockProgressGameStart);
      const { container } = renderHud();
      expect(getHudValue(container, "Equity")).toBe("¥100,000");
    });
  });

  // ========================================
  // 再レンダリングの反応性テスト
  // ========================================

  describe("currentCash 変化時の再レンダリング", () => {
    it("currentCash が変化したとき表示が更新される", () => {
      mockBroadcastState = createBacktestState({ equity: 100000 });
      const { container, rerender } = render(
        <Provider store={store}>
          <BacktestHud />
        </Provider>,
      );

      // 初期状態: Equity ¥100,000
      expect(getHudValue(container, "Equity")).toBe("¥100,000");

      // SANDBOX_001 完了 → currentCash=30,000
      act(() => {
        store.set(playerProgressAtom, mockProgressAfterFirstSkill);
      });

      rerender(
        <Provider store={store}>
          <BacktestHud />
        </Provider>,
      );

      // 更新後: Equity ¥130,000
      expect(getHudValue(container, "Equity")).toBe("¥130,000");
    });
  });
});
