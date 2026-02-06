/* Copyright 2026 Marimo. All rights reserved. */

import { getInjectionTemplate } from "./injection-templates";
import type { GameProgress } from "./types";

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
  onSkillComplete: (skillId: string) => void
): () => void {
  // BroadcastChannel APIが使用可能か確認
  if (typeof BroadcastChannel === "undefined") {
    console.warn("[SkillHandler] BroadcastChannel not available");
    return () => {};
  }

  const channel = new BroadcastChannel("skill_event_channel");

  const handleMessage = (event: MessageEvent) => {
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

  // クリーンアップ関数を返す
  return () => {
    channel.removeEventListener("message", handleMessage);
    channel.close();
  };
}

