# Phase 4: Netlify Deployment

## Objective
Deploy both apps to Netlify as separate sites, each with independent deploys from the same repository.

## Context
In a monorepo, each app becomes a separate Netlify "site" that deploys independently. They share the same repo but have their own:
- Build configuration (from their netlify.toml)
- Environment variables
- Deploy URLs
- Deploy history

## Prerequisites
- Completed Phase 3 (both apps working locally)
- On `monorepo-migration` branch
- Netlify account with access to current HabitualOS site

---

## Part A: Update habitual-web Deployment

### Step 4.1: Push changes to the branch

```bash
git push -u origin monorepo-migration
```

### Step 4.2: Update Netlify site settings for habitual-web

1. Go to Netlify dashboard → your HabitualOS site → **Site configuration**
2. Navigate to **Build & deploy** → **Build settings**
3. Update these settings:

| Setting | Value |
|---------|-------|
| Base directory | (leave empty) |
| **Package directory** | `apps/habitual-web` |
| Build command | (leave as-is, uses netlify.toml) |
| Publish directory | (leave as-is, uses netlify.toml) |
| Functions directory | (leave as-is, uses netlify.toml) |

4. Click **Save**

### Step 4.3: Trigger a test deploy

**Option A: Deploy Preview**
- Create a pull request from `monorepo-migration` to `main`
- Netlify will create a deploy preview
- Test the preview URL

**Option B: Manual Deploy**
- Go to **Deploys** → **Trigger deploy** → **Deploy branch: monorepo-migration**
- Wait for build to complete
- Test the deploy preview URL

### Step 4.4: Verify habitual-web deployment

Test these URLs on the preview deploy:
- `/` - Home page loads
- `/do/` - Agents page loads
- `/api/agents-list?userId=u-mgpqwa49` - Returns JSON
- Agent chat - Works end-to-end

**If deployment fails:**
- Check build logs for import errors
- Common issue: missing dependencies in `apps/habitual-web/package.json`
- Fix, commit, push, and re-deploy

---

## Part B: Create relationship-web Site

### Step 4.5: Create new Netlify site

1. Go to Netlify dashboard → **Add new site** → **Import an existing project**
2. Choose your Git provider and select the `habitualos` repository
3. Configure as follows:

| Setting | Value |
|---------|-------|
| Branch to deploy | `monorepo-migration` (for testing), later `main` |
| Base directory | (leave empty) |
| **Package directory** | `apps/relationship-web` |

4. Click **Deploy**

### Step 4.6: Configure environment variables

Go to **Site configuration** → **Environment variables** and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `FIREBASE_ADMIN_CREDENTIALS` | (copy from habitual-web) | Same Firebase project |
| `ANTHROPIC_API_KEY` | (optional) | Only if using AI features |

### Step 4.7: Wait for initial deploy

The first deploy may take a few minutes. Check the build logs if it fails.

### Step 4.8: Verify relationship-web deployment

Test these URLs:
- `/` - Home page with moment form
- `/api/moments-list?userId=u-test123` - Returns JSON
- Add a moment via the form
- Verify it persists

---

## Part C: Merge to Main

Once both sites are working:

### Step 4.9: Merge the PR

```bash
git checkout main
git merge monorepo-migration
git push origin main
```

### Step 4.10: Update branch settings

For both Netlify sites:
1. Go to **Site configuration** → **Build & deploy** → **Branches and deploy contexts**
2. Set **Production branch** to `main`
3. Enable **Deploy Previews** for pull requests (recommended)

---

## Deployment Architecture

After completing this phase:

```
GitHub Repository: habitualos
├── main branch
│
├── Netlify Site: habitual-web (original site)
│   ├── Package directory: apps/habitual-web
│   ├── Production URL: [your-existing-url].netlify.app
│   └── Environment: FIREBASE_ADMIN_CREDENTIALS, ANTHROPIC_API_KEY
│
└── Netlify Site: relationship-web (new site)
    ├── Package directory: apps/relationship-web
    ├── Production URL: [new-url].netlify.app
    └── Environment: FIREBASE_ADMIN_CREDENTIALS
```

Both sites:
- Deploy automatically on push to `main`
- Create deploy previews on pull requests
- Share the same Firestore database
- Use `_userId` for data isolation

---

## Troubleshooting

### Build fails: "Cannot find module '@habitualos/db-core'"

The Netlify bundler needs to resolve workspace packages. Check:
1. `pnpm-workspace.yaml` exists at repo root
2. Package directory is set correctly in Netlify
3. `node_bundler = "esbuild"` is in netlify.toml

### Build fails: "Command failed with exit code 1"

Check the full build log for specific errors. Common issues:
- Missing dependencies in app's package.json
- Path issues in netlify.toml (paths should be relative to repo root when Package directory is set)

### Functions return 502/500 errors

Check function logs in Netlify dashboard:
1. Go to **Logs** → **Functions**
2. Find the failing function
3. Look for error messages

Common causes:
- Environment variables not set
- Firebase credentials invalid
- Import path issues

### Edge functions not working

Edge functions use Deno and may need different handling:
1. Verify edge function paths in netlify.toml
2. Check that edge-functions directory is at the correct path
3. Edge functions don't use Node.js require - use import

---

## Verification Checklist

- [ ] habitual-web deploys successfully
- [ ] habitual-web API endpoints work in production
- [ ] habitual-web frontend works in production
- [ ] relationship-web deploys successfully
- [ ] relationship-web API endpoints work in production
- [ ] relationship-web frontend works in production
- [ ] Both apps share Firestore (same data for same userId)
- [ ] Deploy previews work for both sites

## Commit (if any fixes were needed)
```bash
git add -A
git commit -m "Phase 4: Finalize Netlify deployment configuration"
git push origin main
```

---

## What's Next (Future Phases)

With the monorepo and deployment working, you can:

1. **Add custom domains** to each Netlify site
2. **Set up CI/CD** - Add GitHub Actions for tests before deploy
3. **Expand relationship-web** - Add people management, more moment types, chat features
4. **Extract more shared code** - Templates, CSS, streaming chat infrastructure
5. **Add new apps** - Follow Phase 3 pattern for any new experiments

## Cleanup

Once everything is working and merged:

```bash
# Delete the migration branch
git branch -d monorepo-migration
git push origin --delete monorepo-migration

# Remove the safety tag (optional)
git tag -d pre-monorepo-migration
git push origin --delete pre-monorepo-migration
```

---

## Summary

You now have:
- A pnpm monorepo with shared `@habitualos/db-core` package
- `apps/habitual-web` - Original HabitualOS app
- `apps/relationship-web` - New relationship moments app
- Two independent Netlify sites deploying from one repo
- Clean rails for adding more apps in the future
