import { Injectable } from "@nestjs/common";
import { KeycloakService } from "./keycloak/keycloak.service";
import { MemorySessionStore } from "./session/memory-session.store";
import { SessionUser } from "./session/session-user";
import { jwtDecode } from 'jwt-decode';


@Injectable()
export class AuthService {
    constructor(
        private readonly keycloak: KeycloakService,
        private readonly sessionStore: MemorySessionStore,
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
        const permissions = userInfo.permissions ?? [];

        return Array.from(
            new Set([...permissions]),
        );
    }

}
