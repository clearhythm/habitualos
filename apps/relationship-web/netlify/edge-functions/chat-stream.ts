/**
 * Chat streaming edge function for relationship-web.
 * Uses shared core from packages/edge-functions.
 */

import { createChatStreamHandler } from "./chat-stream-core.ts";

// Configure chat types for this app
export default createChatStreamHandler({
  rely: {
    initEndpoint: "/api/rely-chat-init",
    toolExecuteEndpoint: null, // No tools - signal-based like Obi-Wai
    signalPatterns: [/^SAVE_MOMENT\s*\n---/m],
  },
});

export const config = {
  path: "/api/chat-stream",
};
