import { Module } from "@nestjs/common";
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./guards/auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { PermissionsGuard } from "./guards/permissions.guard";
import { PublicAuthGuard } from "./guards/public-auth.guard";
import { jwksProvider } from "./jwt/jwks.provider";
import { KeycloakService } from "./keycloak/keycloak.service";

@Module({
    controllers: [AuthController],
    providers: [
        AuthService,
        KeycloakService,
        jwksProvider,

        PublicAuthGuard,
        JwtAuthGuard,
        PermissionsGuard,
        AuthGuard,

        {
            provide: APP_GUARD,
            useClass: AuthGuard,
        },
        {
            provide: APP_GUARD,
            useClass: PermissionsGuard,
        },
    ],
})
export class AuthModule { }
