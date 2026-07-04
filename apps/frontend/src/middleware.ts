import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith('/admin') || pathname.startsWith('/manager')) {
    const activeIndexCookie = req.cookies.get('active_account_index');
    const activeIndex = activeIndexCookie ? activeIndexCookie.value : '0';
    const tokenName = activeIndex === '0' || !activeIndex ? 'ACCESS_TOKEN' : `ACCESS_TOKEN_${activeIndex}`;
    const accessToken = req.cookies.get(tokenName);

    if (!accessToken) {
      const redirectTo = encodeURIComponent(pathname + search);
      const isInternal =
        process.env.NEXT_PUBLIC_INTERNAL_AUTH_ENABLED === 'true';

      const loginUrl = isInternal
        ? `/login?redirectTo=${redirectTo}&loginIndex=${activeIndex}`
        : `${process.env.NEXT_PUBLIC_API_URL}/auth/login?redirectTo=${redirectTo}&loginIndex=${activeIndex}`;

      return NextResponse.redirect(new URL(loginUrl, req.url));
    }
  }

  return NextResponse.next();
}
