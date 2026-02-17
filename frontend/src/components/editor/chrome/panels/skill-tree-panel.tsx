/* Copyright 2026 Marimo. All rights reserved. */
import React, { useState, useMemo, useCallback, memo } from "react";
import { useAtomValue } from "jotai";
import { SkillTree } from "@/components/skill-tree/skill-tree";
import {
  translatedSkillsAtom,
  playerProgressAtom,
  SandboxIndicator,
  BridgeIndicator,
  TrackSwitcher,
} from "@/components/skill-tree";
import { RewardSummary } from "@/components/skill-tree/rewards/reward-summary";
import type { Skill, SkillTrack } from "@/components/skill-tree/types";
import { Badge } from "@/components/ui/badge";
import { TrophyIcon, CoinsIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";

const SkillTreePanel: React.FC = memo(() => {
  const skills = useAtomValue(translatedSkillsAtom);
  const progress = useAtomValue(playerProgressAtom);
  const [selectedTrack, setSelectedTrack] = useState<SkillTrack | "all">("all");
  const [showRewardDetails, setShowRewardDetails] = useState(false);

  // トラックでフィルタリング
  const filteredSkills = useMemo(() => {
    if (selectedTrack === "all") {
      return skills;
    }
    return skills.filter((s) => s.track === selectedTrack);
  }, [skills, selectedTrack]);

  // 進捗計算
  const completedCount = progress.completedSkills.length;
  const totalCount = skills.length;

  // スキルクリックハンドラをメモ化
  const handleSkillClick = useCallback((skill: Skill) => {
    console.log("Skill clicked:", skill.id);
  }, []);

  return (
    <div data-testid="skill-tree-panel" className="w-full h-full flex-1 mx-auto flex flex-col">
      {/* ヘッダー: 進捗サマリー */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <TrophyIcon className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium">スキルツリー</span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {completedCount}/{totalCount} スキル
        </Badge>
      </div>

      {/* モードインジケーター */}
      <div className="px-3 py-2 space-y-2 border-b">
        <SandboxIndicator />
        <BridgeIndicator />
      </div>

      {/* トラック切り替え */}
      <div className="px-3 py-2 border-b">
        <TrackSwitcher
          selectedTrack={selectedTrack}
          onTrackChange={setSelectedTrack}
        />
      </div>

      {/* スキルツリーグラフ */}
      <div className="flex-1 min-h-0 relative">
        <SkillTree
          data={{ skills: filteredSkills }}
          onSkillClick={handleSkillClick}
        />
      </div>

      {/* フッター: 報酬サマリー（展開可能） */}
      <div className="border-t bg-muted/30">
        <button
          type="button"
          onClick={() => setShowRewardDetails(!showRewardDetails)}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm">
            <CoinsIcon className="w-4 h-4 text-amber-500" />
            <span className="font-medium">
              ¥{progress.currentCash.toLocaleString()}
            </span>
            {progress.earnedTitles.length > 0 && (
              <span className="text-muted-foreground text-xs">
                | 称号 {progress.earnedTitles.length}個
              </span>
            )}
          </div>
          {showRewardDetails ? (
            <ChevronDownIcon className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronUpIcon className="w-4 h-4 text-muted-foreground" />
          )}
        </button>

        {/* 展開時の詳細報酬サマリー */}
        {showRewardDetails && (
          <div className="border-t max-h-[300px] overflow-y-auto">
            <RewardSummary />
          </div>
        )}
      </div>
    </div>
  );
});

SkillTreePanel.displayName = "SkillTreePanel";

export default SkillTreePanel;
