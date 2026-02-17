/* Copyright 2026 Marimo. All rights reserved. */

import {
  ActivityIcon,
  BarChart3Icon,
  ClockIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";
import { useAtomValue } from "jotai";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { useBroadcastChannel } from "@/hooks/useBroadcastChannel";
import { playerProgressAtom } from "@/components/skill-tree/atoms";
import { cn } from "@/utils/cn";

const CHANNEL_NAME = "backtest_channel";

/**
 * Format a number as Japanese Yen currency
 */
function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP", { maximumFractionDigits: 0 })}`;
}

/**
 * Format progress as percentage
 */
function formatProgress(progress: number): string {
  return `${(progress * 100).toFixed(1)}%`;
}

interface HudItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const HudItem: React.FC<HudItemProps> = ({ icon, label, value }) => (
  <div className="flex items-center gap-1 text-xs">
    <span className="text-muted-foreground">{icon}</span>
    <span className="text-muted-foreground">{label}:</span>
    <span className="font-medium text-foreground">{value}</span>
  </div>
);

interface BacktestHudProps {
  className?: string;
}

export const BacktestHud: React.FC<BacktestHudProps> = ({ className }) => {
  const state = useBroadcastChannel(CHANNEL_NAME);
  const { currentCash: rewardCash } = useAtomValue(playerProgressAtom);

  // Show placeholder with "-" values if no data received yet
  if (!state) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-1.5",
          "bg-background/95 backdrop-blur-sm",
          "border border-border rounded-md shadow-sm",
          "text-sm font-mono",
          className,
        )}
      >
        <Badge variant="secondary" className="gap-1">
          <ActivityIcon size={12} />
          Ready
        </Badge>

        <HudItem icon={<ClockIcon size={12} />} label="Time" value="-" />
        <HudItem
          icon={<BarChart3Icon size={12} />}
          label="Progress"
          value="-"
        />
        <HudItem icon={<TrendingUpIcon size={12} />} label="Equity" value="-" />
        <HudItem icon={<WalletIcon size={12} />} label="Cash" value="-" />
        <HudItem icon={<ActivityIcon size={12} />} label="Position" value="-" />
        <HudItem icon={<ActivityIcon size={12} />} label="Trades" value="-" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-1.5",
        "bg-background/95 backdrop-blur-sm",
        "border border-border rounded-md shadow-sm",
        "text-sm font-mono",
        className,
      )}
    >
      <Badge
        variant={(state.status_variant as BadgeProps["variant"]) || "secondary"}
        className="gap-1"
      >
        <ActivityIcon size={12} />
        {state.status_label || "Backtest"}
      </Badge>

      <HudItem
        icon={<ClockIcon size={12} />}
        label="Time"
        value={state.current_time || "-"}
      />

      <HudItem
        icon={<BarChart3Icon size={12} />}
        label="Progress"
        value={formatProgress(state.progress)}
      />

      <HudItem
        icon={<TrendingUpIcon size={12} />}
        label="Equity"
        value={formatYen(state.equity + rewardCash)}
      />

      <HudItem
        icon={<WalletIcon size={12} />}
        label="Cash"
        value={formatYen(state.cash + rewardCash)}
      />

      <HudItem
        icon={<ActivityIcon size={12} />}
        label="Position"
        value={`${state.position} shares`}
      />

      <HudItem
        icon={<ActivityIcon size={12} />}
        label="Trades"
        value={`${state.closed_trades}`}
      />
    </div>
  );
};
