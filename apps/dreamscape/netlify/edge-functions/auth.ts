import type { Context } from '@netlify/edge-functions';

export default async (request: Request, context: Context) => {
  const { pathname } = new URL(request.url);

  // Pass through: static assets, API routes, signin
  if (
    pathname.startsWith('/signin')    ||
    pathname.startsWith('/assets')    ||
    pathname.startsWith('/styles')    ||
    pathname.startsWith('/api')       ||
    pathname.startsWith('/.netlify')
  ) {
    return context.next();
  }

  // Rewrite /join/{slug} → /join/ (SPA-style, slug read by client JS)
  if (pathname.startsWith('/join/') && pathname !== '/join/') {
    return context.rewrite(new URL('/join/', request.url));
  }

  const cookie = request.headers.get('cookie') || '';
  const authed = /(?:^|;\s*)dp-auth=1/.test(cookie);

  if (!authed) {
    return Response.redirect(new URL('/signin/', request.url), 302);
  }

  return context.next();
};
