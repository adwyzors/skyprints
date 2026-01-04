import { Injectable } from '@nestjs/common';
import { KeycloakService } from './keycloak/keycloak.service';
import { MemorySessionStore } from './session/memory-session.store';

@Injectable()
export class AuthService {
  constructor(
    private readonly keycloak: KeycloakService,
    private readonly sessionStore: MemorySessionStore,
  ) {}

  async login(code: string): Promise<string> {
    const tokens = await this.keycloak.exchangeCode(code);

    return this.sessionStore.create({
      userId: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    });
  }

  logout(sessionId: string) {
    this.sessionStore.delete(sessionId);
  }
}
