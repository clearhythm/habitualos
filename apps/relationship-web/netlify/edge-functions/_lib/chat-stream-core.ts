/**
 * Shared chat streaming core for HabitualOS apps.
 * Each app imports this and configures its chat types.
 * Uses raw fetch() to the Anthropic API instead of the SDK
 * for maximum compatibility with Netlify Edge Functions.
 */

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface RequestBody {
  userId: string;
  message: string;
  chatHistory: ChatMessage[];
  chatType?: string;
  // Agent-specific params
  agentId?: string;
  actionContext?: Record<string, unknown> | null;
  reviewContext?: Record<string, unknown> | null;
  // General params
  timezone?: string;
  userName?: string;
}

export interface ChatTypeConfig {
  initEndpoint: string;
  toolExecuteEndpoint: string | null;
  signalPatterns: RegExp[];
}

// ============================================================================
// Signal Parsing
// ============================================================================

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

// ============================================================================
// Anthropic API (raw fetch, no SDK)
// ============================================================================

interface AnthropicStreamEvent {
  type: string;
  index?: number;
  delta?: { type: string; text?: string; partial_json?: string; stop_reason?: string };
  content_block?: { type: string; id?: string; name?: string; text?: string; input?: string };
  message?: { content: ContentBlock[]; stop_reason: string };
}

async function* streamAnthropicMessages(
  apiKey: string,
  params: {
    model: string;
    max_tokens: number;
    system: unknown;
    messages: unknown[];
    tools?: unknown[];
  }
): AsyncGenerator<AnthropicStreamEvent> {
  const body: Record<string, unknown> = {
    model: params.model,
    max_tokens: params.max_tokens,
    system: params.system,
    messages: params.messages,
    stream: true,
  };
  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorText}`);
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        try {
          yield JSON.parse(data);
        } catch {
          // Skip unparseable lines
        }
      }
    }
  }
}

// ============================================================================
// Handler Factory
// ============================================================================

/**
 * Creates a chat stream handler with the given chat type configurations.
 * Each app calls this with its specific chat types.
 */
export function createChatStreamHandler(
  chatTypeConfigs: Record<string, ChatTypeConfig>
): (req: Request) => Promise<Response> {
  return async function handler(req: Request): Promise<Response> {
    // Only allow POST
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    const {
      chatType = Object.keys(chatTypeConfigs)[0], // Default to first configured type
      userId,
      message,
      chatHistory,
      // Agent-specific
      agentId,
      actionContext,
      reviewContext,
      // General
      timezone,
      userName,
    } = body;

    // Get chat type configuration
    const config = chatTypeConfigs[chatType];
    if (!config) {
      return new Response(
        JSON.stringify({ error: `Invalid chatType: ${chatType}. Available: ${Object.keys(chatTypeConfigs).join(", ")}` }),
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
    } else {
      // For other chat types (fox-ea, obi-wai, rely, etc.)
      initBody = { userId, timezone, userName };
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

    // Get API key
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();

    // Build conversation messages
    let messages: ChatMessage[] = chatHistory.map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    }));

    // Add current user message
    messages.push({ role: "user", content: message });

    // Create SSE stream using TransformStream for reliable streaming on edge
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    const send = async (data: Record<string, unknown>) => {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    };

    // Run the streaming logic in the background
    (async () => {
      try {
        console.log("[chat-stream] Stream started, calling Anthropic API...");

        let continueLoop = true;
        let loopCount = 0;
        const maxLoops = 5; // Prevent infinite loops

        while (continueLoop && loopCount < maxLoops) {
          loopCount++;

          // Stream Claude's response via raw fetch
          console.log("[chat-stream] Loop", loopCount, "- calling Anthropic API");
          const eventStream = streamAnthropicMessages(apiKey, {
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 2048,
            system: systemMessages,
            messages: messages,
            tools: tools && tools.length > 0 ? tools : undefined,
          });

          let fullText = "";
          const contentBlocks: ContentBlock[] = [];
          let currentBlockIndex = -1;
          let currentToolInput = "";
          let stopReason = "";

          for await (const event of eventStream) {
            if (event.type === "content_block_start" && event.content_block) {
              currentBlockIndex = event.index ?? currentBlockIndex + 1;
              const block = event.content_block;
              if (block.type === "tool_use") {
                contentBlocks.push({
                  type: "tool_use",
                  id: block.id,
                  name: block.name,
                  input: {},
                });
                currentToolInput = "";
              } else {
                contentBlocks.push({ type: "text", text: "" });
              }
            } else if (event.type === "content_block_delta" && event.delta) {
              if (event.delta.type === "text_delta" && event.delta.text) {
                await send({ type: "token", text: event.delta.text });
                fullText += event.delta.text;
                // Update the text block
                const block = contentBlocks[event.index ?? currentBlockIndex];
                if (block) {
                  block.text = (block.text || "") + event.delta.text;
                }
              } else if (event.delta.type === "input_json_delta" && event.delta.partial_json) {
                currentToolInput += event.delta.partial_json;
              }
            } else if (event.type === "content_block_stop") {
              // Parse accumulated tool input JSON
              const block = contentBlocks[event.index ?? currentBlockIndex];
              if (block && block.type === "tool_use" && currentToolInput) {
                try {
                  block.input = JSON.parse(currentToolInput);
                } catch {
                  block.input = {};
                }
                currentToolInput = "";
              }
            } else if (event.type === "message_delta" && event.delta) {
              stopReason = event.delta.stop_reason || "";
            }
          }

          // Check for tool use
          const toolUseBlock = contentBlocks.find(
            (b) => b.type === "tool_use"
          ) as ToolUseBlock | undefined;

          if (toolUseBlock && stopReason === "tool_use" && config.toolExecuteEndpoint) {
            await send({ type: "tool_start", tool: toolUseBlock.name });

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

            await send({ type: "tool_complete", tool: toolUseBlock.name });

            // Add assistant's response to messages
            messages.push({
              role: "assistant",
              content: contentBlocks,
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

            await send({
              type: "done",
              fullResponse: fullText,
              signal: signal,
              hasSignal: signal !== null,
            });
          }
        }

        await writer.close();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error occurred";
        console.error("[chat-stream] Error:", errorMsg);
        try {
          await send({ type: "error", error: errorMsg });
        } catch (sendErr) {
          console.error("[chat-stream] Failed to send error event:", sendErr);
        }
        try {
          await writer.close();
        } catch {
          // Writer may already be closed
        }
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  };
}
