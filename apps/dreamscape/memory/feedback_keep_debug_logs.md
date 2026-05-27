---
name: feedback_keep_debug_logs
description: Keep debug logs in code — log() utility suppresses them in prod
metadata:
  type: feedback
---

Keep `log('debug', ...)` calls in code. The `log()` utility (client: `utils/log.js`, server: `_utils/log.cjs`) suppresses debug and info output in production. Debug logs are intentionally left in for future diagnostics.

**Why:** They're harmless in prod and valuable for debugging in dev.
**How to apply:** Never strip debug logs as a cleanup step. Leave them where they are.
