/* Copyright 2026 Marimo. All rights reserved. */

import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { initProgressFromFileAtom } from "@/components/skill-tree";

const PROGRESS_CHANNEL = "progress_channel";

/**
 * Python 側の progress_manager からの進捗通知を監視し、
 * playerProgressAtom を初期化するフック。
 *
 * game_setup.py のインポート時に broadcast_progress() が呼ばれ、
 * handlers.ts の extractAndSendBroadcastMessages でパースされた後、
 * BroadcastChannel 経由でこのフックに到達する。
 */
export function useProgressSync(): void {
  const initProgress = useSetAtom(initProgressFromFileAtom);

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(PROGRESS_CHANNEL);

    channel.onmessage = (event: MessageEvent) => {
      try {
        const msg = event.data;
        if (msg?.type !== "progress_init" || !msg?.data) {
          return;
        }
        const completedSkills: string[] = msg.data.completed_skills ?? [];
        initProgress(completedSkills);
      } catch {
        // Silently ignore parse errors
      }
    };

    return () => {
      channel.close();
    };
  }, [initProgress]);
}
