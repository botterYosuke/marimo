/* Copyright 2026 Marimo. All rights reserved. */
/**
 * extractAndSendBroadcastMessages() のユニットテスト
 *
 * テスト対象: handlers.ts の extractAndSendBroadcastMessages()
 * カバレッジ: E2E テストギャップ分析のレイヤー③
 *   - Pattern 1: <marimo-broadcast> タグのパース
 *   - Pattern 2: data-marimo-broadcast 属性のパース
 *   - emit_skill() が生成する HTML との契約テスト
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// sendBroadcastMessage をモックして、パース結果をキャプチャ
vi.mock("@/utils/broadcastChannel", () => ({
  sendBroadcastMessage: vi.fn(),
}));

import { extractAndSendBroadcastMessages } from "../handlers";
import { sendBroadcastMessage } from "@/utils/broadcastChannel";

const mockSendBroadcastMessage = vi.mocked(sendBroadcastMessage);

beforeEach(() => {
  mockSendBroadcastMessage.mockReset();
});

describe("extractAndSendBroadcastMessages", () => {
  describe("Pattern 1: <marimo-broadcast> タグ", () => {
    it("正しい形式の <marimo-broadcast> タグからチャネル・タイプ・ペイロードを抽出する", () => {
      const payload = btoa(JSON.stringify({ skill_id: "SANDBOX_001" }));
      const html = `<marimo-broadcast id="skill-SANDBOX_001-123" channel="skill_event_channel" type="skill_complete" payload="${payload}" style="display:none;"></marimo-broadcast>`;

      extractAndSendBroadcastMessages(html);

      expect(mockSendBroadcastMessage).toHaveBeenCalledOnce();
      expect(mockSendBroadcastMessage).toHaveBeenCalledWith(
        "skill_event_channel",
        "skill_complete",
        payload,
      );
    });

    it("属性の順序が異なっても正しくパースされる", () => {
      const payload = btoa(JSON.stringify({ skill_id: "TEST_001" }));
      // type → payload → channel の順序（emit_skill() と異なる順序）
      const html = `<marimo-broadcast type="skill_complete" payload="${payload}" channel="skill_event_channel"></marimo-broadcast>`;

      extractAndSendBroadcastMessages(html);

      expect(mockSendBroadcastMessage).toHaveBeenCalledWith(
        "skill_event_channel",
        "skill_complete",
        payload,
      );
    });

    it("HTML 内に複数の <marimo-broadcast> タグがある場合すべて処理される", () => {
      const payload1 = btoa(JSON.stringify({ skill_id: "SANDBOX_001" }));
      const payload2 = btoa(JSON.stringify({ skill_id: "SANDBOX_002" }));
      const html =
        `<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="${payload1}"></marimo-broadcast>` +
        `<marimo-broadcast channel="skill_event_channel" type="skill_complete" payload="${payload2}"></marimo-broadcast>`;

      extractAndSendBroadcastMessages(html);

      expect(mockSendBroadcastMessage).toHaveBeenCalledTimes(2);
      expect(mockSendBroadcastMessage).toHaveBeenNthCalledWith(
        1,
        "skill_event_channel",
        "skill_complete",
        payload1,
      );
      expect(mockSendBroadcastMessage).toHaveBeenNthCalledWith(
        2,
        "skill_event_channel",
        "skill_complete",
        payload2,
      );
    });

    it("必須属性（channel/type/payload）のいずれかが欠けている場合は送信しない", () => {
      // payload 属性が欠けている
      const html = `<marimo-broadcast channel="skill_event_channel" type="skill_complete"></marimo-broadcast>`;

      extractAndSendBroadcastMessages(html);

      expect(mockSendBroadcastMessage).not.toHaveBeenCalled();
    });
  });

  describe("Pattern 2: data-marimo-broadcast 属性", () => {
    it("data-marimo-broadcast 属性からチャネル・タイプ・ペイロードを抽出する", () => {
      const payload = btoa(JSON.stringify({ key: "value" }));
      const html = `<div data-marimo-broadcast="my_channel" data-marimo-type="my_type" data-marimo-payload="${payload}"></div>`;

      extractAndSendBroadcastMessages(html);

      expect(mockSendBroadcastMessage).toHaveBeenCalledOnce();
      expect(mockSendBroadcastMessage).toHaveBeenCalledWith(
        "my_channel",
        "my_type",
        payload,
      );
    });

    it("data-marimo-type が欠けている場合は送信しない", () => {
      const payload = btoa(JSON.stringify({ key: "value" }));
      const html = `<div data-marimo-broadcast="my_channel" data-marimo-payload="${payload}"></div>`;

      extractAndSendBroadcastMessages(html);

      expect(mockSendBroadcastMessage).not.toHaveBeenCalled();
    });
  });

  describe("エッジケース", () => {
    it("marimo-broadcast を含まない HTML では何もしない", () => {
      const html = `<div>Hello World</div>`;

      extractAndSendBroadcastMessages(html);

      expect(mockSendBroadcastMessage).not.toHaveBeenCalled();
    });

    it("空文字列では何もしない", () => {
      extractAndSendBroadcastMessages("");

      expect(mockSendBroadcastMessage).not.toHaveBeenCalled();
    });
  });

  describe("emit_skill() との契約テスト", () => {
    it("Python emit_skill() が生成する形式の HTML を正しくパースできる", () => {
      // emit_skill("SANDBOX_001") が生成する HTML を再現
      const event = {
        skill_id: "SANDBOX_001",
        context: {},
        timestamp: 1700000000000,
      };
      const eventB64 = btoa(JSON.stringify(event));
      const html =
        `<marimo-broadcast ` +
        `id="skill-SANDBOX_001-1700000000000" ` +
        `channel="skill_event_channel" ` +
        `type="skill_complete" ` +
        `payload="${eventB64}" ` +
        `style="display:none;"></marimo-broadcast>`;

      extractAndSendBroadcastMessages(html);

      expect(mockSendBroadcastMessage).toHaveBeenCalledOnce();
      expect(mockSendBroadcastMessage).toHaveBeenCalledWith(
        "skill_event_channel",
        "skill_complete",
        eventB64,
      );
    });

    it("context 付きの emit_skill() の出力も正しくパースできる", () => {
      const event = {
        skill_id: "FAIL_001",
        context: { reason: "unrealized_loss", amount: -500 },
        timestamp: 1700000000000,
      };
      const eventB64 = btoa(JSON.stringify(event));
      const html =
        `<marimo-broadcast ` +
        `id="skill-FAIL_001-1700000000000" ` +
        `channel="skill_event_channel" ` +
        `type="skill_complete" ` +
        `payload="${eventB64}" ` +
        `style="display:none;"></marimo-broadcast>`;

      extractAndSendBroadcastMessages(html);

      expect(mockSendBroadcastMessage).toHaveBeenCalledWith(
        "skill_event_channel",
        "skill_complete",
        eventB64,
      );
    });
  });
});
