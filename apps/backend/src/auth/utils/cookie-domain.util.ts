import type { Request } from 'express';


export function cookieOptions(req: Request, maxAgeSeconds: number) {
  return {
    httpOnly: process.env.COOKIE_HTTP_ONLY === "true",
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: process.env.COOKIE_SAMESITE as "lax" | "strict" | "none",
    maxAge: maxAgeSeconds * 1000,
    path: process.env.COOKIE_PATH || "/",

    // domain must be omitted locally
    ...(process.env.COOKIE_DOMAIN
      ? { domain: process.env.COOKIE_DOMAIN }
      : {}),
  };
}


export function resolveCookieDomain(req: Request): string | undefined {
    const host = req.hostname;

    if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        /^\d+\.\d+\.\d+\.\d+$/.test(host)
    ) {
        return undefined;
    }

    const parts = host.split('.');

    if (parts.length === 2) {
        return host;
    }

    return `.${parts.slice(-2).join('.')}`;
}
