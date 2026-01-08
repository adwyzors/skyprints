import {
    CanActivate,
    ExecutionContext,
    Inject,
    Injectable,
    UnauthorizedException
} from '@nestjs/common';
import { SESSION_STORE } from '../session/session.constant';
import type { SessionStore } from '../session/session.store';

@Injectable()
export class SessionAuthGuard implements CanActivate {
    constructor(
        @Inject(SESSION_STORE)
        private readonly sessionStore: SessionStore,
    ) { }
    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest();

        const sessionId = req.cookies?.['SESSION_ID'];
        if (!sessionId) return false;

        const session = await this.sessionStore.get(sessionId);
        if (!session || session.expiresAt < new Date().getTime()) {
            throw new UnauthorizedException('Invalid or expired session');
        }

        req.user = session.user;
        return true;
    }
}
