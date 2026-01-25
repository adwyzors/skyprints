import {
    CanActivate,
    ExecutionContext,
    Inject,
    Injectable,
    UnauthorizedException
} from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JwtHeader } from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { RequestContextStore } from '../../common/context/request-context.store';
import { ContextLogger } from '../../common/logger/context.logger';
import { JWKS_PROVIDER } from '../jwt/jwks.provider';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    private readonly logger = new ContextLogger(JwtAuthGuard.name);

    constructor(
        @Inject(JWKS_PROVIDER)
        private readonly jwks: JwksClient,
    ) { }

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest();
        const token = this.extractToken(req);

        if (!token) {
            this.logger.debug('JWT token missing');
            throw new UnauthorizedException('Missing access token');
        }

        try {
            const decoded = await this.verify(token);

            const user = {
                id: decoded.sub as string,
                email: decoded.email as string,
                permissions: (decoded.permissions ?? []) as string[],
                roles: (decoded.realm_access?.roles ?? []) as string[],
            };


            // Attach to request (for controllers / decorators)
            req.user = user;

            // Attach to AsyncLocalStorage context
            const store = RequestContextStore.getStore();
            if (store) {
                store.user = user;
            }

            return true;
        } catch (err: any) {
            this.logger.error(
                'JWT verification failed',
                err?.message || err,
            );
            throw new UnauthorizedException('Invalid or expired token');
        }
    }

    /**
     * Verify JWT using Keycloak JWKS
     */
    private verify(token: string): Promise<any> {
        return new Promise((resolve, reject) => {
            jwt.verify(
                token,
                (header: JwtHeader, cb) => {
                    if (!header?.kid) {
                        return cb(new Error('Missing kid in JWT header'));
                    }

                    this.jwks.getSigningKey(header.kid, (err, key) => {
                        if (err) {
                            this.logger.error(
                                `JWKS key retrieval failed for kid=${header.kid}`,
                                err.message,
                            );
                            return cb(err);
                        }

                        const publicKey = key?.getPublicKey();
                        if (!publicKey) {
                            return cb(new Error('Public key not found in JWKS'));
                        }

                        cb(null, publicKey);
                    });
                },
                {
                    algorithms: ['RS256'],
                    issuer: process.env.TOKEN_ISSUER,
                    audience: process.env.TOKEN_AUDIENCE,
                    clockTolerance: 5,
                },
                (err, decoded) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(decoded);
                },
            );
        });
    }

    /**
     * Supports cookie OR Authorization header
     */
    private extractToken(req: any): string | null {
        if (req.cookies?.ACCESS_TOKEN) {
            return req.cookies.ACCESS_TOKEN;
        }

        const auth = req.headers?.authorization;
        if (!auth) return null;

        const [type, token] = auth.split(' ');
        return type === 'Bearer' ? token : null;
    }
}
