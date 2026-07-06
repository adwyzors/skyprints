import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY, ANY_PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    const anyPermissions = this.reflector.getAllAndOverride<string[]>(
      ANY_PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    // No permissions required on either → check if any is present
    const hasRequired = requiredPermissions && requiredPermissions.length > 0;
    const hasAny = anyPermissions && anyPermissions.length > 0;

    if (!hasRequired && !hasAny) {
      return true;
    }

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;

    const userPermissions: string[] = user?.permissions ?? [];

    if (hasRequired) {
      const allowed = requiredPermissions.every((p) =>
        userPermissions.includes(p),
      );
      if (!allowed) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    if (hasAny) {
      const allowed = anyPermissions.some((p) =>
        userPermissions.includes(p),
      );
      if (!allowed) {
        throw new ForbiddenException('Insufficient permissions');
      }
    }

    return true;
  }
}

