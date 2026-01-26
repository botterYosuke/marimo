/* Copyright 2026 Marimo. All rights reserved. */

import { useEffect, useRef, useState } from "react";

export interface BacktestState {
  current_time: string;
  progress: number;
  equity: number;
  cash: number;
  position: number;
  positions: Record<string, number>;
  closed_trades: number;
  step_index: number;
  total_steps: number;
  _timestamp?: number;
}

interface BroadcastMessage {
  type: string;
  data: BacktestState;
}

/**
 * Hook to subscribe to a BroadcastChannel for backtest state updates.
 *
 * @param channelName - The name of the BroadcastChannel to subscribe to
 * @returns The current backtest state, or null if no data received
 */
export function useBroadcastChannel(channelName: string): BacktestState | null {
  const [state, setState] = useState<BacktestState | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    // Create the channel
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    // Handle incoming messages
    channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      try {
        if (!event.data || typeof event.data !== "object") {
          return;
        }
        if (event.data.type !== "backtest_update") {
          return;
        }
        if (!event.data.data) {
          return;
        }

        setState(event.data.data);
      } catch {
        // Silently ignore parse errors
      }
    };

    // Cleanup on unmount
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [channelName]);

  return state;
}
