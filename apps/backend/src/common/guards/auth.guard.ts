import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from 'src/auth/decorators/public.decorator';
import { MemorySessionStore } from 'src/auth/session/memory-session.store';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private sessionStore: MemorySessionStore,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest();
    const sessionId = req.cookies?.['SESSION_ID'];

    if (!sessionId) {
      throw new UnauthorizedException('Missing session');
    }

    const session = this.sessionStore.get(sessionId);
    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    req.user = session;
    return true;
  }
}
