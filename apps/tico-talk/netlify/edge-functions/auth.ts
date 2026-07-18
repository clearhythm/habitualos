import type { Context } from '@netlify/edge-functions';

// Pass-through stub. netlify.toml binds this to every path; the file must
// exist for a deploy to succeed. Real gating logic (redirect unauthenticated
// requests to sign-in, per dreamscape's apps/dreamscape/netlify/edge-functions/auth.ts
// pattern) lands once the §5 auth ticket is built — tico-talk has no sign-in
// flow or auth cookie yet, so gating now would lock out every request.
export default async (request: Request, context: Context) => {
  return context.next();
};
