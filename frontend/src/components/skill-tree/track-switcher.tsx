/* Copyright 2026 Marimo. All rights reserved. */

import { useAtomValue } from "jotai";
import { LockIcon, CheckCircle2Icon, CircleIcon } from "lucide-react";
import { cn } from "@/utils/cn";
import { Badge } from "@/components/ui/badge";
import type { SkillTrack } from "./types";
import {
  playerProgressAtom,
  translatedSkillsAtom,
  currentTrackAtom,
} from "./atoms";

interface TrackSwitcherProps {
  selectedTrack: SkillTrack | "all";
  onTrackChange: (track: SkillTrack | "all") => void;
}

const trackConfig: Record<
  SkillTrack,
  { label: string; description: string; color: string }
> = {
  sandbox: {
    label: "サンドボックス",
    description: "即座に楽しい",
    color: "bg-green-500",
  },
  bridge: {
    label: "ブリッジ",
    description: "段階的に理解",
    color: "bg-blue-500",
  },
  full: {
    label: "フルモード",
    description: "マスタリー",
    color: "bg-violet-500",
  },
};

/**
 * トラック切り替えタブコンポーネント
 * - sandbox/bridge/full/all のフィルタリング
 * - ロック状態の表示
 * - 各トラックの進捗表示
 */
export function TrackSwitcher({
  selectedTrack,
  onTrackChange,
}: TrackSwitcherProps) {
  const progress = useAtomValue(playerProgressAtom);
  const skills = useAtomValue(translatedSkillsAtom);
  const currentTrack = useAtomValue(currentTrackAtom);

  // 各トラックの進捗を計算
  const getTrackProgress = (track: SkillTrack) => {
    const trackSkills = skills.filter((s) => s.track === track);
    const completed = trackSkills.filter((s) => s.status === "completed").length;
    return { completed, total: trackSkills.length };
  };

  // トラックがアンロックされているか
  const isTrackUnlocked = (track: SkillTrack): boolean => {
    if (track === "sandbox") return true;
    if (track === "bridge") return progress.sandboxCompleted;
    if (track === "full") return progress.bridgeCompleted;
    return false;
  };

  // トラックが完了しているか
  const isTrackCompleted = (track: SkillTrack): boolean => {
    if (track === "sandbox") return progress.sandboxCompleted;
    if (track === "bridge") return progress.bridgeCompleted;
    // フルモードは全スキル完了で判定
    const fullProgress = getTrackProgress("full");
    return fullProgress.completed === fullProgress.total;
  };

  const tracks: (SkillTrack | "all")[] = ["all", "sandbox", "bridge", "full"];

  return (
    <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
      {tracks.map((track) => {
        const isAll = track === "all";
        const config = isAll ? null : trackConfig[track];
        const unlocked = isAll || isTrackUnlocked(track);
        const completed = !isAll && isTrackCompleted(track);
        const isSelected = selectedTrack === track;
        const isCurrent = !isAll && track === currentTrack;
        const trackProgress = isAll ? null : getTrackProgress(track);

        return (
          <button
            key={track}
            type="button"
            onClick={() => unlocked && onTrackChange(track)}
            disabled={!unlocked}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all",
              isSelected
                ? "bg-background shadow-sm"
                : unlocked
                  ? "hover:bg-background/50"
                  : "opacity-50 cursor-not-allowed",
              isCurrent && !isSelected && "ring-1 ring-primary/30"
            )}
          >
            {/* ステータスアイコン */}
            {!isAll && (
              <span className="flex-shrink-0">
                {!unlocked ? (
                  <LockIcon className="w-3.5 h-3.5 text-muted-foreground" />
                ) : completed ? (
                  <CheckCircle2Icon className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <CircleIcon className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </span>
            )}

            {/* ラベル */}
            <span className={cn("font-medium", !unlocked && "text-muted-foreground")}>
              {isAll ? "すべて" : config?.label}
            </span>

            {/* 進捗バッジ */}
            {trackProgress && unlocked && (
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  completed && "bg-green-500/20 text-green-700 dark:text-green-400"
                )}
              >
                {trackProgress.completed}/{trackProgress.total}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
