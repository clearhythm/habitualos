# Discovery Pipeline — Known Bugs & Fixes

## Bug: Review action context arrives as actionContext instead of reviewContext

**Status:** Fixed (backend workaround)

**Symptom:** When clicking a review action, the agent knows it's a review (from open actions list) but doesn't have the actual draft data. Agent says "I don't see the actual company details attached yet."

**Root cause:** The review action goes through the general action modal path (`showActionModal` → Chat button → `actionChatContext` sessionStorage → `currentMeasurementActionContext`), which sends it as `actionContext` on the API request. The `openReviewChat` path that sends `reviewContext` is not triggered — likely `isReviewAction()` returns false, possibly due to a missing `agentId` on the action object from the list endpoint.

**Server evidence:** Log shows `[agent-chat] Added action context for: action-xxx (review)` but NOT `[agent-chat] Review context: found X pending drafts`. This confirms `actionContext` was set but `reviewContext` was null.

**Fix applied (commit ed1717d):** Backend now detects `actionContext.taskType === 'review'` and promotes it to review context:
```javascript
const reviewContext = rawReviewContext || (actionContext?.taskType === 'review' ? actionContext : null);
```

**Remaining investigation:** Why does `isReviewAction()` return false on the frontend? The function checks `action.taskType === 'review' && !isCompleted && action.agentId`. Need to verify the action list endpoint returns `agentId` on review actions. Low priority since the backend workaround handles both paths.
