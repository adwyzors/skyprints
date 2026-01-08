// auth/guards/token-auth.guard.ts
import {
    CanActivate,
    ExecutionContext,
    Inject,
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import jwt, { JwtHeader } from 'jsonwebtoken';

import { JwksClient } from 'jwks-rsa';
import { JWKS_PROVIDER } from '../jwt/jwks.provider';


@Injectable()
export class TokenAuthGuard implements CanActivate {
    constructor(
        @Inject(JWKS_PROVIDER) private readonly jwks: JwksClient,
    ) { }
    private readonly logger = new Logger(TokenAuthGuard.name);


    canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest();
        const auth = req.headers['authorization'];

        if (!auth?.startsWith('Bearer ')) {
            this.logger.debug('No bearer token found');
            return Promise.resolve(false);
        }

        const token = auth.slice(7);

        return new Promise((resolve, reject) => {
            jwt.verify(
                token,
                (header: JwtHeader, callback) => {
                    if (!header.kid) {
                        return callback(new Error('Missing kid in token header'));
                    }
                    //can we do this here and cache?
                    this.jwks.getSigningKey(header.kid, (err, key) => {
                        if (err || !key) {
                            return callback(err || new Error('Signing key not found'));
                        }

                        callback(null, key.getPublicKey());
                    });
                },
                {
                    algorithms: ['RS256'],
                    issuer: 'http://keycloak:8081/realms/master',
                },
                (err, decoded) => {
                    if (err) {
                        this.logger.error('JWT verification failed', err.message);
                        return reject(
                            new UnauthorizedException('Invalid access token'),
                        );
                    }

                    req.user = decoded;
                    resolve(true);
                },
            );
        });
    }
}
