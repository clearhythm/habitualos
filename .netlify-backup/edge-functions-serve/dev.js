import { boot } from "https://v2-11-1--edge.netlify.com/bootstrap/index-combined.ts";

const functions = {}; const metadata = { functions: {} };


      try {
        const { default: func } = await import("file:///Users/erik/Sites/habitualos/netlify/edge-functions/agent-chat-stream.ts");

        if (typeof func === "function") {
          functions["agent-chat-stream"] = func;
          metadata.functions["agent-chat-stream"] = {"url":"file:///Users/erik/Sites/habitualos/netlify/edge-functions/agent-chat-stream.ts"}
        } else {
          console.log("\u001b[91m◈\u001b[39m \u001b[31mFailed\u001b[39m to load Edge Function \u001b[33magent-chat-stream\u001b[39m. The file does not seem to have a function as the default export.");
        }
      } catch (error) {
        console.log("\u001b[91m◈\u001b[39m \u001b[31mFailed\u001b[39m to run Edge Function \u001b[33magent-chat-stream\u001b[39m:");
        console.error(error);
      }
      


      try {
        const { default: func } = await import("file:///Users/erik/Sites/habitualos/netlify/edge-functions/chat-stream.ts");

        if (typeof func === "function") {
          functions["chat-stream"] = func;
          metadata.functions["chat-stream"] = {"url":"file:///Users/erik/Sites/habitualos/netlify/edge-functions/chat-stream.ts"}
        } else {
          console.log("\u001b[91m◈\u001b[39m \u001b[31mFailed\u001b[39m to load Edge Function \u001b[33mchat-stream\u001b[39m. The file does not seem to have a function as the default export.");
        }
      } catch (error) {
        console.log("\u001b[91m◈\u001b[39m \u001b[31mFailed\u001b[39m to run Edge Function \u001b[33mchat-stream\u001b[39m:");
        console.error(error);
      }
      

boot(functions, metadata);