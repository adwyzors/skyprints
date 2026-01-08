// auth/guards/public-auth.guard.ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class PublicAuthGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) { }

    canActivate(ctx: ExecutionContext): boolean {
        return this.reflector.getAllAndOverride<boolean>(
            IS_PUBLIC_KEY,
            [ctx.getHandler(), ctx.getClass()],
        ) === true;
    }
}
