import type { Request } from 'express';

export function cookieOptions(req: Request, maxAgeSeconds: number) {
  return {
    httpOnly: process.env.COOKIE_HTTP_ONLY !== 'false',
    secure: process.env.COOKIE_SECURE !== 'false',
    sameSite: process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none',
    maxAge: maxAgeSeconds * 1000,
    path: process.env.COOKIE_PATH || '/',

    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
}
