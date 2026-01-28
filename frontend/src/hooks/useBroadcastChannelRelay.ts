/* Copyright 2026 Marimo. All rights reserved. */

import { useEffect } from "react";
import {
  broadcastChannelManager,
  sendBroadcastMessage,
} from "@/utils/broadcastChannel";

interface MarimoBroadcastMessage {
  __marimo_broadcast__: true;
  channel: string;
  type: string;
  data: unknown;
}

function isMarimoBroadcastMessage(
  data: unknown,
): data is MarimoBroadcastMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "__marimo_broadcast__" in data &&
    (data as MarimoBroadcastMessage).__marimo_broadcast__ === true &&
    "channel" in data &&
    typeof (data as MarimoBroadcastMessage).channel === "string"
  );
}

/**
 * Hook to relay broadcast messages to BroadcastChannel.
 *
 * Primary method: marimo-broadcast elements are handled by RenderHTML.tsx
 * during HTML parsing, which calls sendBroadcastMessage().
 *
 * Fallback method: postMessage from iframes (for Pyodide mode with srcdoc)
 * is handled by this hook's message listener.
 */
export function useBroadcastChannelRelay(): void {
  useEffect(() => {
    // Fallback: postMessage handler (for Pyodide mode)
    const handleMessage = (event: MessageEvent) => {
      if (!isMarimoBroadcastMessage(event.data)) {
        return;
      }

      const { channel: channelName, type, data } = event.data;

      const channel = broadcastChannelManager.getOrCreate(channelName);
      channel.postMessage({ type, data });
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
      broadcastChannelManager.closeAll();
    };
  }, []);
}

// Re-export for convenience
export { sendBroadcastMessage };
