import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { InternalJwtAuthGuard } from './guards/internal-jwt-auth.guard';
import { KeycloakJwtAuthGuard } from './guards/keycloak-jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { PublicAuthGuard } from './guards/public-auth.guard';
import { InternalJwtService } from './jwt/internal-jwt.service';
import { jwksProvider } from './jwt/jwks.provider';
import { KeycloakService } from './keycloak/keycloak.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    KeycloakService,
    jwksProvider,
    InternalJwtService,

    PublicAuthGuard,
    KeycloakJwtAuthGuard,
    InternalJwtAuthGuard,
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
  exports: [
    AuthGuard,
    KeycloakJwtAuthGuard,
    InternalJwtAuthGuard,
    PublicAuthGuard,
    InternalJwtService,
  ],
})
export class AuthModule {}
