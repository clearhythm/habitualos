/**
 * Chat streaming edge function for habitual-web.
 * Uses shared core from packages/edge-functions.
 */

import { createChatStreamHandler } from "./_lib/chat-stream-core.ts";

// Configure chat types for this app
export default createChatStreamHandler({
  agent: {
    initEndpoint: "/api/agent-chat-init",
    toolExecuteEndpoint: "/api/agent-tool-execute",
    signalPatterns: [],
  },
  "fox-ea": {
    initEndpoint: "/api/fox-ea-chat-init",
    toolExecuteEndpoint: "/api/fox-ea-tool-execute",
    signalPatterns: [], // No signals - tools return results directly
  },
});

export const config = {
  path: "/api/chat-stream",
};
