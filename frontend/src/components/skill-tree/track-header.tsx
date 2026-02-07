/* Copyright 2026 Marimo. All rights reserved. */

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { SkillTrack } from "./types";
import { TRACK_INFO } from "./elements";

interface TrackHeaderProps {
  track: SkillTrack;
  completed: number;
  total: number;
}

// トラック別のアイコン色
const trackColors: Record<SkillTrack, string> = {
  sandbox: "bg-green-500",
  bridge: "bg-blue-500",
  full: "bg-purple-500",
};

export function TrackHeader({ track, completed, total }: TrackHeaderProps) {
  const info = TRACK_INFO[track];
  const progress = total > 0 ? (completed / total) * 100 : 0;
  const isComplete = completed === total && total > 0;

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-background/80 backdrop-blur-sm border-b">
      {/* Track indicator */}
      <div className={`w-2 h-2 rounded-full ${trackColors[track]}`} />

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{info.title}</h3>
          <Badge
            variant={isComplete ? "success" : "secondary"}
            className="text-xs"
          >
            {completed}/{total}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {info.description}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-24">
        <Progress value={progress} className="h-1.5" />
      </div>
    </div>
  );
}

/**
 * 全トラックのサマリーを表示するコンポーネント
 */
interface TrackSummaryProps {
  skills: Array<{ track: SkillTrack; status: string }>;
}

export function TrackSummary({ skills }: TrackSummaryProps) {
  // トラック別に集計
  const trackStats = (["sandbox", "bridge", "full"] as SkillTrack[]).map(
    (track) => {
      const trackSkills = skills.filter((s) => s.track === track);
      return {
        track,
        total: trackSkills.length,
        completed: trackSkills.filter((s) => s.status === "completed").length,
      };
    }
  );

  return (
    <div className="divide-y">
      {trackStats.map(({ track, total, completed }) => (
        <TrackHeader
          key={track}
          track={track}
          completed={completed}
          total={total}
        />
      ))}
    </div>
  );
}
