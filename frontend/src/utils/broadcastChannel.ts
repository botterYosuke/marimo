/* Copyright 2026 Marimo. All rights reserved. */

interface CachedMessage {
  type: string;
  data: unknown;
}

/**
 * Singleton manager for BroadcastChannel instances.
 * Ensures only one channel per name is created and reused.
 * Caches last message per channel+type for late-mounting listeners.
 */
class BroadcastChannelManager {
  private channels = new Map<string, BroadcastChannel>();
  // channel → Map<type, message>
  private lastMessages = new Map<string, Map<string, CachedMessage>>();

  getOrCreate(channelName: string): BroadcastChannel {
    let channel = this.channels.get(channelName);
    if (!channel) {
      channel = new BroadcastChannel(channelName);
      this.channels.set(channelName, channel);
    }
    return channel;
  }

  /**
   * Cache the latest message for a given channel and type.
   * Overwrites any previous message with the same channel+type.
   */
  cacheMessage(channelName: string, type: string, data: unknown): void {
    let typeMap = this.lastMessages.get(channelName);
    if (!typeMap) {
      typeMap = new Map();
      this.lastMessages.set(channelName, typeMap);
    }
    typeMap.set(type, { type, data });
  }

  /**
   * Get all cached messages for a channel and clear them (consume).
   * Returns an array of messages in insertion order.
   */
  consumeMessages(channelName: string): CachedMessage[] {
    const typeMap = this.lastMessages.get(channelName);
    if (!typeMap) {
      return [];
    }
    const messages = Array.from(typeMap.values());
    this.lastMessages.delete(channelName);
    return messages;
  }

  closeAll(): void {
    for (const ch of this.channels.values()) {
      ch.close();
    }
    this.channels.clear();
    this.lastMessages.clear();
  }
}

export const broadcastChannelManager = new BroadcastChannelManager();

/**
 * Process a marimo-broadcast element's attributes and send to BroadcastChannel.
 * Also caches the message for late-mounting listeners (reconnection scenario).
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
    // Cache for late-mounting listeners
    broadcastChannelManager.cacheMessage(channelName, type, data);
    return true;
  } catch {
    return false;
  }
}

/**
 * Replay all cached messages for a channel through the given handler.
 * Consumes (clears) the cached messages after replaying.
 *
 * @param channelName - The channel to replay messages from
 * @param handler - Handler function that receives MessageEvent-like objects
 */
export function replayBufferedMessages(
  channelName: string,
  handler: (event: MessageEvent) => void,
): void {
  const messages = broadcastChannelManager.consumeMessages(channelName);
  for (const msg of messages) {
    // Create a minimal MessageEvent-like object for the handler
    handler({ data: msg } as MessageEvent);
  }
}
