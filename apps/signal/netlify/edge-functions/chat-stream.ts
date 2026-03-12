/**
 * Chat streaming edge function for signal.
 * Uses shared core from packages/edge-functions.
 */

import { createChatStreamHandler } from "./_lib/chat-stream-core.ts";

export default createChatStreamHandler({
  "signal": {
    initEndpoint: "/api/signal-chat-init",
    toolExecuteEndpoint: "/api/signal-tool-execute",
    signalPatterns: [/^FIT_SCORE_UPDATE\s*\n---/m],
  },
});

export const config = {
  path: "/api/signal-chat-stream",
};
