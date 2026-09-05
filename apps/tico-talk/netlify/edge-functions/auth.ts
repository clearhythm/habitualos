import type { Context } from '@netlify/edge-functions';

// Soft password gate on the live demo areas only — not the whole site.
// Erik's requirement: he can send a GM the marketing site + research
// article to browse on their own, without them being able to click into
// the actual product demos (Train, Insights) unsupervised — he wants to
// be present for that first reaction, not have it happen alone.
//
// This is a deterrent, not real security: a shared password in a cookie,
// checked here on every request to a gated path. Good enough to stop a
// GM from casually clicking a nav link; not meant to withstand a
// determined attacker. Real per-user auth (see the comment this replaced)
// is a separate, later project.
//
// Set DEMO_PASSWORD in Netlify's site environment variables (dashboard,
// not committed to source) for this to actually let anyone in. Without
// it, the gate still shows a normal-looking password prompt (never
// silently lets anyone through, and never looks broken/unfinished
// either) — it just tells you it's not accepting passwords yet if you
// actually try to submit one.
const GATED_PREFIXES = ['/app', '/insights/demo'];
const COOKIE_NAME = 'tico_demo_access';

function isGated(pathname: string): boolean {
  return GATED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

// Matches Tico's actual brand values (see src/styles/_variables.scss) —
// this edge function can't reach the site's compiled CSS at runtime, so
// the relevant colors/fonts are inlined here directly rather than
// approximated or borrowed from a sibling app's unrelated palette. One
// shared shell for both the real password prompt and the "not set up
// yet" case, so a misconfiguration doesn't fall back to a raw plain-text
// error page.
function pageShell(bodyHtml: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tico Demo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&family=Poppins:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f6e4cd;
    font-family: 'Poppins', system-ui, -apple-system, sans-serif;
    color: #1c1c1c;
    padding: 1.5rem;
  }
  .card {
    background: #ffffff;
    border: 1px solid #e6d6ba;
    border-radius: 1rem;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
    max-width: 380px;
    width: 100%;
    padding: 2.5rem 2rem;
    text-align: center;
  }
  .logo { width: 56px; height: 56px; margin: 0 auto 1.5rem; display: block; }
  h1 {
    font-family: 'Playfair Display', serif;
    font-weight: 600;
    font-size: 1.5rem;
    color: #083722;
    margin: 0 0 0.5rem;
  }
  p { color: #6b6258; font-size: 0.95rem; line-height: 1.5; margin: 0 0 1.5rem; }
  input {
    width: 100%;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    border: 1px solid #e6d6ba;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-family: inherit;
  }
  input:focus { outline: none; border-color: #083722; }
  button {
    width: 100%;
    padding: 0.85rem;
    background: #083722;
    color: #fff;
    border: none;
    border-radius: 999px;
    font-size: 1rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }
  button:hover { background: #062919; }
  .error { color: #ef4444; font-size: 0.875rem; margin: -0.75rem 0 1.25rem; }
  .contact-link { display: inline-block; margin-top: 1.25rem; font-size: 0.875rem; color: #b85400; text-decoration: none; }
  .contact-link:hover { text-decoration: underline; }
</style>
</head>
<body>
  <div class="card">
    <img src="/assets/images/tico-logomark.png" alt="Tico" class="logo">
    ${bodyHtml}
  </div>
</body>
</html>`;
}

function passwordPage(error?: string): Response {
  const body = `
    <h1>Start Using Tico</h1>
    <p>You need a password to try the demo. Already have one? Enter it below.</p>
    ${error ? `<p class="error">${error}</p>` : ''}
    <form method="POST">
      <input type="password" name="password" placeholder="Password" autofocus required>
      <button type="submit">Sign In</button>
    </form>
    <a href="/demo/request/" class="contact-link">Request demo access →</a>
  `;
  return new Response(pageShell(body), { status: 401, headers: { 'Content-Type': 'text/html' } });
}

export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  if (!isGated(url.pathname)) return context.next();

  const cookies = request.headers.get('cookie') || '';
  const hasAccess = cookies.split(';').some((c) => c.trim() === `${COOKIE_NAME}=1`);
  if (hasAccess) return context.next();

  // Deliberately not checked before this point: a plain visit always
  // sees the real password form, whether or not DEMO_PASSWORD is set
  // yet. Bailing out early with a "not configured" page here would mean
  // the gate looks broken/unfinished to anyone who visits before Erik's
  // added the env var — worse than just showing the normal prompt, which
  // reads as a real, working gate either way. The missing-config case
  // only surfaces once someone actually tries to get in.
  const correctPassword = Deno.env.get('DEMO_PASSWORD');

  // Magic-link alternative to typing the password: share a URL like
  // /app/?access=<the same DEMO_PASSWORD> and it unlocks on click, no
  // form to fill in. Same secret either way — just a lower-friction way
  // to hand out access than reading a password aloud.
  const linkToken = url.searchParams.get('access');
  if (correctPassword && linkToken === correctPassword) {
    url.searchParams.delete('access');
    const response = new Response(null, { status: 302, headers: { Location: url.pathname + url.search } });
    response.headers.append(
      'Set-Cookie',
      `${COOKIE_NAME}=1; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; Secure; SameSite=Lax`
    );
    return response;
  }

  if (request.method === 'POST') {
    if (!correctPassword) {
      return passwordPage("This demo isn't accepting passwords yet — check back soon.");
    }
    const form = await request.formData();
    if (form.get('password') === correctPassword) {
      const response = new Response(null, { status: 302, headers: { Location: url.pathname } });
      response.headers.append(
        'Set-Cookie',
        `${COOKIE_NAME}=1; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; Secure; SameSite=Lax`
      );
      return response;
    }
    return passwordPage('Incorrect password.');
  }

  return passwordPage();
};
