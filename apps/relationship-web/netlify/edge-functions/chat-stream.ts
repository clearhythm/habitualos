/**
 * Chat streaming edge function for relationship-web.
 * Uses shared core from packages/edge-functions.
 */

import { createChatStreamHandler } from "./_lib/chat-stream-core.ts";

// Configure chat types for this app
export default createChatStreamHandler({
  rely: {
    initEndpoint: "/api/rely-chat-init",
    toolExecuteEndpoint: null, // No tools - signal-based like Obi-Wai
    signalPatterns: [/^SAVE_MOMENT\s*\n---/m, /^STORE_MEASUREMENT\s*\n---/m, /^SEND_REPLY\s*\n---/m],
  },
});

export const config = {
  path: "/api/chat-stream",
};
