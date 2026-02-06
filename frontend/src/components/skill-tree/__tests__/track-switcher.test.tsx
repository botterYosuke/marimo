/* Copyright 2026 Marimo. All rights reserved. */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Provider, createStore } from "jotai";
import { TrackSwitcher } from "../track-switcher";
import { playerProgressAtom } from "../atoms";
import { mockProgressGameStart, mockProgressBridgeMode, mockProgressFullMode } from "./test-fixtures";

// ========================================
// P2-3: TrackSwitcher ロック状態
// ========================================

function renderTrackSwitcher(
  progress = mockProgressGameStart,
  selectedTrack: "all" | "sandbox" | "bridge" | "full" = "all",
  onTrackChange = vi.fn()
) {
  const store = createStore();
  store.set(playerProgressAtom, progress);

  return {
    ...render(
      <Provider store={store}>
        <TrackSwitcher
          selectedTrack={selectedTrack}
          onTrackChange={onTrackChange}
        />
      </Provider>
    ),
    store,
    onTrackChange,
  };
}

describe("TrackSwitcher", () => {
  describe("初期状態", () => {
    it("4つのタブが表示される", () => {
      renderTrackSwitcher();

      expect(screen.getByText("すべて")).toBeInTheDocument();
      expect(screen.getByText("サンドボックス")).toBeInTheDocument();
      expect(screen.getByText("ブリッジ")).toBeInTheDocument();
      expect(screen.getByText("フルモード")).toBeInTheDocument();
    });

    it("初期状態でsandboxのみアクティブ", () => {
      renderTrackSwitcher(mockProgressGameStart);

      // sandboxは有効
      const sandboxButton = screen.getByText("サンドボックス").closest("button");
      expect(sandboxButton).not.toBeDisabled();

      // bridgeはロック
      const bridgeButton = screen.getByText("ブリッジ").closest("button");
      expect(bridgeButton).toBeDisabled();

      // fullはロック
      const fullButton = screen.getByText("フルモード").closest("button");
      expect(fullButton).toBeDisabled();
    });

    it("すべてタブは常に有効", () => {
      renderTrackSwitcher(mockProgressGameStart);

      const allButton = screen.getByText("すべて").closest("button");
      expect(allButton).not.toBeDisabled();
    });
  });

  describe("進捗による状態変化", () => {
    it("sandbox完了後、bridgeがアンロック", () => {
      renderTrackSwitcher(mockProgressBridgeMode);

      const bridgeButton = screen.getByText("ブリッジ").closest("button");
      expect(bridgeButton).not.toBeDisabled();
    });

    it("bridge完了後、fullがアンロック", () => {
      renderTrackSwitcher(mockProgressFullMode);

      const fullButton = screen.getByText("フルモード").closest("button");
      expect(fullButton).not.toBeDisabled();
    });
  });

  describe("進捗バッジ", () => {
    it("アンロック済みトラックに進捗バッジが表示される", () => {
      renderTrackSwitcher(mockProgressBridgeMode);

      // sandboxの進捗（6/8 - FAILスキルも含む）
      // sandbox track には SANDBOX_001-006 + FAIL_001, FAIL_002 の8スキル
      expect(screen.getByText("6/8")).toBeInTheDocument();
    });

    it("ロック中トラックには進捗バッジが表示されない", () => {
      renderTrackSwitcher(mockProgressGameStart);

      // bridgeの進捗バッジは表示されない
      // bridgeには0/3があるはずだが、ロック中は表示されない
      expect(screen.queryByText("0/3")).not.toBeInTheDocument();
    });
  });

  describe("クリックイベント", () => {
    it("有効なタブをクリックするとonTrackChangeが呼ばれる", () => {
      const onTrackChange = vi.fn();
      renderTrackSwitcher(mockProgressBridgeMode, "all", onTrackChange);

      fireEvent.click(screen.getByText("サンドボックス"));
      expect(onTrackChange).toHaveBeenCalledWith("sandbox");
    });

    it("無効なタブをクリックしてもonTrackChangeが呼ばれない", () => {
      const onTrackChange = vi.fn();
      renderTrackSwitcher(mockProgressGameStart, "all", onTrackChange);

      // bridgeは無効
      fireEvent.click(screen.getByText("ブリッジ"));
      expect(onTrackChange).not.toHaveBeenCalled();
    });

    it("すべてタブをクリックするとallが渡される", () => {
      const onTrackChange = vi.fn();
      renderTrackSwitcher(mockProgressGameStart, "sandbox", onTrackChange);

      fireEvent.click(screen.getByText("すべて"));
      expect(onTrackChange).toHaveBeenCalledWith("all");
    });
  });

  describe("選択状態の表示", () => {
    it("選択中のタブにはスタイルが適用される", () => {
      const { container } = renderTrackSwitcher(mockProgressGameStart, "sandbox");

      // 選択中のタブにはbg-backgroundクラスが適用される
      const buttons = container.querySelectorAll("button");
      const sandboxButton = Array.from(buttons).find(
        (b) => b.textContent?.includes("サンドボックス")
      );
      expect(sandboxButton?.className).toContain("bg-background");
    });
  });

  describe("完了状態アイコン", () => {
    it("完了したトラックにはチェックアイコンが表示される", () => {
      const { container } = renderTrackSwitcher(mockProgressBridgeMode);

      // sandboxが完了しているので、緑のチェックアイコンがある
      const greenIcons = container.querySelectorAll(".text-green-500");
      expect(greenIcons.length).toBeGreaterThan(0);
    });
  });
});
