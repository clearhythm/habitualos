# Deployment Guide

## Local Development

### Prerequisites
- Node.js (v16+)
- npm
- Git

### Setup

1. **Clone repository:**
```bash
git clone <repo-url>
cd habitualos
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment variables:**
Create `.env` file in project root:
```bash
ANTHROPIC_API_KEY=sk-ant-...
FIREBASE_ADMIN_CREDENTIALS='{"type":"service_account",...}'
```

4. **Start development server:**
```bash
npm start
```

This runs in parallel:
- **Sass** - Compiles SCSS to CSS (watch mode)
- **Eleventy** - Builds and serves static site (watch mode)
- **Netlify Dev** - Runs serverless functions locally
- **Scheduler** - Cron-based task execution (development)

### Development URLs
- **Frontend**: `http://localhost:8080`
- **Functions**: `http://localhost:8888/.netlify/functions/`

### Available Scripts

```bash
npm run dev          # Start Eleventy dev server only
npm run build        # Build static site for production
npm run serve        # Serve built site (no rebuild)
npm run sass:dev     # Compile Sass (watch mode)
npm run scheduler    # Run task scheduler
```

## Production Deployment (Netlify)

### Deployment Method
**Git-based automatic deploys:**
- Push to `main` branch triggers deployment
- Build command: `npm run build`
- Publish directory: `_site/`

### Environment Variables

Configure in Netlify dashboard or via CLI:

**Required:**
- `ANTHROPIC_API_KEY` - Claude API key from Anthropic
- `FIREBASE_ADMIN_CREDENTIALS` - JSON service account key

**Format for FIREBASE_ADMIN_CREDENTIALS:**
```json
{
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "...",
  "client_id": "...",
  "auth_uri": "...",
  "token_uri": "...",
  "auth_provider_x509_cert_url": "...",
  "client_x509_cert_url": "..."
}
```

### Build Configuration

**netlify.toml:**
```toml
[build]
  command = "npm run build"
  publish = "_site"
  functions = "netlify/functions"

[build.environment]
  NODE_VERSION = "16"
```

### Functions Deployment

Netlify automatically deploys functions from:
- Source: `netlify/functions/*.js`
- Endpoint pattern: `/.netlify/functions/{filename}`

**Examples:**
- `netlify/functions/agent-chat.js` → `https://yoursite.com/.netlify/functions/agent-chat`
- `netlify/functions/action-define.js` → `https://yoursite.com/.netlify/functions/action-define`

### Static Assets

**CDN Delivery:**
- All files in `_site/` served from Netlify's global CDN
- Automatic HTTPS
- Cache headers respected from build

**Asset structure:**
```
_site/
├── index.html
├── do/
│   ├── index.html
│   └── agent.html
├── practice/
│   ├── index.html
│   ├── log.html
│   └── chat.html
└── assets/
    ├── css/
    ├── js/
    └── images/
```

## Firestore Database

### Setup

1. Create Firebase project at https://console.firebase.google.com
2. Enable Firestore Database
3. Generate service account key:
   - Project Settings → Service Accounts
   - Generate new private key (JSON)
4. Add JSON content to `FIREBASE_ADMIN_CREDENTIALS` environment variable

### Collections

Created automatically on first use:
- `agents`
- `actions`
- `assets`
- `agent_creation_chats`
- `agent_chats`
- `task_outputs`
- `practice-logs`
- `practices`
- `practice-chats`

### Security Rules

**Current:** None (single-user prototype)

**Future production rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{collection}/{document} {
      allow read, write: if request.auth != null
        && resource.data._userId == request.auth.uid;
    }
  }
}
```

## Deployment Checklist

### First Deployment

- [ ] Create Netlify site
- [ ] Configure environment variables
- [ ] Set up Firebase project
- [ ] Configure custom domain (optional)
- [ ] Test functions endpoint accessibility
- [ ] Verify Firestore connection
- [ ] Test end-to-end agent creation flow

### Regular Deployments

- [ ] Test locally first (`npm start`)
- [ ] Commit changes with descriptive message
- [ ] Push to `main` branch
- [ ] Monitor Netlify deploy logs
- [ ] Verify deployment success
- [ ] Smoke test critical flows

## Troubleshooting

### Build Failures

**"Module not found":**
- Run `npm install` locally
- Check `package.json` for missing dependencies
- Clear Netlify build cache if persists

**Sass compilation errors:**
- Check SCSS syntax
- Verify `@import` paths
- Ensure all Sass files have `.scss` extension

**Eleventy build errors:**
- Check Nunjucks template syntax
- Verify data file paths
- Look for circular includes

### Function Errors

**"ANTHROPIC_API_KEY is not defined":**
- Check environment variables in Netlify dashboard
- Verify variable name spelling
- Redeploy after adding variables

**"Cannot connect to Firestore":**
- Verify FIREBASE_ADMIN_CREDENTIALS format (valid JSON)
- Check Firebase project permissions
- Ensure service account has Firestore access

**Timeout errors:**
- Function timeout is 10 seconds (default)
- Check for slow LLM calls
- Consider background functions for long tasks

### Runtime Issues

**User ID not persisting:**
- Check localStorage availability
- Verify sessionStorage fallback working
- Clear browser cache and test

**CORS errors:**
- Netlify functions should not have CORS issues (same origin)
- If using custom domain, verify configuration
- Check browser console for specific error

## Performance Optimization

### Caching

**Static assets:**
- Netlify CDN automatically caches
- Cache-Control headers from build process
- Invalidate on deploy

**Prompt caching:**
- System prompts cached with `ephemeral` cache_control
- 5-minute cache window
- ~90% cost reduction for subsequent calls

### Function Cold Starts

**Mitigations:**
- Keep functions small and focused
- Minimize dependencies
- Consider keeping one warm with pings (if needed)

## Monitoring

### Netlify Dashboard
- Deploy logs
- Function logs (real-time)
- Bandwidth usage
- Build minutes

### Firestore Console
- Query performance
- Document counts
- Index usage
- Security rule evaluation

### Claude API Dashboard
- Token usage
- Cost tracking
- Cache hit rates
- Error rates

## Backup and Recovery

**Database backups:**
- Firebase automatic backups (if enabled)
- Export Firestore data periodically
- Consider scheduled Cloud Functions for backups

**Code backups:**
- Git repository is source of truth
- Tag releases for easy rollback
- Keep production branch protected

## Security Considerations

- Never commit `.env` file
- Rotate API keys periodically
- Monitor function logs for suspicious activity
- Keep dependencies updated (`npm audit`)
- Use HTTPS only (Netlify enforces this)
