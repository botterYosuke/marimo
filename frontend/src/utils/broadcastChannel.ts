/* Copyright 2026 Marimo. All rights reserved. */

/**
 * Singleton manager for BroadcastChannel instances.
 * Ensures only one channel per name is created and reused.
 */
class BroadcastChannelManager {
  private channels = new Map<string, BroadcastChannel>();

  getOrCreate(channelName: string): BroadcastChannel {
    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = new BroadcastChannel(channelName);
      this.channels.set(channelName, channel);
    }
    return channel;
  }

  closeAll(): void {
    for (const ch of this.channels.values()) {
      ch.close();
    }
    this.channels.clear();
  }
}

export const broadcastChannelManager = new BroadcastChannelManager();

/**
 * Process a marimo-broadcast element's attributes and send to BroadcastChannel.
 * Returns true if the message was sent successfully.
 */
export function sendBroadcastMessage(
  channelName: string,
  type: string,
  payload: string,
): boolean {
  try {
    const data = JSON.parse(atob(payload));
    const channel = broadcastChannelManager.getOrCreate(channelName);
    channel.postMessage({ type, data });
    return true;
  } catch {
    return false;
  }
}
