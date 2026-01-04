import { KeycloakService } from "./keycloak/keycloak.service";
import { MemorySessionStore } from "./session/memory-session.store";
import { SessionUser } from "./session/session-user";
export declare class AuthService {
    private readonly keycloak;
    private readonly sessionStore;
    constructor(keycloak: KeycloakService, sessionStore: MemorySessionStore);
    login(code: string): Promise<string>;
    getSessionUser(sessionId: string): Promise<SessionUser | null>;
    logout(sessionId: string): void;
    private mapPermissions;
}
