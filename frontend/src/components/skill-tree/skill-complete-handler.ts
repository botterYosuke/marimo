/* Copyright 2026 Marimo. All rights reserved. */

import { getInjectionTemplate } from "./injection-templates";
import type { GameProgress } from "./types";
import { extractAndSendBroadcastMessages } from "@/core/kernel/handlers";
import { replayBufferedMessages } from "@/utils/broadcastChannel";

/**
 * Electron API の型定義
 */
interface ElectronAPI {
  isElectron: boolean;
  injectCells: (options: {
    skillId: string;
    cells?: Array<{
      name: string;
      code: string;
      config?: string;
      afterCell?: string;
    }>;
    progressUpdate?: GameProgress;
  }) => Promise<{ success: boolean; error?: string }>;
  readProgress: () => Promise<{
    success: boolean;
    progress?: GameProgress;
    error?: string;
  }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

/**
 * スキル完了時のセル注入を処理
 *
 * @param skillId - 完了したスキルID
 * @param currentProgress - 現在の進捗データ
 * @returns 成功したかどうか
 */
export async function handleSkillComplete(
  skillId: string,
  currentProgress: GameProgress
): Promise<{ success: boolean; error?: string }> {
  // Electron環境でない場合はスキップ
  if (!window.electronAPI?.isElectron) {
    console.log("[SkillHandler] Not in Electron environment, skipping injection");
    return { success: true };
  }

  // 注入テンプレートを取得
  const template = getInjectionTemplate(skillId);
  if (!template) {
    console.log(`[SkillHandler] No injection template for skill: ${skillId}`);
    return { success: true };
  }

  console.log(`[SkillHandler] Injecting cells for skill: ${skillId}`);

  // 進捗データを更新
  const updatedProgress: GameProgress = {
    ...currentProgress,
    completed_skills: [...currentProgress.completed_skills, skillId],
  };

  // モード変更の処理
  if (skillId === "SANDBOX_006") {
    updatedProgress.current_mode = "bridge";
  } else if (skillId === "BRIDGE_003") {
    updatedProgress.current_mode = "full";
  }

  try {
    const result = await window.electronAPI.injectCells({
      skillId,
      cells: template.cells,
      progressUpdate: updatedProgress,
    });

    if (!result.success) {
      console.error(`[SkillHandler] Injection failed: ${result.error}`);
      return result;
    }

    console.log(`[SkillHandler] Successfully injected cells for: ${skillId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SkillHandler] Error during injection: ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

/**
 * ノートブックから進捗データを読み込み
 */
export async function loadProgressFromNotebook(): Promise<GameProgress | null> {
  if (!window.electronAPI?.isElectron) {
    return null;
  }

  try {
    const result = await window.electronAPI.readProgress();
    if (result.success && result.progress) {
      return result.progress;
    }
    return null;
  } catch (error) {
    console.error("[SkillHandler] Failed to load progress:", error);
    return null;
  }
}

/**
 * BroadcastChannelでスキルイベントを監視するリスナーを設定
 */
export function setupSkillEventListener(
  onSkillComplete: (skillId: string) => void,
  onReset?: () => void,
): () => void {
  // リセット後に BroadcastChannel 経由の遅延カーネルメッセージを抑制するフラグ。
  // __testCompleteSkill（テストから直接発火）は抑制しない。
  let suppressBroadcast = false;
  let suppressTimer: ReturnType<typeof setTimeout> | null = null;

  // e2e テスト用フック: page.evaluate() から直接スキル完了/リセットを発火できる
  (window as unknown as Record<string, unknown>).__testCompleteSkill =
    onSkillComplete;
  if (onReset) {
    (window as unknown as Record<string, unknown>).__testResetProgress = () => {
      onReset();
      // リセット後、BroadcastChannel 経由のイベントを一時的に抑制
      // カーネルが再送するセル出力由来のスキルイベントを無視するため
      suppressBroadcast = true;
      if (suppressTimer) clearTimeout(suppressTimer);
      suppressTimer = setTimeout(() => {
        suppressBroadcast = false;
        suppressTimer = null;
      }, 1_000);
      // progress_channel も抑制する（知見 39）
      // auto_instantiate の broadcast_progress() がテスト中に割り込み、
      // __testCompleteSkill で追加したスキルを消してしまうのを防ぐ
      (window as unknown as Record<string, unknown>).__testSuppressProgressSync =
        true;
    };
  }
  // e2e 統合テスト用フック: emit_skill() 形式の HTML を本番パイプライン（③→⑦）経由で処理する
  // extractAndSendBroadcastMessages() → sendBroadcastMessage() → BroadcastChannel → listener → atom → UI
  (window as unknown as Record<string, unknown>).__testInjectBroadcastHTML = (
    html: string,
  ) => {
    extractAndSendBroadcastMessages(html);
  };

  // BroadcastChannel APIが使用可能か確認
  if (typeof BroadcastChannel === "undefined") {
    console.warn("[SkillHandler] BroadcastChannel not available");
    return () => {
      delete (window as unknown as Record<string, unknown>).__testCompleteSkill;
      delete (window as unknown as Record<string, unknown>).__testResetProgress;
      delete (window as unknown as Record<string, unknown>).__testInjectBroadcastHTML;
      if (suppressTimer) clearTimeout(suppressTimer);
    };
  }

  const channel = new BroadcastChannel("skill_event_channel");

  const handleMessage = (event: MessageEvent) => {
    if (suppressBroadcast) {
      return;
    }
    try {
      const msg = event.data;
      if (msg?.type === "skill_complete" && msg?.data?.skill_id) {
        const skillId = msg.data.skill_id as string;
        console.log(`[SkillHandler] Received skill event: ${skillId}`);
        onSkillComplete(skillId);
      }
    } catch (error) {
      console.error("[SkillHandler] Error handling skill event:", error);
    }
  };

  channel.addEventListener("message", handleMessage);

  // Replay cached messages from before this listener mounted.
  // This handles reconnection scenarios where broadcasts were sent
  // before React components finished mounting.
  replayBufferedMessages("skill_event_channel", handleMessage);

  // クリーンアップ関数を返す
  return () => {
    delete (window as unknown as Record<string, unknown>).__testCompleteSkill;
    delete (window as unknown as Record<string, unknown>).__testResetProgress;
    delete (window as unknown as Record<string, unknown>).__testSuppressProgressSync;
    delete (window as unknown as Record<string, unknown>).__testInjectBroadcastHTML;
    if (suppressTimer) clearTimeout(suppressTimer);
    channel.removeEventListener("message", handleMessage);
    channel.close();
  };
}

