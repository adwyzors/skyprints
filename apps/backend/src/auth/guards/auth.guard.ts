import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InternalJwtAuthGuard } from './internal-jwt-auth.guard';
import { PublicAuthGuard } from './public-auth.guard';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly publicGuard: PublicAuthGuard,
    private readonly internalGuard: InternalJwtAuthGuard,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.publicGuard.canActivate(ctx)) {
      return true;
    }

    return this.internalGuard.canActivate(ctx);
  }
}
