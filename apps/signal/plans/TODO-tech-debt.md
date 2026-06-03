# Signal Tech Debt

## 1. Migrate to Vite

Signal currently bundles copies of shared packages (e.g. `@habitualos/auth-server`, `@habitualos/db-core`) into `.netlify/functions-serve/` rather than resolving them live. This means package updates don't reach Signal until a full rebuild, creating silent drift between Signal and the rest of the monorepo.

Follow the reference implementation in `apps/dreamscape` — it is the canonical example of the correct Vite-based setup for a Netlify app in this monorepo.

---

## 2. Email & Signup Function Migration

Signal's `signal-register.js` calls `ensureUserEmail()` from `@habitualos/auth-server`. This function is a legacy wrapper that blends two concerns: creating a new user record and updating an existing user's email on re-submission ("wrong email entered" flow).

After migrating to Vite, replace `ensureUserEmail` with the explicit split functions:

- **New user** → `createUser(userId, email)` — creates the user doc, no-op if already exists
- **Change email re-submission** → `setUserEmail(userId, email)` — patches just the email field on an existing doc

For a reference implementation of the full email-based signup flow including "change or resend" functionality, see `apps/dreamscape`:

- `netlify/functions/_utils/create-auth-token.cjs` — server-side: `createUser` vs `setUserEmail` branching, magic link generation
- `netlify/functions/auth-magic-link-send.cjs` — send endpoint
- `netlify/functions/auth-magic-link-consume.cjs` — consume endpoint
- `src/assets/js/pages/signup.js` — client-side signup flow including "edit email" button
- `src/assets/js/auth/signin.js` — token consumption + post-signin registration

Once `ensureUserEmail` has no remaining callers across the monorepo, remove it from `packages/auth-server`.
