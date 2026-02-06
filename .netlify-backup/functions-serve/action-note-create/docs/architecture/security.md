# Security Model

## Authentication

**Current:** Client-side user ID generation (no traditional auth)
- User IDs generated on first visit: `u-{timestamp}-{random}`
- Stored in localStorage with sessionStorage fallback
- Persisted across sessions
- No passwords, no signup flow

**Format:**
```javascript
const userId = `u-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
localStorage.setItem('userId', userId);
```

**Limitations:**
- No cross-device sync
- No account recovery
- Lost localStorage = lost data
- Anyone with userId can access that user's data

**Future:** Netlify Identity or similar auth system planned

## Authorization

### Database Queries
All Firestore queries filtered by `_userId`:

```javascript
// Get user's agents
const snapshot = await db.collection('agents')
  .where('_userId', '==', userId)
  .get();

// Get specific agent (verify ownership)
const agent = await getAgent(agentId);
if (!agent || agent._userId !== userId) {
  return { statusCode: 404, error: 'Not found' };
}
```

### Access Patterns

**Agent Access:**
- Users can only see/modify their own agents
- agentId checked against _userId before operations

**Action Access:**
- Actions verified through agent ownership
- First check agent exists and user owns it
- Then check action belongs to that agent

**Asset Access:**
- Similar to actions - verified through agent ownership

## Input Validation

### User IDs
```javascript
if (!userId || typeof userId !== 'string' || !userId.startsWith('u-')) {
  return { statusCode: 400, error: 'Valid userId required' };
}
```

### Required Fields
```javascript
if (!agentId || !title || !description) {
  return { statusCode: 400, error: 'Missing required fields' };
}
```

### Data Types
- Validate field types before DB operations
- Use TypeScript-style validation where needed
- Reject malformed JSON in request bodies

## File Operations Security

**Restricted Directory:**
- All file writes restricted to `data/tasks/` only
- Path traversal attempts blocked

**UUID Validation:**
- Task IDs validated as UUIDs
- Prevents `../../etc/passwd` style attacks

**Filename Sanitization:**
```javascript
// Remove special characters
const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
```

**Access Patterns:**
- Inputs: Read-only
- Outputs: Write-only
- No execution of uploaded files

## XSS Prevention

### Output Escaping
```javascript
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
```

### User Content
- All user-provided content escaped before rendering
- No `innerHTML` with user data
- Use `textContent` or escaped template strings

## Command Injection Prevention

**No Shell Execution:**
- No `exec()`, `spawn()`, or similar with user input
- All LLM interactions through SDK only
- No dynamic code evaluation

## API Security

### Rate Limiting
**Current:** None (single-user prototype)
**Future:** Implement rate limiting per userId

### CORS
**Current:** Not configured (same-origin only)
**Future:** Configure for production domain

### API Keys
- `ANTHROPIC_API_KEY` in environment variables only
- Never exposed to client
- Never logged

## Data Privacy

### Firestore Security Rules
```javascript
// Conceptual (not yet implemented)
match /agents/{agentId} {
  allow read, write: if request.auth.uid == resource.data._userId;
}
```

### PII Handling
- No sensitive PII collected currently
- User content (goals, actions) stored in plaintext
- Consider encryption for future multi-user deployment

## Known Limitations

1. **No authentication** - Anyone with userId can access data
2. **No rate limiting** - Potential for abuse
3. **No HTTPS enforcement** - Relies on Netlify's HTTPS
4. **No audit logging** - No tracking of who did what when
5. **No data encryption** - All data plaintext in Firestore
6. **Client-side userId** - Can be manipulated

## Security Best Practices

**When adding endpoints:**
1. Validate userId format
2. Verify resource ownership
3. Sanitize all inputs
4. Escape all outputs
5. Use parameterized queries (Firestore SDK handles this)
6. Never trust client data
7. Return generic errors (don't leak system info)

**When adding features:**
1. Consider authorization implications
2. Test with malicious inputs
3. Review for injection vulnerabilities
4. Check file operation safety
5. Validate all external data
