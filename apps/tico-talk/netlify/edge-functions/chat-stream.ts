/**
 * Chat streaming edge function for tico-talk.
 * Uses shared core (local copy) from ./_lib/chat-stream-core.ts.
 */
import { createChatStreamHandler } from "./_lib/chat-stream-core.ts";

export default createChatStreamHandler({
  "learn": {
    initEndpoint: "/api/learn-chat-init",
    toolExecuteEndpoint: "/api/learn-tool-execute",
    signalPatterns: [],
  },
  "insights": {
    initEndpoint: "/api/insights-chat-init",
    toolExecuteEndpoint: "/api/insights-tool-execute",
    signalPatterns: [],
  },
});

export const config = {
  path: "/api/chat-stream",
};
