import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InternalJwtAuthGuard } from './internal-jwt-auth.guard';
import { KeycloakJwtAuthGuard } from './keycloak-jwt-auth.guard';
import { PublicAuthGuard } from './public-auth.guard';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly publicGuard: PublicAuthGuard,
    private readonly keycloakGuard: KeycloakJwtAuthGuard,
    private readonly internalGuard: InternalJwtAuthGuard,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.publicGuard.canActivate(ctx)) {
      return true;
    }

    const useInternal = process.env.INTERNAL_AUTH_ENABLED === 'true';
    return useInternal
      ? this.internalGuard.canActivate(ctx)
      : this.keycloakGuard.canActivate(ctx);
  }
}
