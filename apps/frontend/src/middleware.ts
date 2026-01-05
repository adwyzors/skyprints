// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Protect dashboard routes
  if (pathname.startsWith("/dashboard")) {
    const sessionCookie = req.cookies.get("SESSION_ID");

    if (!sessionCookie) {
      const backendLoginUrl =
        `${process.env.NEXT_PUBLIC_API_URL}/auth/login` +
        `?redirectTo=${encodeURIComponent(pathname + search)}`;

      return NextResponse.redirect(backendLoginUrl);
    }
  }

  return NextResponse.next();
}
