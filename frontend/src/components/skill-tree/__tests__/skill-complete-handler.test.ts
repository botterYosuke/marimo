/* Copyright 2026 Marimo. All rights reserved. */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  handleSkillComplete,
  loadProgressFromNotebook,
  setupSkillEventListener,
} from "../skill-complete-handler";
import { mockGameProgressStart, mockGameProgressBridge } from "./test-fixtures";
import {
  sendBroadcastMessage,
  broadcastChannelManager,
} from "../../../utils/broadcastChannel";
import type { GameProgress } from "../types";

// ========================================
// P0-1: セル注入の整合性テスト
// ========================================
describe("handleSkillComplete", () => {
  const originalElectronAPI = window.electronAPI;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
    vi.restoreAllMocks();
  });

  describe("セル注入の整合性", () => {
    it("Electron API成功時、スキル完了とセル注入が両方行われる", async () => {
      const mockInjectCells = vi.fn().mockResolvedValue({ success: true });
      window.electronAPI = {
        isElectron: true,
        injectCells: mockInjectCells,
        readProgress: vi.fn(),
      };

      const result = await handleSkillComplete("SANDBOX_002", mockGameProgressStart);

      expect(result.success).toBe(true);
      expect(mockInjectCells).toHaveBeenCalledTimes(1);
      expect(mockInjectCells).toHaveBeenCalledWith(
        expect.objectContaining({
          skillId: "SANDBOX_002",
          cells: expect.any(Array),
          progressUpdate: expect.objectContaining({
            completed_skills: ["SANDBOX_002"],
          }),
        })
      );
    });

    it("Electron API失敗時、エラー状態が返される", async () => {
      const mockInjectCells = vi
        .fn()
        .mockResolvedValue({ success: false, error: "Injection failed" });
      window.electronAPI = {
        isElectron: true,
        injectCells: mockInjectCells,
        readProgress: vi.fn(),
      };

      const result = await handleSkillComplete("SANDBOX_002", mockGameProgressStart);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Injection failed");
      expect(console.error).toHaveBeenCalled();
    });

    it("Electron API例外時、エラーがキャッチされる", async () => {
      const mockInjectCells = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));
      window.electronAPI = {
        isElectron: true,
        injectCells: mockInjectCells,
        readProgress: vi.fn(),
      };

      const result = await handleSkillComplete("SANDBOX_002", mockGameProgressStart);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });

    it("非Electron環境では注入をスキップし、成功を返す", async () => {
      window.electronAPI = undefined;

      const result = await handleSkillComplete("SANDBOX_002", mockGameProgressStart);

      expect(result.success).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Not in Electron environment")
      );
    });

    it("isElectronがfalseの場合も注入をスキップ", async () => {
      window.electronAPI = {
        isElectron: false,
        injectCells: vi.fn(),
        readProgress: vi.fn(),
      };

      const result = await handleSkillComplete("SANDBOX_002", mockGameProgressStart);

      expect(result.success).toBe(true);
      expect(window.electronAPI.injectCells).not.toHaveBeenCalled();
    });
  });

  describe("テンプレートなしスキル", () => {
    it("テンプレートがないスキルでは注入をスキップし、成功を返す", async () => {
      const mockInjectCells = vi.fn();
      window.electronAPI = {
        isElectron: true,
        injectCells: mockInjectCells,
        readProgress: vi.fn(),
      };

      // SANDBOX_001にはテンプレートがない
      const result = await handleSkillComplete("SANDBOX_001", mockGameProgressStart);

      expect(result.success).toBe(true);
      expect(mockInjectCells).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("No injection template")
      );
    });
  });

  describe("モード変更処理", () => {
    it("SANDBOX_006完了時、current_modeがbridgeに変更される", async () => {
      const mockInjectCells = vi.fn().mockResolvedValue({ success: true });
      window.electronAPI = {
        isElectron: true,
        injectCells: mockInjectCells,
        readProgress: vi.fn(),
      };

      const progress: GameProgress = {
        ...mockGameProgressStart,
        completed_skills: [
          "SANDBOX_001",
          "SANDBOX_002",
          "SANDBOX_003",
          "SANDBOX_004",
          "SANDBOX_005",
        ],
      };

      await handleSkillComplete("SANDBOX_006", progress);

      expect(mockInjectCells).toHaveBeenCalledWith(
        expect.objectContaining({
          progressUpdate: expect.objectContaining({
            current_mode: "bridge",
          }),
        })
      );
    });

    it("BRIDGE_003完了時、current_modeがfullに変更される", async () => {
      const mockInjectCells = vi.fn().mockResolvedValue({ success: true });
      window.electronAPI = {
        isElectron: true,
        injectCells: mockInjectCells,
        readProgress: vi.fn(),
      };

      await handleSkillComplete("BRIDGE_003", mockGameProgressBridge);

      expect(mockInjectCells).toHaveBeenCalledWith(
        expect.objectContaining({
          progressUpdate: expect.objectContaining({
            current_mode: "full",
          }),
        })
      );
    });
  });
});

// ========================================
// loadProgressFromNotebook テスト
// ========================================
describe("loadProgressFromNotebook", () => {
  const originalElectronAPI = window.electronAPI;

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
    vi.restoreAllMocks();
  });

  it("Electron環境でない場合はnullを返す", async () => {
    window.electronAPI = undefined;

    const result = await loadProgressFromNotebook();

    expect(result).toBeNull();
  });

  it("進捗データが正常に取得できる", async () => {
    const mockReadProgress = vi.fn().mockResolvedValue({
      success: true,
      progress: mockGameProgressBridge,
    });
    window.electronAPI = {
      isElectron: true,
      injectCells: vi.fn(),
      readProgress: mockReadProgress,
    };

    const result = await loadProgressFromNotebook();

    expect(result).toEqual(mockGameProgressBridge);
  });

  it("API失敗時はnullを返す", async () => {
    const mockReadProgress = vi.fn().mockResolvedValue({
      success: false,
      error: "Read failed",
    });
    window.electronAPI = {
      isElectron: true,
      injectCells: vi.fn(),
      readProgress: mockReadProgress,
    };

    const result = await loadProgressFromNotebook();

    expect(result).toBeNull();
  });

  it("例外発生時はnullを返す", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const mockReadProgress = vi.fn().mockRejectedValue(new Error("Network error"));
    window.electronAPI = {
      isElectron: true,
      injectCells: vi.fn(),
      readProgress: mockReadProgress,
    };

    const result = await loadProgressFromNotebook();

    expect(result).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});

// ========================================
// P0-3: BroadcastChannel 統合テスト
// ========================================
describe("setupSkillEventListener", () => {
  const originalBroadcastChannel = globalThis.BroadcastChannel;
  let mockChannel: {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    onmessage: ((event: MessageEvent) => void) | null;
  };

  beforeEach(() => {
    mockChannel = {
      addEventListener: vi.fn((event: string, handler: (e: MessageEvent) => void) => {
        if (event === "message") {
          mockChannel.onmessage = handler;
        }
      }),
      removeEventListener: vi.fn(),
      close: vi.fn(),
      onmessage: null,
    };

    globalThis.BroadcastChannel = vi.fn(() => mockChannel) as unknown as typeof BroadcastChannel;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.BroadcastChannel = originalBroadcastChannel;
    vi.restoreAllMocks();
  });

  it("正常なイベントでコールバックが呼ばれる", () => {
    const onSkillComplete = vi.fn();
    const cleanup = setupSkillEventListener(onSkillComplete);

    // sendBroadcastMessage が送信する形式: { type, data: { skill_id, ... } }
    const event = new MessageEvent("message", {
      data: { type: "skill_complete", data: { skill_id: "SANDBOX_001", context: {}, timestamp: 1234567890 } },
    });
    mockChannel.onmessage?.(event);

    expect(onSkillComplete).toHaveBeenCalledWith("SANDBOX_001");

    cleanup();
    expect(mockChannel.removeEventListener).toHaveBeenCalled();
    expect(mockChannel.close).toHaveBeenCalled();
  });

  it("skill_idが含まれないペイロードは無視される", () => {
    const onSkillComplete = vi.fn();
    setupSkillEventListener(onSkillComplete);

    // type: skill_complete だが data.skill_id がない
    const event = new MessageEvent("message", {
      data: { type: "skill_complete", data: { context: {} } },
    });
    mockChannel.onmessage?.(event);

    expect(onSkillComplete).not.toHaveBeenCalled();
  });

  it("typeがskill_complete以外のイベントは無視される", () => {
    const onSkillComplete = vi.fn();
    setupSkillEventListener(onSkillComplete);

    const event = new MessageEvent("message", {
      data: { type: "other_event", data: { skill_id: "SANDBOX_001" } },
    });
    mockChannel.onmessage?.(event);

    expect(onSkillComplete).not.toHaveBeenCalled();
  });

  it("dataラッパーなしのフラットフォーマットは無視される", () => {
    const onSkillComplete = vi.fn();
    setupSkillEventListener(onSkillComplete);

    // 旧フォーマット（トップレベルに skill_id）は無視される
    const event = new MessageEvent("message", {
      data: { type: "skill_complete", skill_id: "SANDBOX_001" },
    });
    mockChannel.onmessage?.(event);

    expect(onSkillComplete).not.toHaveBeenCalled();
  });

  it("nullデータのイベントでエラーにならない", () => {
    const onSkillComplete = vi.fn();
    setupSkillEventListener(onSkillComplete);

    const event = new MessageEvent("message", { data: null });
    expect(() => mockChannel.onmessage?.(event)).not.toThrow();
    expect(onSkillComplete).not.toHaveBeenCalled();
  });

  it("BroadcastChannel非対応環境でエラーにならない", () => {
    // @ts-expect-error - 意図的にundefinedを設定
    globalThis.BroadcastChannel = undefined;

    const onSkillComplete = vi.fn();

    expect(() => {
      const cleanup = setupSkillEventListener(onSkillComplete);
      cleanup();
    }).not.toThrow();

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("BroadcastChannel not available")
    );
  });
});

// ========================================
// エッジケーステスト（Phase 9追加）
// ========================================
describe("エッジケース", () => {
  const originalElectronAPI = window.electronAPI;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    window.electronAPI = originalElectronAPI;
    vi.restoreAllMocks();
  });

  it("進捗更新で既存のcompleted_skillsが保持される", async () => {
    const mockInjectCells = vi.fn().mockResolvedValue({ success: true });
    window.electronAPI = {
      isElectron: true,
      injectCells: mockInjectCells,
      readProgress: vi.fn(),
    };

    const existingProgress: GameProgress = {
      ...mockGameProgressStart,
      completed_skills: ["SANDBOX_001", "SANDBOX_002"],
    };

    await handleSkillComplete("SANDBOX_003", existingProgress);

    expect(mockInjectCells).toHaveBeenCalledWith(
      expect.objectContaining({
        progressUpdate: expect.objectContaining({
          completed_skills: ["SANDBOX_001", "SANDBOX_002", "SANDBOX_003"],
        }),
      })
    );
  });

  it("空のcellsテンプレートでも正常に動作", async () => {
    const mockInjectCells = vi.fn().mockResolvedValue({ success: true });
    window.electronAPI = {
      isElectron: true,
      injectCells: mockInjectCells,
      readProgress: vi.fn(),
    };

    // SANDBOX_001にはテンプレートがないのでスキップされる
    const result = await handleSkillComplete("SANDBOX_001", mockGameProgressStart);
    expect(result.success).toBe(true);
  });

  it("非同期処理中のエラーが適切にキャッチされる", async () => {
    const mockInjectCells = vi.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Async timeout")), 10);
      });
    });
    window.electronAPI = {
      isElectron: true,
      injectCells: mockInjectCells,
      readProgress: vi.fn(),
    };

    const result = await handleSkillComplete("SANDBOX_002", mockGameProgressStart);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Async timeout");
  });

  it("ErrorオブジェクトでないエラーもStringに変換される", async () => {
    const mockInjectCells = vi.fn().mockRejectedValue("String error message");
    window.electronAPI = {
      isElectron: true,
      injectCells: mockInjectCells,
      readProgress: vi.fn(),
    };

    const result = await handleSkillComplete("SANDBOX_002", mockGameProgressStart);
    expect(result.success).toBe(false);
    expect(result.error).toBe("String error message");
  });
});

// ========================================
// sendBroadcastMessage → setupSkillEventListener 結合テスト
// ========================================

/**
 * cross-instance メッセージ転送をシミュレートする BroadcastChannel モック。
 * 実際の BroadcastChannel と同様に、postMessage は自身以外の同名チャネルに配信する。
 */
class MockBroadcastChannel {
  static instances = new Map<string, Set<MockBroadcastChannel>>();
  private channelName: string;
  private listeners = new Map<string, Set<(event: MessageEvent) => void>>();

  constructor(name: string) {
    this.channelName = name;
    if (!MockBroadcastChannel.instances.has(name)) {
      MockBroadcastChannel.instances.set(name, new Set());
    }
    MockBroadcastChannel.instances.get(name)!.add(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(data: unknown) {
    const event = new MessageEvent("message", { data });
    const peers = MockBroadcastChannel.instances.get(this.channelName);
    if (peers) {
      for (const peer of peers) {
        if (peer !== this) {
          for (const fn of peer.listeners.get("message") ?? []) {
            fn(event);
          }
        }
      }
    }
  }

  close() {
    MockBroadcastChannel.instances.get(this.channelName)?.delete(this);
  }

  static reset() {
    MockBroadcastChannel.instances.clear();
  }
}

describe("sendBroadcastMessage → setupSkillEventListener 結合テスト", () => {
  const originalBroadcastChannel = globalThis.BroadcastChannel;

  /** Python emit_skill() と同じ形式の Base64 ペイロードを生成 */
  function createBase64Payload(skillId: string): string {
    const event = {
      skill_id: skillId,
      context: {},
      timestamp: Date.now(),
    };
    return btoa(JSON.stringify(event));
  }

  const ALL_SKILL_IDS = [
    ["SANDBOX_002", "初めての購入"],
    ["SANDBOX_003", "買値を確認する"],
    ["SANDBOX_004", "初めての売却"],
    ["SANDBOX_005", "チャートで振り返る"],
    ["SANDBOX_006", "サンドボックス卒業"],
    ["BRIDGE_001", "データの正体"],
    ["BRIDGE_002", "自分でデータ取得"],
    ["BRIDGE_003", "ブリッジ卒業"],
    ["FAIL_001", "含み損を抱える"],
    ["FAIL_002", "損切りを経験"],
    ["FAIL_003", "破産を経験"],
  ] as const;

  beforeEach(() => {
    MockBroadcastChannel.reset();
    globalThis.BroadcastChannel =
      MockBroadcastChannel as unknown as typeof BroadcastChannel;
    broadcastChannelManager.closeAll();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    broadcastChannelManager.closeAll();
    MockBroadcastChannel.reset();
    globalThis.BroadcastChannel = originalBroadcastChannel;
    vi.restoreAllMocks();
  });

  it.each(ALL_SKILL_IDS)(
    "%s (%s) が正しくコールバックに渡される",
    (skillId) => {
      const onSkillComplete = vi.fn();
      const cleanup = setupSkillEventListener(onSkillComplete);

      const payload = createBase64Payload(skillId);
      const result = sendBroadcastMessage(
        "skill_event_channel",
        "skill_complete",
        payload,
      );

      expect(result).toBe(true);
      expect(onSkillComplete).toHaveBeenCalledTimes(1);
      expect(onSkillComplete).toHaveBeenCalledWith(skillId);

      cleanup();
    },
  );

  it("同じスキルIDを2回送信すると、コールバックも2回呼ばれる（重複ガードはatoms層）", () => {
    const onSkillComplete = vi.fn();
    const cleanup = setupSkillEventListener(onSkillComplete);

    const payload = createBase64Payload("SANDBOX_002");
    sendBroadcastMessage("skill_event_channel", "skill_complete", payload);
    sendBroadcastMessage("skill_event_channel", "skill_complete", payload);

    expect(onSkillComplete).toHaveBeenCalledTimes(2);
    expect(onSkillComplete).toHaveBeenNthCalledWith(1, "SANDBOX_002");
    expect(onSkillComplete).toHaveBeenNthCalledWith(2, "SANDBOX_002");

    cleanup();
  });

  it("存在しないスキルIDでもコールバックは呼ばれる（バリデーションはatoms層）", () => {
    const onSkillComplete = vi.fn();
    const cleanup = setupSkillEventListener(onSkillComplete);

    const payload = createBase64Payload("NONEXISTENT_999");
    sendBroadcastMessage("skill_event_channel", "skill_complete", payload);

    expect(onSkillComplete).toHaveBeenCalledTimes(1);
    expect(onSkillComplete).toHaveBeenCalledWith("NONEXISTENT_999");

    cleanup();
  });

  it("不正なBase64ペイロードではsendBroadcastMessageがfalseを返す", () => {
    const onSkillComplete = vi.fn();
    const cleanup = setupSkillEventListener(onSkillComplete);

    const result = sendBroadcastMessage(
      "skill_event_channel",
      "skill_complete",
      "!!!invalid!!!",
    );

    expect(result).toBe(false);
    expect(onSkillComplete).not.toHaveBeenCalled();

    cleanup();
  });
});
