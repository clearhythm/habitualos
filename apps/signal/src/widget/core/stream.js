// core/stream.js — client-side SSE reader for fetch responses

/**
 * Read an SSE stream from a fetch response and dispatch events to handlers.
 * @param {Response} res - fetch Response with a readable body
 * @param {{ onToken, onToolComplete, onDone, onError }} handlers
 */
export async function readStream(res, handlers) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;

      let event;
      try { event = JSON.parse(raw); } catch { continue; }

      switch (event.type) {
        case 'token':
          handlers.onToken?.(event.text);
          break;
        case 'tool_complete':
          handlers.onToolComplete?.(event.tool, event.result);
          break;
        case 'done':
          handlers.onDone?.(event.fullResponse);
          break;
        case 'error':
          handlers.onError?.(event.message || 'Stream error');
          break;
      }
    }
  }
}
