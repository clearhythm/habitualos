import type { Context } from '@netlify/edge-functions';

export default async (request: Request, context: Context) => {
  const { pathname } = new URL(request.url);

  // Pass through: auth pages, static assets, API routes
  if (
    pathname.startsWith('/signin') ||
    pathname.startsWith('/join')   ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/styles') ||
    pathname.startsWith('/api')    ||
    pathname.startsWith('/.netlify')
  ) {
    return context.next();
  }

  const cookie = request.headers.get('cookie') || '';
  const authed = /(?:^|;\s*)dp-auth=1/.test(cookie);

  if (!authed) {
    return Response.redirect(new URL('/signin/', request.url), 302);
  }

  return context.next();
};
