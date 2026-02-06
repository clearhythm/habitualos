import Anthropic from "@anthropic-ai/sdk";

interface ChatMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface RequestBody {
  userId: string;
  message: string;
  chatHistory: ChatMessage[];
  chatType?: "agent" | "fox-ea" | "obi-wai";
  // Agent-specific params
  agentId?: string;
  actionContext?: Record<string, unknown> | null;
  reviewContext?: Record<string, unknown> | null;
  // Fox-EA and Obi-Wai params
  timezone?: string;
}

interface ChatTypeConfig {
  initEndpoint: string;
  toolExecuteEndpoint: string | null;
  signalPatterns: RegExp[];
}

// Chat type configuration - routes to appropriate init and tool endpoints
const CHAT_TYPE_CONFIG: Record<string, ChatTypeConfig> = {
  agent: {
    initEndpoint: "/api/agent-chat-init",
    toolExecuteEndpoint: "/api/agent-tool-execute",
    signalPatterns: [
      /^GENERATE_ACTIONS\s*\n---/m,
      /^GENERATE_ASSET\s*\n---/m,
      /^STORE_MEASUREMENT\s*\n---/m,
    ],
  },
  "fox-ea": {
    initEndpoint: "/api/fox-ea-chat-init",
    toolExecuteEndpoint: "/api/fox-ea-tool-execute",
    signalPatterns: [], // No signals - tools return results directly
  },
  "obi-wai": {
    initEndpoint: "/api/obi-wai-chat-init",
    toolExecuteEndpoint: null, // No tools
    signalPatterns: [/^READY_TO_PRACTICE\s*\n---/m],
  },
};

function hasSignal(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text.trim()));
}

function parseSignal(
  text: string,
  patterns: RegExp[]
): { type: string; data: Record<string, unknown> } | null {
  const trimmed = text.trim();

  for (const pattern of patterns) {
    if (pattern.test(trimmed)) {
      // Extract signal type from pattern (e.g., "GENERATE_ACTIONS" from /^GENERATE_ACTIONS/)
      const signalTypeMatch = pattern.source.match(/\^(\w+)/);
      const type = signalTypeMatch ? signalTypeMatch[1] : "UNKNOWN";

      // Find JSON object
      const lines = text.split("\n");
      let jsonStart = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith("{")) {
          jsonStart = i;
          break;
        }
      }

      if (jsonStart === -1) {
        return { type, data: { error: "No JSON found" } };
      }

      // Find end of JSON
      let jsonEnd = jsonStart;
      let braceCount = 0;
      for (let i = jsonStart; i < lines.length; i++) {
        for (const char of lines[i]) {
          if (char === "{") braceCount++;
          if (char === "}") braceCount--;
        }
        if (braceCount === 0 && lines[i].includes("}")) {
          jsonEnd = i;
          break;
        }
      }

      const jsonContent = lines.slice(jsonStart, jsonEnd + 1).join("\n");
      try {
        const data = JSON.parse(jsonContent);
        return { type, data };
      } catch {
        return { type, data: { error: "Invalid JSON", raw: jsonContent } };
      }
    }
  }

  return null;
}

export default async function handler(req: Request): Promise<Response> {
  // Only allow POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body: RequestBody = await req.json();
  const {
    chatType = "agent",
    userId,
    message,
    chatHistory,
    // Agent-specific
    agentId,
    actionContext,
    reviewContext,
    // Fox-EA / Obi-Wai specific
    timezone,
  } = body;

  // Get chat type configuration
  const config = CHAT_TYPE_CONFIG[chatType];
  if (!config) {
    return new Response(
      JSON.stringify({ error: `Invalid chatType: ${chatType}` }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Validate inputs
  if (!userId || !userId.startsWith("u-")) {
    return new Response(JSON.stringify({ error: "Valid userId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "message is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Agent type requires agentId
  if (chatType === "agent" && !agentId) {
    return new Response(JSON.stringify({ error: "agentId is required for agent chat" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get base URL for internal API calls
  const url = new URL(req.url);
  const baseUrl = `${url.protocol}//${url.host}`;

  // Build init request body based on chat type
  let initBody: Record<string, unknown> = { userId };
  if (chatType === "agent") {
    initBody = { userId, agentId, actionContext, reviewContext };
  } else if (chatType === "fox-ea" || chatType === "obi-wai") {
    initBody = { userId, timezone };
  }

  // Initialize chat session - get system prompt and tools from Node.js function
  const initResponse = await fetch(`${baseUrl}${config.initEndpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(initBody),
  });

  if (!initResponse.ok) {
    const error = await initResponse.json();
    return new Response(JSON.stringify(error), {
      status: initResponse.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const initData = await initResponse.json();
  const { systemMessages, tools } = initData;

  // Create Anthropic client
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "API key not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const client = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  // Build conversation messages
  let messages: ChatMessage[] = chatHistory.map((msg) => ({
    role: msg.role === "assistant" ? "assistant" : "user",
    content: msg.content,
  }));

  // Add current user message
  messages.push({ role: "user", content: message });

  // Create SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        let continueLoop = true;
        let loopCount = 0;
        const maxLoops = 5; // Prevent infinite loops

        while (continueLoop && loopCount < maxLoops) {
          loopCount++;

          // Stream Claude's response
          const response = client.messages.stream({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 2048,
            system: systemMessages,
            messages: messages as Anthropic.MessageParam[],
            tools: tools && tools.length > 0 ? tools : undefined,
          });

          let fullText = "";
          const contentBlocks: ContentBlock[] = [];

          // Stream text tokens
          for await (const event of response) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              send({ type: "token", text: event.delta.text });
              fullText += event.delta.text;
            }
          }

          // Get final message
          const finalMessage = await response.finalMessage();

          // Collect all content blocks
          for (const block of finalMessage.content) {
            contentBlocks.push(block as ContentBlock);
          }

          // Check for tool use
          const toolUseBlock = contentBlocks.find(
            (b) => b.type === "tool_use"
          ) as ToolUseBlock | undefined;

          if (toolUseBlock && finalMessage.stop_reason === "tool_use" && config.toolExecuteEndpoint) {
            send({ type: "tool_start", tool: toolUseBlock.name });

            // Build tool execute request body
            let toolBody: Record<string, unknown> = {
              userId,
              toolUse: {
                id: toolUseBlock.id,
                name: toolUseBlock.name,
                input: toolUseBlock.input,
              },
            };
            if (chatType === "agent") {
              toolBody.agentId = agentId;
            }

            // Execute tool via Node.js function
            const toolResponse = await fetch(
              `${baseUrl}${config.toolExecuteEndpoint}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(toolBody),
              }
            );

            const toolData = await toolResponse.json();
            const toolResult = toolData.result || { error: "Tool execution failed" };

            send({ type: "tool_complete", tool: toolUseBlock.name });

            // Add assistant's response to messages
            messages.push({
              role: "assistant",
              content: finalMessage.content as ContentBlock[],
            });

            // Add tool result to messages
            messages.push({
              role: "user",
              content: [
                {
                  type: "tool_result",
                  tool_use_id: toolUseBlock.id,
                  content: JSON.stringify(toolResult),
                },
              ] as unknown as string,
            });

            // Continue loop to get next response
          } else {
            // No tool use - check for signals and complete
            continueLoop = false;

            const signal = config.signalPatterns.length > 0
              ? parseSignal(fullText, config.signalPatterns)
              : null;

            send({
              type: "done",
              fullResponse: fullText,
              signal: signal,
              hasSignal: signal !== null,
            });
          }
        }

        controller.close();
      } catch (error) {
        console.error("[chat-stream] Error:", error);
        send({
          type: "error",
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export const config = {
  path: "/api/chat-stream",
};
