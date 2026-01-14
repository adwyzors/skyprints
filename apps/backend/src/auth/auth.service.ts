import { Inject, Injectable } from '@nestjs/common';
import { jwtDecode } from 'jwt-decode';
import { KeycloakService } from './keycloak/keycloak.service';
import { SessionUser } from './session/session-user';
import { SESSION_STORE } from './session/session.constant';
import type { SessionStore } from './session/session.store';

@Injectable()
export class AuthService {
    constructor(
        private readonly keycloak: KeycloakService,

        // ✅ REQUIRED: token-based injection
        @Inject(SESSION_STORE)
        private readonly sessionStore: SessionStore,
    ) { }

    async login(code: string): Promise<string> {
        const tokens = await this.keycloak.exchangeCode(code);
        const userInfo: any = jwtDecode(tokens.access_token);

        const permissions = this.mapPermissions(userInfo);

        return this.sessionStore.create({
            user: {
                id: userInfo.sub,
                email: userInfo.email,
                permissions,
            },
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: Date.now() + tokens.expires_in * 1000,
        });
    }

    async getSessionUser(sessionId: string): Promise<SessionUser | null> {
        const session = this.sessionStore.get(sessionId);

        if (!session || session.expiresAt < Date.now()) {
            if (session) this.sessionStore.delete(sessionId);
            return null;
        }

        return session.user;
    }

    logout(sessionId: string) {
        this.sessionStore.delete(sessionId);
    }

    private mapPermissions(userInfo: any): string[] {
        return Array.from(new Set(userInfo.permissions ?? []));
    }
}
