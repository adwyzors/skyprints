"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCookieDomain = resolveCookieDomain;
function resolveCookieDomain(req) {
    const envDomain = process.env.APP_COOKIE_DOMAIN;
    if (envDomain && envDomain !== 'auto') {
        return envDomain;
    }
    const host = req.hostname;
    if (host === 'localhost' ||
        host === '127.0.0.1' ||
        /^[\d.]+$/.test(host)) {
        return undefined;
    }
    const parts = host.split('.');
    if (parts.length >= 2) {
        return `.${parts.slice(-2).join('.')}`;
    }
    return undefined;
}
//# sourceMappingURL=cookie-domain.util.js.map