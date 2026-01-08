// auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PublicAuthGuard } from './guards/public-auth.guard';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { TokenAuthGuard } from './guards/token-auth.guard';
import { jwksProvider } from './jwt/jwks.provider';
import { KeycloakService } from './keycloak/keycloak.service';
import { MemorySessionStore } from './session/memory-session.store';
import { SESSION_STORE } from './session/session.constant';

@Module({
    imports: [
        JwtModule.registerAsync({
            useFactory: () => ({
                publicKey: process.env.JWT_PUBLIC_KEY,
                signOptions: {
                    algorithm: 'RS256',
                    issuer: process.env.TOKEN_ISSUER,
                    audience: process.env.TOKEN_AUDIENCE,
                },
            }),
        })
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        KeycloakService,
        MemorySessionStore,
        {
            provide: SESSION_STORE,
            useClass: MemorySessionStore,
        },

        PublicAuthGuard,
        SessionAuthGuard,
        TokenAuthGuard,
        jwksProvider,
    ],
    exports: [
        AuthService,
        MemorySessionStore,
        PublicAuthGuard,
        SessionAuthGuard,
        TokenAuthGuard,
        jwksProvider
    ],
})
export class AuthModule { }
