import type { Request } from 'express';


export function cookieOptions(req: Request, maxAgeSeconds: number) {
    const isHttps =
        req.secure ||
        req.headers['x-forwarded-proto'] === 'https';

    return {
        httpOnly: true,
        secure: isHttps,              // works on local + prod
        sameSite: 'none' as const,    // required for Keycloak
        maxAge: maxAgeSeconds * 1000,
        path: '/',
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
