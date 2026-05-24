/**
 * Chat streaming edge function for dreamscape.
 * Uses shared core from packages/edge-functions.
 */
import { createChatStreamHandler } from "./_lib/chat-stream-core.ts";

export default createChatStreamHandler({
  "reflect": {
    initEndpoint: "/api/reflect-chat-init",
    toolExecuteEndpoint: "/api/reflect-tool-execute",
    signalPatterns: [],
  },
});

export const config = {
  path: "/api/chat-stream",
};
