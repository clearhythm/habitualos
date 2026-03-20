/**
 * Chat streaming edge function for signal.
 * Uses shared core from packages/edge-functions.
 */

import { createChatStreamHandler } from "./_lib/chat-stream-core.ts";

export default createChatStreamHandler({
  "signal-visitor": {
    initEndpoint: "/api/signal-visitor-init",
    toolExecuteEndpoint: "/api/signal-tool-execute",
    signalPatterns: [/^FIT_SCORE_UPDATE\s*\n---/m],
  },
  "signal-onboard": {
    initEndpoint: "/api/signal-onboard-init",
    toolExecuteEndpoint: "/api/signal-tool-execute",
    signalPatterns: [/^FIT_SCORE_UPDATE\s*\n---/m],
  },
  "signal-owner": {
    initEndpoint: "/api/signal-owner-init",
    toolExecuteEndpoint: "/api/signal-tool-execute",
    signalPatterns: [/^FIT_SCORE_UPDATE\s*\n---/m],
  },
});

export const config = {
  path: "/api/signal-chat-stream",
};
