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
import { SessionModule } from './session/session.module';

@Module({
    imports: [
        SessionModule,
        JwtModule.registerAsync({
            useFactory: () => ({
                publicKey: process.env.JWT_PUBLIC_KEY,
                signOptions: {
                    algorithm: 'RS256',
                    issuer: process.env.TOKEN_ISSUER,
                    audience: process.env.TOKEN_AUDIENCE,
                },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        KeycloakService,
        PublicAuthGuard,
        SessionAuthGuard,
        TokenAuthGuard,
        jwksProvider,
    ],
    exports: [
        AuthService,
        PublicAuthGuard,
        SessionAuthGuard,
        TokenAuthGuard,
        jwksProvider,
    ],
})
export class AuthModule { }
