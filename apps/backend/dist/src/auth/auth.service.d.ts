import { KeycloakService } from './keycloak/keycloak.service';
import { SessionUser } from './session/session-user';
import type { SessionStore } from './session/session.store';
export declare class AuthService {
    private readonly keycloak;
    private readonly sessionStore;
    constructor(keycloak: KeycloakService, sessionStore: SessionStore);
    login(code: string): Promise<string>;
    getSessionUser(sessionId: string): Promise<SessionUser | null>;
    logout(sessionId: string): void;
    private mapPermissions;
}
