import { KeycloakService } from './keycloak/keycloak.service';
import { MemorySessionStore } from './session/memory-session.store';
export declare class AuthService {
    private readonly keycloak;
    private readonly sessionStore;
    constructor(keycloak: KeycloakService, sessionStore: MemorySessionStore);
    login(code: string): Promise<string>;
    logout(sessionId: string): void;
}
