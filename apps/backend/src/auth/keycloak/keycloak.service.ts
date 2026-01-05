import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { KeycloakTokenResponse } from './keycloak.types';

@Injectable()
export class KeycloakService {
    async exchangeCode(code: string): Promise<KeycloakTokenResponse> {
        const tokenUrl =
            `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}` +
            `/protocol/openid-connect/token`;

        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: process.env.KEYCLOAK_CLIENT_ID!,
            client_secret: process.env.KEYCLOAK_CLIENT_SECRET!, // REQUIRED
            code,
            redirect_uri: `${process.env.APP_BASE_URL}/auth/callback`,
        });

        const response = await axios.post(tokenUrl, params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        return response.data;
    }

    getLoginUrl(state?: string) {
        const url = new URL(
            `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/auth`,
        );

        url.searchParams.set('client_id', process.env.KEYCLOAK_CLIENT_ID!);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set(
            'redirect_uri',
            `${process.env.APP_BASE_URL}/auth/callback`,
        );
        url.searchParams.set('scope','openid profile email',)

        if (state) {
            url.searchParams.set('state', state);
        }

        return url.toString();
    }

    // keycloak.service.ts
    async getUserInfo(accessToken: string) {
        const res = await fetch(
            `${process.env.KEYCLOAK_BASE_URL}/realms/${process.env.KEYCLOAK_REALM}/protocol/openid-connect/userinfo`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        );

        const text = await res.text(); // <-- important

        if (!res.ok) {
            throw new Error(
                `UserInfo failed: ${res.status} ${res.statusText} - ${text}`,
            );
        }

        if (!text) {
            throw new Error('UserInfo returned empty response');
        }

        return JSON.parse(text);
    }

}
