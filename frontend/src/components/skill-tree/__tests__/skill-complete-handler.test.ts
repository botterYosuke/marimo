/* Copyright 2026 Marimo. All rights reserved. */
/**
 * setupSkillEventListener() の BroadcastChannel リスナーのユニットテスト
 *
 * テスト対象: skill-complete-handler.ts の setupSkillEventListener()
 * カバレッジ: E2E テストギャップ分析のレイヤー⑤
 *   - BroadcastChannel リスナーが正しい形式のメッセージでコールバックを発火するか
 *   - 不正な形式のメッセージを無視するか
 *   - クリーンアップ関数が正しく動作するか
 *
 * Note: jsdom は BroadcastChannel を標準サポートしないため、
 *       最小限のモックを使用する。
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// --- BroadcastChannel モック ---
type MessageHandler = (event: MessageEvent) => void;

class MockBroadcastChannel {
  name: string;
  private listeners: MessageHandler[] = [];
  static instances: MockBroadcastChannel[] = [];

  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }

  addEventListener(type: string, handler: MessageHandler) {
    if (type === "message") {
      this.listeners.push(handler);
    }
  }

  removeEventListener(type: string, handler: MessageHandler) {
    if (type === "message") {
      this.listeners = this.listeners.filter((h) => h !== handler);
    }
  }

  // テストから直接メッセージを送信するためのヘルパー
  _simulateMessage(data: unknown) {
    const event = new MessageEvent("message", { data });
    for (const handler of this.listeners) {
      handler(event);
    }
  }

  postMessage(_data: unknown) {
    // 実装不要（テストでは _simulateMessage を使用）
  }

  close = vi.fn();

  static reset() {
    MockBroadcastChannel.instances = [];
  }
}

// グローバルに BroadcastChannel を注入
const originalBroadcastChannel = globalThis.BroadcastChannel;

beforeEach(() => {
  MockBroadcastChannel.reset();
  (globalThis as Record<string, unknown>).BroadcastChannel =
    MockBroadcastChannel;
});

afterEach(() => {
  // テストフックをクリーンアップ
  delete (window as Record<string, unknown>).__testCompleteSkill;
  delete (window as Record<string, unknown>).__testResetProgress;
  if (originalBroadcastChannel) {
    globalThis.BroadcastChannel = originalBroadcastChannel;
  } else {
    delete (globalThis as Record<string, unknown>).BroadcastChannel;
  }
});

// 動的インポートでモック後の BroadcastChannel を使わせる
async function importHandler() {
  // モジュールキャッシュをリセットして、新しい BroadcastChannel を使わせる
  vi.resetModules();
  const mod = await import("../skill-complete-handler");
  return mod;
}

describe("setupSkillEventListener", () => {
  describe("正常系: skill_complete メッセージ", () => {
    it("正しい形式のメッセージでコールバックが発火される", async () => {
      const { setupSkillEventListener } = await importHandler();
      const onSkillComplete = vi.fn();

      setupSkillEventListener(onSkillComplete);

      // BroadcastChannel インスタンスを取得
      const channel = MockBroadcastChannel.instances.find(
        (ch) => ch.name === "skill_event_channel",
      );
      expect(channel).toBeDefined();

      // sendBroadcastMessage() が送信する形式のメッセージをシミュレート
      channel!._simulateMessage({
        type: "skill_complete",
        data: { skill_id: "SANDBOX_001" },
      });

      expect(onSkillComplete).toHaveBeenCalledOnce();
      expect(onSkillComplete).toHaveBeenCalledWith("SANDBOX_001");
    });

    it("異なる skill_id でも正しくコールバックが発火される", async () => {
      const { setupSkillEventListener } = await importHandler();
      const onSkillComplete = vi.fn();

      setupSkillEventListener(onSkillComplete);

      const channel = MockBroadcastChannel.instances.find(
        (ch) => ch.name === "skill_event_channel",
      );

      channel!._simulateMessage({
        type: "skill_complete",
        data: { skill_id: "FAIL_001" },
      });

      expect(onSkillComplete).toHaveBeenCalledWith("FAIL_001");
    });

    it("連続する複数のメッセージで各々コールバックが発火される", async () => {
      const { setupSkillEventListener } = await importHandler();
      const onSkillComplete = vi.fn();

      setupSkillEventListener(onSkillComplete);

      const channel = MockBroadcastChannel.instances.find(
        (ch) => ch.name === "skill_event_channel",
      );

      channel!._simulateMessage({
        type: "skill_complete",
        data: { skill_id: "SANDBOX_001" },
      });
      channel!._simulateMessage({
        type: "skill_complete",
        data: { skill_id: "SANDBOX_002" },
      });

      expect(onSkillComplete).toHaveBeenCalledTimes(2);
      expect(onSkillComplete).toHaveBeenNthCalledWith(1, "SANDBOX_001");
      expect(onSkillComplete).toHaveBeenNthCalledWith(2, "SANDBOX_002");
    });
  });

  describe("異常系: 不正なメッセージ", () => {
    it("type が skill_complete でないメッセージは無視される", async () => {
      const { setupSkillEventListener } = await importHandler();
      const onSkillComplete = vi.fn();

      setupSkillEventListener(onSkillComplete);

      const channel = MockBroadcastChannel.instances.find(
        (ch) => ch.name === "skill_event_channel",
      );

      channel!._simulateMessage({
        type: "other_event",
        data: { skill_id: "SANDBOX_001" },
      });

      expect(onSkillComplete).not.toHaveBeenCalled();
    });

    it("skill_id が欠けているメッセージは無視される", async () => {
      const { setupSkillEventListener } = await importHandler();
      const onSkillComplete = vi.fn();

      setupSkillEventListener(onSkillComplete);

      const channel = MockBroadcastChannel.instances.find(
        (ch) => ch.name === "skill_event_channel",
      );

      channel!._simulateMessage({
        type: "skill_complete",
        data: {},
      });

      expect(onSkillComplete).not.toHaveBeenCalled();
    });

    it("data が null のメッセージは無視される", async () => {
      const { setupSkillEventListener } = await importHandler();
      const onSkillComplete = vi.fn();

      setupSkillEventListener(onSkillComplete);

      const channel = MockBroadcastChannel.instances.find(
        (ch) => ch.name === "skill_event_channel",
      );

      channel!._simulateMessage({
        type: "skill_complete",
        data: null,
      });

      expect(onSkillComplete).not.toHaveBeenCalled();
    });

    it("完全に空のメッセージは無視される", async () => {
      const { setupSkillEventListener } = await importHandler();
      const onSkillComplete = vi.fn();

      setupSkillEventListener(onSkillComplete);

      const channel = MockBroadcastChannel.instances.find(
        (ch) => ch.name === "skill_event_channel",
      );

      channel!._simulateMessage(null);

      expect(onSkillComplete).not.toHaveBeenCalled();
    });
  });

  describe("クリーンアップ", () => {
    it("クリーンアップ関数呼び出し後はメッセージを受信しない", async () => {
      const { setupSkillEventListener } = await importHandler();
      const onSkillComplete = vi.fn();

      const cleanup = setupSkillEventListener(onSkillComplete);

      const channel = MockBroadcastChannel.instances.find(
        (ch) => ch.name === "skill_event_channel",
      );

      // クリーンアップ
      cleanup();

      // クリーンアップ後のメッセージ
      channel!._simulateMessage({
        type: "skill_complete",
        data: { skill_id: "SANDBOX_001" },
      });

      expect(onSkillComplete).not.toHaveBeenCalled();
    });

    it("クリーンアップ後は window.__testCompleteSkill が削除される", async () => {
      const { setupSkillEventListener } = await importHandler();
      const onSkillComplete = vi.fn();

      const cleanup = setupSkillEventListener(onSkillComplete);

      expect(
        (window as Record<string, unknown>).__testCompleteSkill,
      ).toBeDefined();

      cleanup();

      expect(
        (window as Record<string, unknown>).__testCompleteSkill,
      ).toBeUndefined();
    });
  });

  describe("チャネル名の契約テスト", () => {
    it("skill_event_channel という名前の BroadcastChannel を使用する", async () => {
      const { setupSkillEventListener } = await importHandler();

      setupSkillEventListener(vi.fn());

      const channel = MockBroadcastChannel.instances.find(
        (ch) => ch.name === "skill_event_channel",
      );
      expect(channel).toBeDefined();
    });
  });

  describe("sendBroadcastMessage() との結合テスト", () => {
    it("sendBroadcastMessage が送信する形式とリスナーが期待する形式が一致する", async () => {
      /**
       * sendBroadcastMessage() は以下の形式で送信:
       *   channel.postMessage({ type, data })
       * ここで data = JSON.parse(atob(payload))
       *
       * setupSkillEventListener() は以下を検証:
       *   msg.type === "skill_complete" && msg.data.skill_id
       *
       * emit_skill() の payload は:
       *   { skill_id: "...", context: {}, timestamp: ... }
       *
       * よって、sendBroadcastMessage("skill_event_channel", "skill_complete", base64payload) で
       * リスナーに { type: "skill_complete", data: { skill_id: "...", ... } } が届く。
       */
      const { setupSkillEventListener } = await importHandler();
      const onSkillComplete = vi.fn();

      setupSkillEventListener(onSkillComplete);

      const channel = MockBroadcastChannel.instances.find(
        (ch) => ch.name === "skill_event_channel",
      );

      // sendBroadcastMessage が channel.postMessage() に渡す形式を再現
      const decodedPayload = {
        skill_id: "SANDBOX_001",
        context: {},
        timestamp: 1700000000000,
      };
      channel!._simulateMessage({
        type: "skill_complete",
        data: decodedPayload,
      });

      expect(onSkillComplete).toHaveBeenCalledWith("SANDBOX_001");
    });
  });
});
