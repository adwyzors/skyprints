import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function middleware(req: NextRequest) {
    const { pathname, search } = req.nextUrl;

    // Protect admin and manager routes
    if (pathname.startsWith("/admin") || pathname.startsWith("/manager")) {
        const accessToken = req.cookies.get("ACCESS_TOKEN");

        if (!accessToken) {
            const backendLoginUrl =
                `${process.env.NEXT_PUBLIC_API_URL}/auth/login` +
                `?redirectTo=${encodeURIComponent(pathname + search)}`;

            return NextResponse.redirect(backendLoginUrl);
        }
    }

    return NextResponse.next();
}
