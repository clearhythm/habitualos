/**
 * Chat streaming edge function for obi-wai-web.
 * Uses shared core from packages/edge-functions.
 */

import { createChatStreamHandler } from "./_lib/chat-stream-core.ts";

export default createChatStreamHandler({
  "obi-wai": {
    initEndpoint: "/api/obi-wai-chat-init",
    toolExecuteEndpoint: "/api/practice-tool-execute",
    signalPatterns: [/^READY_TO_PRACTICE\s*\n---/m, /^STORE_MEASUREMENT\s*\n---/m],
  },
});

export const config = {
  path: "/api/chat-stream",
};
