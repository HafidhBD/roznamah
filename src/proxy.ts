import { NextResponse, type NextRequest } from 'next/server';

// Cheap gate: no session cookie, no admin. The real check (session row + ADMIN_EMAILS) happens in
// getAdminSession(), called by every admin page and route.
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname === '/admin/sign-in') return NextResponse.next();
  if (SESSION_COOKIES.some((n) => req.cookies.get(n)?.value)) return NextResponse.next();
  if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const url = new URL('/admin/sign-in', req.url);
  url.searchParams.set('callbackUrl', pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/admin/:path*', '/api/admin/:path*'] };
