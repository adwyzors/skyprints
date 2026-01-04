// auth/utils/cookie-domain.util.ts
import express from 'express';

export function resolveCookieDomain(
  req: express.Request,
): string | undefined {
  const envDomain = process.env.APP_COOKIE_DOMAIN;

  if (envDomain && envDomain !== 'auto') {
    return envDomain;
  }

  const host = req.hostname;

  // localhost (do NOT set domain)
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    /^[\d.]+$/.test(host)
  ) {
    return undefined;
  }

  const parts = host.split('.');

  // e.g. api.company.com → .company.com
  if (parts.length >= 2) {
    return `.${parts.slice(-2).join('.')}`;
  }

  return undefined;
}
