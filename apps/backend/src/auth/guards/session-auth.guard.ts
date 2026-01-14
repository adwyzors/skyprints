import {
    CanActivate,
    ExecutionContext,
    Inject,
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import { SESSION_STORE } from '../session/session.constant';
import type { SessionStore } from '../session/session.store';

@Injectable()
export class SessionAuthGuard implements CanActivate {
    private readonly logger = new Logger(SessionAuthGuard.name);

    constructor(
        @Inject(SESSION_STORE)
        private readonly sessionStore: SessionStore,
    ) { }

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest();

        const sessionId = req.cookies?.['SESSION_ID'];

        if (!sessionId) {
            this.logger.warn('Auth failed: SESSION_ID cookie missing');
            return false;
        }

        const session = this.sessionStore.get(sessionId);

        if (!session) {
            this.logger.warn(`Auth failed: session not found (${sessionId})`);
            throw new UnauthorizedException('Invalid session');
        }

        if (session.expiresAt < Date.now()) {
            this.logger.warn(`Auth failed: session expired (${sessionId})`);
            throw new UnauthorizedException('Session expired');
        }

        req.user = session.user;
        return true;
    }
}
