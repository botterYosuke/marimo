/* Copyright 2026 Marimo. All rights reserved. */
import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  broadcastChannelManager,
  sendBroadcastMessage,
  replayBufferedMessages,
} from "../broadcastChannel";

// Mock BroadcastChannel
vi.stubGlobal(
  "BroadcastChannel",
  class MockBroadcastChannel {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    postMessage = vi.fn();
    close = vi.fn();
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
  },
);

beforeEach(() => {
  broadcastChannelManager.closeAll();
});

describe("BroadcastChannelManager - last-value cache", () => {
  it("caches messages on sendBroadcastMessage", () => {
    const payload = btoa(JSON.stringify({ skill_id: "TEST_001" }));
    sendBroadcastMessage("test_channel", "skill_complete", payload);

    const messages = broadcastChannelManager.consumeMessages("test_channel");
    expect(messages).toHaveLength(1);
    expect(messages[0].type).toBe("skill_complete");
    expect(messages[0].data).toEqual({ skill_id: "TEST_001" });
  });

  it("returns empty array for channels with no messages", () => {
    const messages = broadcastChannelManager.consumeMessages("nonexistent");
    expect(messages).toHaveLength(0);
  });

  it("consumeMessages clears the cache after returning messages", () => {
    const payload = btoa(JSON.stringify({ key: "value" }));
    sendBroadcastMessage("ch1", "type1", payload);

    const first = broadcastChannelManager.consumeMessages("ch1");
    expect(first).toHaveLength(1);

    const second = broadcastChannelManager.consumeMessages("ch1");
    expect(second).toHaveLength(0);
  });

  it("overwrites previous message with same channel+type", () => {
    const payload1 = btoa(JSON.stringify({ count: 1 }));
    const payload2 = btoa(JSON.stringify({ count: 2 }));

    sendBroadcastMessage("progress_channel", "progress_init", payload1);
    sendBroadcastMessage("progress_channel", "progress_init", payload2);

    const messages = broadcastChannelManager.consumeMessages("progress_channel");
    expect(messages).toHaveLength(1);
    expect(messages[0].data).toEqual({ count: 2 });
  });

  it("keeps separate caches for different types on same channel", () => {
    const payload1 = btoa(JSON.stringify({ skill_id: "A" }));
    const payload2 = btoa(JSON.stringify({ progress: 50 }));

    sendBroadcastMessage("skill_event_channel", "skill_complete", payload1);
    sendBroadcastMessage("skill_event_channel", "progress_update", payload2);

    const messages = broadcastChannelManager.consumeMessages(
      "skill_event_channel",
    );
    expect(messages).toHaveLength(2);
  });

  it("closeAll clears all caches", () => {
    const payload = btoa(JSON.stringify({ key: "value" }));
    sendBroadcastMessage("ch1", "type1", payload);
    sendBroadcastMessage("ch2", "type2", payload);

    broadcastChannelManager.closeAll();

    expect(broadcastChannelManager.consumeMessages("ch1")).toHaveLength(0);
    expect(broadcastChannelManager.consumeMessages("ch2")).toHaveLength(0);
  });
});

describe("replayBufferedMessages", () => {
  it("replays cached messages through the handler", () => {
    const payload = btoa(JSON.stringify({ skill_id: "SANDBOX_001" }));
    sendBroadcastMessage("skill_event_channel", "skill_complete", payload);

    const handler = vi.fn();
    replayBufferedMessages("skill_event_channel", handler);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "skill_complete",
          data: { skill_id: "SANDBOX_001" },
        }),
      }),
    );
  });

  it("replays multiple cached messages in order", () => {
    const payload1 = btoa(JSON.stringify({ skill_id: "A" }));
    const payload2 = btoa(JSON.stringify({ skill_id: "B" }));

    sendBroadcastMessage("skill_event_channel", "skill_complete", payload1);
    sendBroadcastMessage("skill_event_channel", "other_event", payload2);

    const handler = vi.fn();
    replayBufferedMessages("skill_event_channel", handler);

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("consumes messages after replaying", () => {
    const payload = btoa(JSON.stringify({ key: "value" }));
    sendBroadcastMessage("test_channel", "test_type", payload);

    const handler = vi.fn();
    replayBufferedMessages("test_channel", handler);

    // Second replay should have no messages
    handler.mockClear();
    replayBufferedMessages("test_channel", handler);
    expect(handler).not.toHaveBeenCalled();
  });

  it("does nothing for channels with no cached messages", () => {
    const handler = vi.fn();
    replayBufferedMessages("empty_channel", handler);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("sendBroadcastMessage - error handling", () => {
  it("returns false for invalid base64 payload", () => {
    const result = sendBroadcastMessage(
      "test_channel",
      "test_type",
      "not-base64!@#",
    );
    expect(result).toBe(false);
  });

  it("returns false for invalid JSON in payload", () => {
    const invalidJson = btoa("{invalid json");
    const result = sendBroadcastMessage("test_channel", "test_type", invalidJson);
    expect(result).toBe(false);
  });

  it("returns true for valid payload", () => {
    const payload = btoa(JSON.stringify({ key: "value" }));
    const result = sendBroadcastMessage("test_channel", "test_type", payload);
    expect(result).toBe(true);
  });
});
