import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { KeycloakTokenResponse } from './keycloak.types';

@Injectable()
export class KeycloakService {
  async exchangeCode(code: string): Promise<KeycloakTokenResponse> {
    // real implementation later
    return {
      access_token: 'access',
      refresh_token: 'refresh',
      id_token: 'id',
      expires_in: 3600,
    };
  }

  getLoginUrl(state?: string) {
    const url = new URL(
      `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/auth`,
    );

    url.searchParams.set('client_id', process.env.KEYCLOAK_CLIENT_ID!);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set(
      'redirect_uri',
      `${process.env.APP_BASE_URL}/auth/callback`,
    );

    if (state) {
      url.searchParams.set('state', state);
    }

    return url.toString();
  }
}
