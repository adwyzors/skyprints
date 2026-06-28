import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith('/admin') || pathname.startsWith('/manager')) {
    const accessToken = req.cookies.get('ACCESS_TOKEN');

    if (!accessToken) {
      const redirectTo = encodeURIComponent(pathname + search);
      const isInternal =
        process.env.NEXT_PUBLIC_INTERNAL_AUTH_ENABLED === 'true';

      const loginUrl = isInternal
        ? `/login?redirectTo=${redirectTo}`
        : `${process.env.NEXT_PUBLIC_API_URL}/auth/login?redirectTo=${redirectTo}`;

      return NextResponse.redirect(new URL(loginUrl, req.url));
    }
  }

  return NextResponse.next();
}
